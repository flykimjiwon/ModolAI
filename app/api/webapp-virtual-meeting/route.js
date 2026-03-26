import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { resolveModelId, getDefaultModel } from '@/lib/modelServers';
import { logExternalApiRequest } from '@/lib/externalApiLogger';
import {
  buildPersonaTurnPrompt,
  buildSummaryPrompt,
  parseJsonFromStream,
} from '@/lib/agent-data/virtual-meeting';

const AGENT_ID = '1';

const DEFAULT_SETTINGS = {
  selectedModelId: '',
  allowUserModelOverride: false,
};

async function getAgentSettings() {
  try {
    const result = await query(
      `SELECT selected_model_id, allow_user_model_override, extra_config
       FROM agent_settings WHERE agent_id = $1 LIMIT 1`,
      [AGENT_ID]
    );
    const row = result.rows[0];
    if (!row) return DEFAULT_SETTINGS;
    return {
      selectedModelId: row.selected_model_id || '',
      allowUserModelOverride: row.allow_user_model_override === true,
      extraConfig: row.extra_config || {},
    };
  } catch (error) {
    console.warn('[webapp-virtual-meeting] Failed to load agent_settings:', error.message);
    return DEFAULT_SETTINGS;
  }
}

async function getModelOptionsForRole(role = 'user') {
  const { getModelsFromTables } = await import('@/lib/modelTables');
  const categories = await getModelsFromTables();
  if (!categories || typeof categories !== 'object') return [];

  const isAdmin = ['admin', 'manager'].includes(role);
  const result = [];
  for (const [categoryKey, category] of Object.entries(categories)) {
    const models = Array.isArray(category?.models) ? category.models : [];
    for (const model of models) {
      if (!model || model.visible === false) continue;
      if (!isAdmin && model.adminOnly === true) continue;
      const id = String(model.modelName || model.id || '').trim();
      if (!id) continue;
      result.push({
        id,
        label: model.label || id,
        categoryLabel: category?.label || categoryKey,
      });
    }
  }
  return result;
}

