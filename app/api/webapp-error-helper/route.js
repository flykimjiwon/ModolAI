import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { resolveModelId, getDefaultModel } from '@/lib/modelServers';
import { logExternalApiRequest } from '@/lib/externalApiLogger';
import {
  LANGUAGE_ERRORS,
  FRAMEWORK_ERRORS,
  DATABASE_ERRORS,
  DEVOPS_ERRORS,
  HTTP_STATUS_REFERENCE,
} from '@/lib/agent-data/error-helper';

const AGENT_ID = '5';

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
    console.warn('[webapp-error-helper] Failed to query agent_settings:', error.message);
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

function buildErrorReferencePrompt(language, framework) {
  const sections = [];

  // Language-specific error patterns
  if (language && LANGUAGE_ERRORS[language]) {
    const errors = LANGUAGE_ERRORS[language];
    sections.push(`\n## ${language.toUpperCase()} 주요 에러 패턴 (${errors.length}개)`);
    for (const err of errors) {
      sections.push(`- **${err.name}**: ${err.cause}`);
      sections.push(`  해결: ${err.solution}`);
      if (err.codeExample) {
        sections.push(`  수정 전: \`${err.codeExample.before.replace(/\n/g, ' | ')}\``);
        sections.push(`  수정 후: \`${err.codeExample.after.replace(/\n/g, ' | ')}\``);
      }
    }
  }

  // Framework-specific error patterns
  if (framework && FRAMEWORK_ERRORS[framework]) {
    const errors = FRAMEWORK_ERRORS[framework];
    sections.push(`\n## ${framework.toUpperCase()} 프레임워크 에러 패턴 (${errors.length}개)`);
    for (const err of errors) {
      sections.push(`- **${err.name}**: ${err.cause}`);
      sections.push(`  해결: ${err.solution}`);
    }
  }

  // DB errors (when language/framework is DB-related)
  const dbRelated = ['postgresql', 'mysql', 'mongodb', 'redis'];
  const detectedDb = dbRelated.find((db) => db === language || db === framework);
  if (detectedDb && DATABASE_ERRORS[detectedDb]) {
    const errors = DATABASE_ERRORS[detectedDb];
    sections.push(`\n## ${detectedDb.toUpperCase()} 데이터베이스 에러 패턴 (${errors.length}개)`);
    for (const err of errors) {
      sections.push(`- **${err.name}**: ${err.cause}`);
      sections.push(`  해결: ${err.solution}`);
    }
  }

  // DevOps errors
  const devopsRelated = ['docker', 'kubernetes', 'nginx'];
  const detectedDevops = devopsRelated.find((d) => d === language || d === framework);
  if (detectedDevops && DEVOPS_ERRORS[detectedDevops]) {
    const errors = DEVOPS_ERRORS[detectedDevops];
    sections.push(`\n## ${detectedDevops.toUpperCase()} 에러 패턴 (${errors.length}개)`);
    for (const err of errors) {
      sections.push(`- **${err.name}**: ${err.cause}`);
      sections.push(`  해결: ${err.solution}`);
    }
  }

  // HTTP status reference (always included)
  sections.push('\n## HTTP 상태코드 레퍼런스');
  for (const [code, info] of Object.entries(HTTP_STATUS_REFERENCE)) {
    sections.push(`- **${code} ${info.name}**: ${info.cause} → ${info.solution}`);
  }

  return sections.join('\n');
}

