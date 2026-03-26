import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { resolveModelId, getDefaultModel } from '@/lib/modelServers';
import { buildTextRewriterContext } from '@/lib/agent-data/text-rewriter';
import { logExternalApiRequest } from '@/lib/externalApiLogger';

const AGENT_ID = '4';

const VALID_TONES = new Set([
  'formal', 'polite', 'casual', 'academic',
  'persuasive', 'concise', 'detailed', 'humorous',
]);

const VALID_PURPOSES = new Set([
  'email', 'report', 'proposal', 'minutes', 'announcement',
  'sns', 'presentation-script', 'memo', 'apology', 'thank-you',
]);

async function getAgentSettings() {
  try {
    const result = await query(
      `SELECT selected_model_id, allow_user_model_override, extra_config
       FROM agent_settings WHERE agent_id = $1 LIMIT 1`,
      [AGENT_ID]
    );
    const row = result.rows[0];
    if (!row) return { selectedModelId: '', allowUserModelOverride: false, extraConfig: {} };
    return {
      selectedModelId: row.selected_model_id || '',
      allowUserModelOverride: row.allow_user_model_override === true,
      extraConfig: row.extra_config || {},
    };
  } catch (error) {
    console.warn('[webapp-text-rewriter] Failed to query agent_settings:', error.message);
    return { selectedModelId: '', allowUserModelOverride: false, extraConfig: {} };
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
     FROM agent_permissions
     WHERE agent_id = $1`,
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

function buildSystemPrompt({ tone, purpose }) {
  const contextBlock = buildTextRewriterContext({ toneId: tone, purposeId: purpose });

  return [
    '당신은 전문 텍스트 재작성(리라이팅) 전문가입니다.',
    '사용자가 제공하는 원본 텍스트를 지정된 톤과 용도에 맞게 재작성합니다.',
    '',
    '## 핵심 규칙',
    '1. 원본의 핵심 의미와 정보를 반드시 보존한다.',
    '2. 지정된 톤의 특성을 충실히 반영한다.',
    '3. 지정된 용도의 구조와 형식을 따른다.',
    '4. 자연스러운 한국어 문장을 작성한다.',
    '5. 재작성된 결과만 출력한다 (설명, 주석, 코드블록 없이).',
    '6. 원본에 없는 사실이나 데이터를 창작하지 않는다.',
    '7. 원본보다 명확하고 효과적인 표현을 사용한다.',
    '',
    '## 톤/용도 레퍼런스',
    contextBlock,
  ].join('\n');
}

export async function GET(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const hasPermission = await checkAgentPermissionForUser(authResult.user, AGENT_ID);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to access the text rewriter.' },
        { status: 403 }
      );
    }

    const settings = await getAgentSettings();
    const modelOptions = await getModelOptionsForRole(authResult.user?.role || 'user');
    return NextResponse.json({ settings, modelOptions });
  } catch (error) {
    console.error('[webapp-text-rewriter:GET] error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve text rewriter settings.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const hasPermission = await checkAgentPermissionForUser(authResult.user, AGENT_ID);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to access the text rewriter.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const text = String(body?.text || '').trim();
    const tone = String(body?.tone || '').trim();
    const purpose = String(body?.purpose || '').trim();
    const requestedModel = String(body?.model || '').trim();

    if (!text) {
      return NextResponse.json({ error: 'Please enter text to rewrite.' }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: 'Text must be 5000 characters or fewer.' }, { status: 400 });
    }
    if (!VALID_TONES.has(tone)) {
      return NextResponse.json({ error: 'Invalid tone specified.' }, { status: 400 });
    }

    const validPurpose = VALID_PURPOSES.has(purpose) ? purpose : '';

    const settings = await getAgentSettings();
    const modelOptions = await getModelOptionsForRole(authResult.user?.role || 'user');
    const modelOptionIds = new Set(modelOptions.map((item) => item.id));

    let model = settings.selectedModelId || getDefaultModel();
    if (settings.allowUserModelOverride && requestedModel) {
      if (!modelOptionIds.has(requestedModel)) {
        return NextResponse.json(
          { error: 'The selected model is not available.' },
          { status: 400 }
        );
      }
      model = requestedModel;
    }

    const resolvedModelName = await resolveModelId(model);
    const systemPrompt = buildSystemPrompt({ tone, purpose: validPurpose });

    const prompt = [
      `[톤: ${tone}]`,
      validPurpose ? `[용도: ${validPurpose}]` : '',
      '',
      '아래 텍스트를 위 조건에 맞게 재작성해 주세요:',
      '',
      text,
    ].filter(Boolean).join('\n');

    const localPort = process.env.PORT || 3000;
    const localOrigin = `http://127.0.0.1:${localPort}`;
    const llmUrl = `${localOrigin}/api/webapp-generate`;
    const authHeader = request.headers.get('authorization') || '';
    const timeoutMs = 180000;
    const upstreamController = new AbortController();
    const upstreamTimeout = setTimeout(() => upstreamController.abort(), timeoutMs);
    const userId = authResult.user?.id || authResult.user?.sub || null;

    let upstreamResponse;
    const llmStartTime = Date.now();
    try {
      upstreamResponse = await fetch(llmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        signal: upstreamController.signal,
        body: JSON.stringify({
          model,
          question: prompt,
          prompt,
          requestPurpose: 'text-rewriter',
          multiturnHistory: [{ role: 'system', text: systemPrompt }],
          stream: true,
          options: {
            temperature: 0.6,
            max_length: Math.max(3000, Math.ceil(text.length * 0.8)),
          },
        }),
      });
    } catch (error) {
      const llmElapsed = Date.now() - llmStartTime;
      logExternalApiRequest({
        sourceType: 'internal',
        provider: 'model-server',
        apiType: 'text-rewrite',
        endpoint: llmUrl,
        model: resolvedModelName,
        promptTokenCount: prompt.length,
        responseTokenCount: 0,
        responseTime: llmElapsed,
        statusCode: error?.name === 'AbortError' ? 504 : 500,
        isStream: true,
        jwtUserId: userId,
        error: error?.message || 'fetch failed',
      }).catch(() => {});

      if (error?.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Text rewrite timed out. Please try again.' },
          { status: 504 }
        );
      }
      throw error;
    } finally {
      clearTimeout(upstreamTimeout);
    }

    const llmElapsed = Date.now() - llmStartTime;

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text().catch(() => '');
      logExternalApiRequest({
        sourceType: 'internal',
        provider: 'model-server',
        apiType: 'text-rewrite',
        endpoint: llmUrl,
        model: resolvedModelName,
        promptTokenCount: prompt.length,
        responseTokenCount: 0,
        responseTime: llmElapsed,
        statusCode: upstreamResponse.status,
        isStream: true,
        jwtUserId: userId,
        error: errorText || `HTTP ${upstreamResponse.status}`,
      }).catch(() => {});

      return NextResponse.json(
        {
          error: `Text rewrite request failed (HTTP ${upstreamResponse.status})`,
          details: errorText,
        },
        { status: upstreamResponse.status }
      );
    }

    // Success log
    logExternalApiRequest({
      sourceType: 'internal',
      provider: 'model-server',
      apiType: 'text-rewrite',
      endpoint: llmUrl,
      model: resolvedModelName,
      promptTokenCount: prompt.length,
      responseTokenCount: 0,
      responseTime: llmElapsed,
      statusCode: 200,
      isStream: true,
      jwtUserId: userId,
    }).catch(() => {});

    const contentType = upstreamResponse.headers.get('content-type') || 'text/event-stream';
    if (!upstreamResponse.body) {
      const rawText = await upstreamResponse.text();
      return new Response(rawText, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
        },
      });
    }

    // SSE streaming relay
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();
    const isSSE = contentType.includes('text/event-stream');

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstreamResponse.body.getReader();
        if (!reader) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        let buffer = '';
        let streamClosed = false;
        const emitDone = () => {
          if (streamClosed) return;
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          streamClosed = true;
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (isSSE && (trimmed.startsWith(':') || trimmed.startsWith('event:'))) continue;

              const data = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
              if (!data) continue;

              if (data === '[DONE]') {
                emitDone();
                return;
              }
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          const remaining = buffer.trim();
          if (remaining && remaining !== '[DONE]') {
            const payload = remaining.startsWith('data:') ? remaining.slice(5).trim() : remaining;
            if (payload && payload !== '[DONE]') {
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            }
          }

          emitDone();
        } catch (error) {
          if (!streamClosed) {
            const errorPayload = JSON.stringify({
              choices: [{ delta: { content: `\n[Error] ${error?.message || 'Stream processing error'}` } }],
            });
            controller.enqueue(encoder.encode(`data: ${errorPayload}\n\n`));
            emitDone();
          }
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
    console.error('[webapp-text-rewriter] error:', error);
    return NextResponse.json(
      { error: 'Failed to process text rewrite request.' },
      { status: 500 }
    );
  }
}