async function checkAgentPermissionForUser(user, agentId = AGENT_ID) {
  const userId = user?.id || user?.sub || user?.userId;
  if (!userId) return false;

  const permissionsResult = await query(
    `SELECT permission_type, permission_value, is_allowed
     FROM agent_permissions WHERE agent_id = $1`,
    [agentId]
  );

  const permissions = permissionsResult.rows;
  if (permissions.length === 0) return true;

  const allPermission = permissions.find((p) => p.permission_type === 'all');
  if (allPermission) return allPermission.is_allowed === true;

  const userPermission = permissions.find(
    (p) => p.permission_type === 'user' && p.permission_value === userId
  );
  if (userPermission) return userPermission.is_allowed === true;

  const rolePermission = permissions.find(
    (p) => p.permission_type === 'role' && p.permission_value === user?.role
  );
  if (rolePermission) return rolePermission.is_allowed === true;

  const deptPermission = permissions.find(
    (p) => p.permission_type === 'department' && p.permission_value === user?.department
  );
  if (deptPermission) return deptPermission.is_allowed === true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM call helper: collects SSE stream and returns completed text
// ─────────────────────────────────────────────────────────────────────────────

async function collectLLMResponse({ model, systemPrompt, userPrompt, authHeader, localOrigin, parentSignal, timeoutMs = 90000, apiType = 'virtual-meeting', userId = '' }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const llmUrl = `${localOrigin}/api/webapp-generate`;
  const llmStartTime = Date.now();

  // Connect parent signal (for user cancellation)
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) { clearTimeout(timeout); throw new Error('Aborted'); }
    parentSignal.addEventListener('abort', onParentAbort);
  }

  try {
    let response;
    try {
      response = await fetch(llmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          question: userPrompt,
          prompt: userPrompt,
          requestPurpose: 'virtual-meeting',
          multiturnHistory: [{ role: 'system', text: systemPrompt }],
          stream: true,
          options: { temperature: 0.75, max_length: 800 },
        }),
      });
    } catch (fetchError) {
      const llmElapsed = Date.now() - llmStartTime;
      logExternalApiRequest({
        sourceType: 'internal',
        provider: 'model-server',
        apiType,
        endpoint: llmUrl,
        model,
        promptTokenCount: userPrompt.length,
        responseTokenCount: 0,
        responseTime: llmElapsed,
        statusCode: fetchError?.name === 'AbortError' ? 504 : 500,
        isStream: true,
        jwtUserId: userId,
        error: fetchError?.message,
      }).catch(() => {});
      throw fetchError;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      const llmElapsed = Date.now() - llmStartTime;
      logExternalApiRequest({
        sourceType: 'internal',
        provider: 'model-server',
        apiType,
        endpoint: llmUrl,
        model,
        promptTokenCount: userPrompt.length,
        responseTokenCount: errText.length,
        responseTime: llmElapsed,
        statusCode: response.status,
        isStream: true,
        jwtUserId: userId,
        error: errText.slice(0, 500),
      }).catch(() => {});
      throw new Error(`LLM call failed (HTTP ${response.status}): ${errText.slice(0, 200)}`);
    }

    if (!response.body) {
      const text = (await response.text()).trim();
      const llmElapsed = Date.now() - llmStartTime;
      logExternalApiRequest({
        sourceType: 'internal',
        provider: 'model-server',
        apiType,
        endpoint: llmUrl,
        model,
        promptTokenCount: userPrompt.length,
        responseTokenCount: text.length,
        responseTime: llmElapsed,
        statusCode: 200,
        isStream: false,
        jwtUserId: userId,
      }).catch(() => {});
      return text;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let text = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) continue;

        const data = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
        if (!data || data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          // OpenAI format: choices[0].delta.content
          // Ollama format: response (relayed by webapp-generate for Ollama)
          const content =
            parsed.choices?.[0]?.delta?.content ||
            parsed.choices?.[0]?.message?.content ||
            parsed.response ||
            parsed.message?.content ||
            '';
          if (content) text += content;
        } catch {
          // non-JSON data appended as-is
          if (!data.startsWith('{')) text += data;
        }
      }
    }

    // Success logging
    const llmElapsed = Date.now() - llmStartTime;
    logExternalApiRequest({
      sourceType: 'internal',
      provider: 'model-server',
      apiType,
      endpoint: llmUrl,
      model,
      promptTokenCount: userPrompt.length,
      responseTokenCount: text.length,
      responseTime: llmElapsed,
      statusCode: 200,
      isStream: true,
      jwtUserId: userId,
    }).catch(() => {});

    return text.trim();
  } finally {
    clearTimeout(timeout);
    if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: return settings and model list
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const hasPermission = await checkAgentPermissionForUser(authResult.user, AGENT_ID);
    if (!hasPermission) {
      return NextResponse.json({ error: 'You do not have permission to access Virtual Meeting.' }, { status: 403 });
    }

    const settings = await getAgentSettings();
    const modelOptions = await getModelOptionsForRole(authResult.user?.role || 'user');
    return NextResponse.json({ settings, modelOptions });
  } catch (error) {
    console.error('[webapp-virtual-meeting:GET] error:', error);
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: individual LLM call per persona → structured SSE streaming
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const hasPermission = await checkAgentPermissionForUser(authResult.user, AGENT_ID);
    if (!hasPermission) {
      return NextResponse.json({ error: 'You do not have permission to access Virtual Meeting.' }, { status: 403 });
    }

    const body = await request.json();
    const {
      meetingFormat,
      personas,
      topic,
      context,
      roundCount,
      framework,
      defaultModel: requestedDefaultModel,
      minSpeechPerRound: rawMinSpeech,
      leaderId,
      customFormatText,
      summaryModel: requestedSummaryModel,
    } = body;

    // ── Validation ──
    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return NextResponse.json({ error: 'Please enter a meeting topic.' }, { status: 400 });
    }
    if (topic.length > 500) {
      return NextResponse.json({ error: 'Topic must be 500 characters or less.' }, { status: 400 });
    }
    if (!Array.isArray(personas) || personas.length < 2 || personas.length > 12) {
      return NextResponse.json({ error: 'Must have 2-12 participants.' }, { status: 400 });
    }
    const safeRoundCount = Math.max(1, Math.min(10, Number(roundCount) || 3));
    const minSpeechPerRound = Math.max(1, Math.min(3, Number(rawMinSpeech) || 1));
    const safeCustomFormatText = (meetingFormat === 'custom' && customFormatText) ? String(customFormatText).trim().slice(0, 3000) : '';

    // ── Model resolution ──
    const settings = await getAgentSettings();
    const modelOptions = await getModelOptionsForRole(authResult.user?.role || 'user');
    const modelOptionIds = new Set(modelOptions.map((m) => m.id));

    // Base model
    let baseModelId = settings.selectedModelId || getDefaultModel();
    if (settings.allowUserModelOverride && requestedDefaultModel && modelOptionIds.has(requestedDefaultModel)) {
      baseModelId = requestedDefaultModel;
    }

    // Admin settings
    const adminPersonaModels = settings.extraConfig?.personaModels || {};
    const adminAllowedModels = settings.extraConfig?.allowedModels || [];
    const hasAllowedList = adminAllowedModels.length > 0;
    const adminPersonaOverrides = settings.extraConfig?.personaOverrides || {};

    // Apply admin persona overrides (personality, speakingStyle, concerns, expertise)
    for (const p of personas) {
      const override = adminPersonaOverrides[p.id];
      if (override) {
        if (override.personality) p.personality = override.personality;
        if (override.speakingStyle) p.speakingStyle = override.speakingStyle;
        if (override.concerns) p.concerns = override.concerns.split(',').map((s) => s.trim()).filter(Boolean);
        if (override.expertise) p.expertise = override.expertise.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    // Pre-resolve model per persona (cached)
    const modelNameCache = {};
    const resolveModel = async (modelId) => {
      const id = modelId || baseModelId;
      if (!modelNameCache[id]) {
        modelNameCache[id] = await resolveModelId(id);
      }
      return modelNameCache[id];
    };

    // Per-persona model decision: user selection > admin role setting > base model
    for (const p of personas) {
      if (p.model) {
        // Validate against allowed list
        if (hasAllowedList && !adminAllowedModels.includes(p.model)) {
          p.model = '';
        } else if (!modelOptionIds.has(p.model) && p.model !== baseModelId) {
          p.model = '';
        }
      }
      // Apply admin role model if user did not specify one
      if (!p.model && p.id && adminPersonaModels[p.id]) {
        p.model = adminPersonaModels[p.id];
      }
    }

    const localPort = process.env.PORT || 3000;
    const localOrigin = `http://127.0.0.1:${localPort}`;
    const authHeader = request.headers.get('authorization') || '';
    const userId = authResult.user?.sub || authResult.user?.id || '';

    // Total timeout (personas × rounds × speeches × 90s + 60s for summary)
    const totalTimeoutMs = personas.length * safeRoundCount * minSpeechPerRound * 90000 + 60000;
    const parentController = new AbortController();
    const parentTimeout = setTimeout(() => parentController.abort(), totalTimeoutMs);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const emit = (data) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {}
        };

        const close = () => {
          try {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch {}
          clearTimeout(parentTimeout);
        };

        try {
          const conversationHistory = [];

          for (let round = 1; round <= safeRoundCount; round++) {
            emit({ type: 'round_start', roundNumber: round, totalRounds: safeRoundCount });

            for (let speech = 1; speech <= minSpeechPerRound; speech++) {
              for (let pi = 0; pi < personas.length; pi++) {
                const persona = personas[pi];
                const isLeader = !!(leaderId && persona.name === leaderId);

                emit({
                  type: 'typing',
                  speaker: persona.name,
                  role: persona.role,
                  roundNumber: round,
                  personaIndex: pi,
                });

                // Per-persona system prompt
                const systemPrompt = buildPersonaTurnPrompt({
                  persona,
                  meetingFormat: meetingFormat || 'brainstorming',
                  topic: topic.trim(),
                  context: context ? String(context).trim().slice(0, 3000) : '',
                  framework: framework || null,
                  allPersonas: personas,
                  roundNumber: round,
                  totalRounds: safeRoundCount,
                  isLeader,
                  customFormatText: safeCustomFormatText,
                  minSpeechPerRound,
                  speechIndex: speech,
                  customInstructions: persona.instructions || '',
                });

                // Build prior conversation context
                const historyLines = conversationHistory.map(
                  (m) => `[Round ${m.roundNumber}] ${m.speaker} (${m.role}): ${m.message}`
                );
                const userPrompt = [
                  historyLines.length > 0 ? '## Previous conversation\n' + historyLines.join('\n\n') : '',
                  '',
                  `---`,
                  speech > 1
                    ? `It is your turn (${persona.name}, ${persona.role}) for speech ${speech} in round ${round}. Present a new perspective different from your previous statement.`
                    : `It is your turn (${persona.name}, ${persona.role}) in round ${round}.`,
                  historyLines.length > 0
                    ? 'Referring to the conversation above, respond naturally to other participants while sharing your opinion.'
                    : 'As the first speaker, share your thoughts on the topic.',
                ].filter(Boolean).join('\n');

                const personaModelName = await resolveModel(persona.model || '');

                const responseText = await collectLLMResponse({
                  model: personaModelName,
                  systemPrompt,
                  userPrompt,
                  authHeader,
                  localOrigin,
                  parentSignal: parentController.signal,
                  timeoutMs: 90000,
                  apiType: 'virtual-meeting',
                  userId,
                });

                conversationHistory.push({
                  speaker: persona.name,
                  role: persona.role,
                  message: responseText,
                  roundNumber: round,
                });

                emit({
                  type: 'message',
                  speaker: persona.name,
                  role: persona.role,
                  message: responseText,
                  roundNumber: round,
                  personaIndex: pi,
                });
              }
            }
          }

          // ── Summary generation ──
          emit({ type: 'summarizing' });

          const summarySystemPrompt = buildSummaryPrompt({
            topic: topic.trim(),
            conversationHistory,
            roundCount: safeRoundCount,
          });

          // Summary model decision: admin setting > user selection > base model
          let summaryModelId = settings.extraConfig?.summaryModel || requestedSummaryModel || baseModelId;
          if (hasAllowedList && summaryModelId !== baseModelId && !adminAllowedModels.includes(summaryModelId)) {
            summaryModelId = baseModelId;
          }
          const summaryModelName = await resolveModel(summaryModelId);
          const summaryText = await collectLLMResponse({
            model: summaryModelName,
            systemPrompt: summarySystemPrompt,
            userPrompt: 'Analyze the meeting content above and summarize it in JSON format.',
            authHeader,
            localOrigin,
            parentSignal: parentController.signal,
            timeoutMs: 60000,
            apiType: 'virtual-meeting',
            userId,
          });

          const summaryData = parseJsonFromStream(summaryText);

          emit({
            type: 'summary',
            data: summaryData || { rawText: summaryText },
          });

          // ── Final result (for history storage) ──
          const rounds = [];
          for (let r = 1; r <= safeRoundCount; r++) {
            rounds.push({
              roundNumber: r,
              discussions: conversationHistory
                .filter((m) => m.roundNumber === r)
                .map((m) => ({ speaker: m.speaker, role: m.role, message: m.message })),
            });
          }

          emit({
            type: 'complete',
            data: { rounds, ...(summaryData || {}) },
          });

          close();
        } catch (error) {
          const isAbort = error?.name === 'AbortError' || error?.message === 'Aborted';
          emit({
            type: 'error',
            message: isAbort ? 'Meeting was cancelled.' : (error?.message || 'An error occurred during the meeting.'),
          });
          close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[webapp-virtual-meeting:POST] error:', error);
    return NextResponse.json({ error: 'Failed to process meeting request.' }, { status: 500 });
  }
}
