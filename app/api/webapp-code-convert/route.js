import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { resolveModelId, getDefaultModel } from '@/lib/modelServers';
import { LANGUAGES, buildConversionReference } from '@/lib/agent-data/code-converter';
import { logExternalApiRequest } from '@/lib/externalApiLogger';

const VALID_LANGUAGE_IDS = new Set(LANGUAGES.map((l) => l.id));

async function getAgent2Settings() {
  try {
    const result = await query(
      `SELECT selected_model_id, allow_user_model_override, extra_config
       FROM agent_settings
       WHERE agent_id = $1
       LIMIT 1`,
      ['2']
    );
    const row = result.rows[0];
    if (!row) return { selectedModelId: '', allowUserModelOverride: false, extraConfig: {} };
    return {
      selectedModelId: row.selected_model_id || '',
      allowUserModelOverride: row.allow_user_model_override === true,
      extraConfig: row.extra_config || {},
    };
  } catch (error) {
    console.warn('[webapp-code-convert] Failed to fetch agent_settings:', error.message);
    return { selectedModelId: '', allowUserModelOverride: false };
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

async function checkAgentPermissionForUser(user, agentId = '2') {
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

function buildCodeConvertSystemPrompt(sourceLanguage, targetLanguage, explainDifferences) {
  const sourceLang = LANGUAGES.find((l) => l.id === sourceLanguage);
  const targetLang = LANGUAGES.find((l) => l.id === targetLanguage);
  if (!sourceLang || !targetLang) return '';

  const reference = buildConversionReference(sourceLanguage, targetLanguage);

  const lines = [
    `You are an expert at converting ${sourceLang.name} code to ${targetLang.name} code.`,
    '',
    '## Conversion Rules',
    `1. Analyze the ${sourceLang.name} code and write ${targetLang.name} code that performs the same function.`,
    `2. Follow the idiomatic code style of ${targetLang.name}.`,
    `3. Apply the naming conventions of ${targetLang.name}.`,
    '4. Include necessary import/using/include statements.',
    '5. Preserve the meaning of comments but convert them to the comment style of the target language.',
    '6. For features with no direct equivalent, use the closest alternative.',
    '',
    '## Output Format',
    'Output only the converted code. Do not use markdown code blocks (```).',
    'Do not add explanations before or after the code.',
  ];

  if (explainDifferences) {
    lines.push('');
    lines.push('## Conversion Explanation');
    lines.push('After the code conversion, explain the key differences and notes after the following separator.');
    lines.push('Separator: <!-- EXPLANATION -->');
    lines.push('Include the following in your explanation:');
    lines.push('- Key syntax differences');
    lines.push('- Changes due to type system differences');
    lines.push('- Library/package differences');
    lines.push('- Behavioral differences to be aware of (e.g., integer division, null handling, etc.)');
  }

  if (reference) {
    lines.push('');
    lines.push('## Reference Data');
    lines.push(reference);
  }

  return lines.join('\n');
}

export async function GET(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const hasPermission = await checkAgentPermissionForUser(authResult.user, '2');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to access the Code Converter.' },
        { status: 403 }
      );
    }

    const settings = await getAgent2Settings();
    const modelOptions = await getModelOptionsForRole(authResult.user?.role || 'user');
    return NextResponse.json({
      settings,
      modelOptions,
      languages: LANGUAGES.map((l) => ({ id: l.id, name: l.name, extension: l.extension })),
    });
  } catch (error) {
    console.error('[webapp-code-convert:GET] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Code Converter settings.' },
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
    const hasPermission = await checkAgentPermissionForUser(authResult.user, '2');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to access the Code Converter.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const sourceCode = String(body?.sourceCode || '').trim();
    const sourceLanguage = String(body?.sourceLanguage || '').trim();
    const targetLanguage = String(body?.targetLanguage || '').trim();
    const explainDifferences = body?.explainDifferences === true;
    const requestedModel = String(body?.model || '').trim();

    if (!sourceCode) {
      return NextResponse.json({ error: 'Please enter the source code to convert.' }, { status: 400 });
    }
    if (sourceCode.length > 50000) {
      return NextResponse.json({ error: 'Source code must be 50,000 characters or less.' }, { status: 400 });
    }
    if (!VALID_LANGUAGE_IDS.has(sourceLanguage)) {
      return NextResponse.json({ error: 'Invalid source language.' }, { status: 400 });
    }
    if (!VALID_LANGUAGE_IDS.has(targetLanguage)) {
      return NextResponse.json({ error: 'Invalid target language.' }, { status: 400 });
    }
    if (sourceLanguage === targetLanguage) {
      return NextResponse.json({ error: 'Source and target languages must be different.' }, { status: 400 });
    }

    const settings = await getAgent2Settings();
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
    const systemPrompt = buildCodeConvertSystemPrompt(sourceLanguage, targetLanguage, explainDifferences);

    const sourceLang = LANGUAGES.find((l) => l.id === sourceLanguage);
    const targetLang = LANGUAGES.find((l) => l.id === targetLanguage);

    const prompt = [
      `Please convert the following ${sourceLang.name} code to ${targetLang.name}.`,
      '',
      `[${sourceLang.name} Source Code]`,
      sourceCode,
    ].join('\n');

    const localPort = process.env.PORT || 3000;
    const localOrigin = `http://127.0.0.1:${localPort}`;
    const authHeader = request.headers.get('authorization') || '';
    const timeoutMs = 180000;
    const upstreamController = new AbortController();
    const upstreamTimeout = setTimeout(() => upstreamController.abort(), timeoutMs);

    const llmUrl = `${localOrigin}/api/webapp-generate`;
    const userId = authResult.user?.sub || authResult.user?.id || '';
    const llmStartTime = Date.now();

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(llmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        signal: upstreamController.signal,
        body: JSON.stringify({
          model: resolvedModelName,
          question: prompt,
          prompt,
          requestPurpose: 'code-convert',
          multiturnHistory: [{ role: 'system', text: systemPrompt }],
          stream: true,
          options: {
            temperature: 0.2,
            max_length: 4000,
          },
        }),
      });
    } catch (error) {
      const llmElapsed = Date.now() - llmStartTime;
      logExternalApiRequest({
        sourceType: 'internal',
        provider: 'model-server',
        apiType: 'code-convert',
        endpoint: llmUrl,
        model: resolvedModelName,
        promptTokenCount: prompt.length,
        responseTokenCount: 0,
        responseTime: llmElapsed,
        statusCode: error?.name === 'AbortError' ? 504 : 500,
        isStream: true,
        jwtUserId: userId,
        error: error?.message,
      }).catch(() => {});

      if (error?.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Code conversion timed out. Please try again later.' },
          { status: 504 }
        );
      }
      throw error;
    } finally {
      clearTimeout(upstreamTimeout);
    }

    const llmElapsed = Date.now() - llmStartTime;

    if (!upstreamResponse.ok) {
      const text = await upstreamResponse.text().catch(() => '');
      logExternalApiRequest({
        sourceType: 'internal',
        provider: 'model-server',
        apiType: 'code-convert',
        endpoint: llmUrl,
        model: resolvedModelName,
        promptTokenCount: prompt.length,
        responseTokenCount: text.length,
        responseTime: llmElapsed,
        statusCode: upstreamResponse.status,
        isStream: true,
        jwtUserId: userId,
        error: text,
      }).catch(() => {});

      return NextResponse.json(
        { error: `Code conversion request failed (HTTP ${upstreamResponse.status})`, details: text },
        { status: upstreamResponse.status }
      );
    }

    // Success logging (streaming, so response length is not known yet — logged as 0)
    logExternalApiRequest({
      sourceType: 'internal',
      provider: 'model-server',
      apiType: 'code-convert',
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
        const relayPayload = (rawPayload) => {
          if (!rawPayload) return false;
          if (rawPayload === '[DONE]') {
            emitDone();
            return true;
          }
          try {
            const parsed = JSON.parse(rawPayload);
            if (parsed?.done === true) {
              emitDone();
              return true;
            }
            controller.enqueue(encoder.encode(`data: ${rawPayload}\n\n`));
          } catch {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: rawPayload } }] })}\n\n`));
          }
          return false;
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;
              if (isSSE && (trimmedLine.startsWith(':') || trimmedLine.startsWith('event:'))) continue;

              const data = trimmedLine.startsWith('data:')
                ? trimmedLine.slice(5).trim()
                : trimmedLine;
              if (!data) continue;
              const shouldClose = relayPayload(data);
              if (shouldClose) return;
            }
          }

          const remaining = buffer.trim();
          if (remaining && !(isSSE && (remaining.startsWith(':') || remaining.startsWith('event:')))) {
            const payload = remaining.startsWith('data:') ? remaining.slice(5).trim() : remaining;
            if (payload) relayPayload(payload);
          }

          emitDone();
        } catch (error) {
          if (!streamClosed) {
            const fallback = error?.message || 'An error occurred while processing the code conversion stream.';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `\n[Error] ${fallback}` } }] })}\n\n`));
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
    console.error('[webapp-code-convert] error:', error);
    return NextResponse.json(
      { error: 'Failed to process the code conversion request.' },
      { status: 500 }
    );
  }
}
