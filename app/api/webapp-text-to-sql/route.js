import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { resolveModelId, getDefaultModel } from '@/lib/modelServers';
import { logExternalApiRequest } from '@/lib/externalApiLogger';
import {
  DIALECTS,
  formatDialectInfo,
  formatFunctionMapping,
  formatQueryPatterns,
  formatOptimizationTips,
} from '@/lib/agent-data/text-to-sql';

const VALID_DIALECT_IDS = new Set(DIALECTS.map((d) => d.id));

async function getAgent3Settings() {
  try {
    const result = await query(
      `SELECT selected_model_id, allow_user_model_override, extra_config
       FROM agent_settings
       WHERE agent_id = $1
       LIMIT 1`,
      ['3']
    );
    const row = result.rows[0];
    if (!row) return { selectedModelId: '', allowUserModelOverride: false };
    return {
      selectedModelId: row.selected_model_id || '',
      allowUserModelOverride: row.allow_user_model_override === true,
    };
  } catch (error) {
    console.warn('[webapp-text-to-sql] Failed to fetch agent_settings:', error.message);
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

async function checkAgentPermissionForUser(user, agentId = '3') {
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

function buildTextToSqlSystemPrompt({ dialect, schema }) {
  const dialectInfo = formatDialectInfo(dialect);
  const functionMapping = formatFunctionMapping(dialect);
  const queryPatterns = formatQueryPatterns(dialect);
  const optimizationTips = formatOptimizationTips();

  const parts = [
    'You are an expert at converting natural language to SQL.',
    '',
    '## Target SQL Dialect',
    dialectInfo,
    '',
    '## User-Provided Schema (DDL)',
    schema || '(No schema provided. Write using general patterns.)',
    '',
    '## Function Reference (for this dialect)',
    functionMapping,
    '',
    '## Query Pattern Reference',
    queryPatterns,
    '',
    '## Optimization Tips',
    optimizationTips,
    '',
    '## Response Rules',
    '1. Always respond in the following format:',
    '',
    '### SQL',
    '```sql',
    '(generated SQL query)',
    '```',
    '',
    '### 쿼리 설명',
    '(What the query does, which tables/joins/conditions were used, step by step)',
    '',
    '### 최적화 팁',
    '(Tips for improving this query\'s performance: indexes, execution plans, etc.)',
    '',
    '2. Use the exact syntax and functions of the target dialect.',
    '3. Only use table and column names that exist in the user schema.',
    '4. Do not invent columns that are not in the schema.',
    '5. Use CTEs for complex queries to improve readability.',
    '6. Write the query explanation in Korean.',
    '7. Make optimization tips practical and specific.',
  ];

  return parts.join('\n');
}

export async function GET(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const hasPermission = await checkAgentPermissionForUser(authResult.user, '3');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to access Text to SQL.' },
        { status: 403 }
      );
    }

    const settings = await getAgent3Settings();
    const modelOptions = await getModelOptionsForRole(authResult.user?.role || 'user');
    const dialects = DIALECTS.map((d) => ({ id: d.id, name: d.name, description: d.description }));
    return NextResponse.json({ settings, modelOptions, dialects });
  } catch (error) {
    console.error('[webapp-text-to-sql:GET] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Text to SQL settings.' },
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
    const hasPermission = await checkAgentPermissionForUser(authResult.user, '3');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to access Text to SQL.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const question = String(body?.question || '').trim();
    const schema = String(body?.schema || '').trim();
    const dialect = String(body?.dialect || 'postgresql').trim();
    const requestedModel = String(body?.model || '').trim();

    if (!question) {
      return NextResponse.json({ error: 'Please enter a question.' }, { status: 400 });
    }
    if (question.length > 2000) {
      return NextResponse.json({ error: 'Question must be 2,000 characters or less.' }, { status: 400 });
    }
    if (schema.length > 10000) {
      return NextResponse.json({ error: 'Schema must be 10,000 characters or less.' }, { status: 400 });
    }
    if (!VALID_DIALECT_IDS.has(dialect)) {
      return NextResponse.json({ error: 'Unsupported SQL dialect.' }, { status: 400 });
    }

    const settings = await getAgent3Settings();
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
    const systemPrompt = buildTextToSqlSystemPrompt({ dialect, schema });

    const dialectName = DIALECTS.find((d) => d.id === dialect)?.name || dialect;
    const prompt = [
      `SQL Dialect: ${dialectName}`,
      schema ? `Schema:\n${schema}` : 'Schema: none',
      `Question: ${question}`,
      'Generate a SQL query matching the schema and dialect above, along with a query explanation and optimization tips.',
    ].join('\n');

    const localPort = process.env.PORT || 3000;
    const localOrigin = `http://127.0.0.1:${localPort}`;
    const authHeader = request.headers.get('authorization') || '';
    const timeoutMs = 180000;
    const upstreamController = new AbortController();
    const upstreamTimeout = setTimeout(() => upstreamController.abort(), timeoutMs);

    const llmUrl = `${localOrigin}/api/webapp-generate`;
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
          requestPurpose: 'text-to-sql',
          multiturnHistory: [{ role: 'system', text: systemPrompt }],
          stream: true,
          options: {
            temperature: 0.3,
            max_length: 4000,
          },
        }),
      });
    } catch (error) {
      const llmElapsed = Date.now() - llmStartTime;
      logExternalApiRequest({
        sourceType: 'internal',
        provider: 'model-server',
        apiType: 'text-to-sql',
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
          { error: 'SQL generation timed out. Please try again later.' },
          { status: 504 }
        );
      }
      throw error;
    } finally {
      clearTimeout(upstreamTimeout);
    }

    if (!upstreamResponse.ok) {
      const llmElapsed = Date.now() - llmStartTime;
      const text = await upstreamResponse.text().catch(() => '');
      logExternalApiRequest({
        sourceType: 'internal',
        provider: 'model-server',
        apiType: 'text-to-sql',
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
        { error: `SQL generation request failed (HTTP ${upstreamResponse.status})`, details: text },
        { status: upstreamResponse.status }
      );
    }

    // Success logging (streaming — response length logged as 0)
    const llmElapsed = Date.now() - llmStartTime;
    logExternalApiRequest({
      sourceType: 'internal',
      provider: 'model-server',
      apiType: 'text-to-sql',
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

    // SSE streaming passthrough
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();

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
        const isSSE = contentType.includes('text/event-stream');

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
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: rawPayload } }] })}\n\n`
              )
            );
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
            const errMsg = error?.message || 'An error occurred while processing the SQL generation stream.';
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: `\n[Error] ${errMsg}` } }] })}\n\n`
              )
            );
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
    console.error('[webapp-text-to-sql] error:', error);
    return NextResponse.json(
      { error: 'Failed to process the SQL generation request.' },
      { status: 500 }
    );
  }
}