function buildSystemPrompt(language, framework) {
  const referenceData = buildErrorReferencePrompt(language, framework);

  return [
    '당신은 소프트웨어 개발 에러 해결 전문가입니다.',
    '사용자가 제공하는 에러 메시지와 코드를 분석하여 정확한 원인과 해결책을 제시합니다.',
    '',
    '## 응답 형식',
    '반드시 아래 4단계 구조로 응답하세요:',
    '',
    '### 1. 원인 분석',
    '- 에러의 정확한 원인을 설명합니다.',
    '- 에러가 발생하는 메커니즘을 간결하게 설명합니다.',
    '',
    '### 2. 해결 방법',
    '- 단계별로 구체적인 해결 방법을 제시합니다.',
    '- 가장 일반적인 해결책을 먼저 제시합니다.',
    '',
    '### 3. 수정 코드',
    '- 수정 전/후 코드를 비교하여 보여줍니다.',
    '- 코드 블록에 언어를 명시합니다.',
    '',
    '### 4. 예방법',
    '- 같은 에러가 재발하지 않도록 하는 방법을 제시합니다.',
    '- 관련 도구, 린트 규칙, 모범 사례를 추천합니다.',
    '',
    '## 주의사항',
    '- 한국어로 응답하세요.',
    '- 추측보다는 에러 메시지에 기반한 정확한 진단을 우선하세요.',
    '- 코드가 함께 제공된 경우 해당 코드의 문제점을 구체적으로 지적하세요.',
    '- 여러 가능성이 있는 경우 가능성이 높은 순서로 나열하세요.',
    '',
    '## 에러 패턴 레퍼런스 데이터',
    '아래는 정확한 진단을 위한 레퍼런스입니다. 사용자의 에러와 매칭되는 패턴이 있다면 활용하세요.',
    referenceData,
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
        { error: 'You do not have permission to access the error helper.' },
        { status: 403 }
      );
    }

    const settings = await getAgentSettings();
    const modelOptions = await getModelOptionsForRole(authResult.user?.role || 'user');
    return NextResponse.json({ settings, modelOptions });
  } catch (error) {
    console.error('[webapp-error-helper:GET] error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve error helper settings.' },
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
        { error: 'You do not have permission to access the error helper.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const errorMessage = String(body?.errorMessage || '').trim();
    const codeSnippet = String(body?.codeSnippet || '').trim();
    const language = String(body?.language || '').trim().toLowerCase();
    const framework = String(body?.framework || '').trim().toLowerCase();
    const requestedModel = String(body?.model || '').trim();

    if (!errorMessage) {
      return NextResponse.json({ error: 'Please enter an error message.' }, { status: 400 });
    }
    if (errorMessage.length > 5000) {
      return NextResponse.json({ error: 'Error message must be 5000 characters or fewer.' }, { status: 400 });
    }
    if (codeSnippet.length > 10000) {
      return NextResponse.json({ error: 'Code snippet must be 10000 characters or fewer.' }, { status: 400 });
    }

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
    const systemPrompt = buildSystemPrompt(language, framework);

    const promptParts = [`에러 메시지:\n${errorMessage}`];
    if (codeSnippet) {
      promptParts.push(`\n관련 코드:\n\`\`\`${language || ''}\n${codeSnippet}\n\`\`\``);
    }
    if (language) {
      promptParts.push(`\n감지된 언어: ${language}`);
    }
    if (framework) {
      promptParts.push(`감지된 프레임워크: ${framework}`);
    }
    promptParts.push('\n위 에러를 분석하고 해결책을 제시해 주세요.');

    const prompt = promptParts.join('\n');

    const localPort = process.env.PORT || 3000;
    const localOrigin = `http://127.0.0.1:${localPort}`;
    const llmUrl = `${localOrigin}/api/webapp-generate`;
    const authHeader = request.headers.get('authorization') || '';
    const timeoutMs = 180000;
    const upstreamController = new AbortController();
    const upstreamTimeout = setTimeout(() => upstreamController.abort(), timeoutMs);
    const llmStartTime = Date.now();
    const userId = authResult.user?.id || authResult.user?.sub || null;

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
          requestPurpose: 'error-helper',
          multiturnHistory: [{ role: 'system', text: systemPrompt }],
          stream: true,
          options: {
            temperature: 0.3,
            max_length: 4000,
          },
        }),
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        logExternalApiRequest({
          sourceType: 'internal',
          provider: 'model-server',
          apiType: 'error-helper',
          endpoint: llmUrl,
          model: resolvedModelName,
          promptTokenCount: prompt.length,
          responseTokenCount: 0,
          responseTime: Date.now() - llmStartTime,
          statusCode: 504,
          isStream: true,
          error: 'Error analysis timed out (AbortError)',
          jwtUserId: userId,
        }).catch(() => {});
        return NextResponse.json(
          { error: 'Error analysis timed out. Please try again.' },
          { status: 504 }
        );
      }
      throw error;
    } finally {
      clearTimeout(upstreamTimeout);
    }

    if (!upstreamResponse.ok) {
      const text = await upstreamResponse.text().catch(() => '');
      logExternalApiRequest({
        sourceType: 'internal',
        provider: 'model-server',
        apiType: 'error-helper',
        endpoint: llmUrl,
        model: resolvedModelName,
        promptTokenCount: prompt.length,
        responseTokenCount: 0,
        responseTime: Date.now() - llmStartTime,
        statusCode: upstreamResponse.status,
        isStream: true,
        error: `Error analysis request failed (HTTP ${upstreamResponse.status})`,
        jwtUserId: userId,
      }).catch(() => {});
      return NextResponse.json(
        {
          error: `Error analysis request failed (HTTP ${upstreamResponse.status})`,
          details: text,
        },
        { status: upstreamResponse.status }
      );
    }

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

    // SSE stream relay
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
        let streamedLength = 0;

        const emitDone = () => {
          if (streamClosed) return;
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          streamClosed = true;
          logExternalApiRequest({
            sourceType: 'internal',
            provider: 'model-server',
            apiType: 'error-helper',
            endpoint: llmUrl,
            model: resolvedModelName,
            promptTokenCount: prompt.length,
            responseTokenCount: streamedLength,
            responseTime: Date.now() - llmStartTime,
            statusCode: 200,
            isStream: true,
            jwtUserId: userId,
          }).catch(() => {});
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
            streamedLength += rawPayload.length;
            controller.enqueue(encoder.encode(`data: ${rawPayload}\n\n`));
          } catch {
            streamedLength += rawPayload.length;
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
            const errorMsg = JSON.stringify({
              choices: [{ delta: { content: `\n[Error] ${error?.message || 'Stream processing error'}` } }],
            });
            controller.enqueue(encoder.encode(`data: ${errorMsg}\n\n`));
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
    console.error('[webapp-error-helper] error:', error);
    return NextResponse.json(
      { error: 'Failed to process error analysis request.' },
      { status: 500 }
    );
  }
}
