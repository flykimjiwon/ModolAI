import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  getNextModelServerEndpointWithIndex,
  getModelServerEndpointByName,
  getModelServerEndpointByLabel,
  parseModelName,
} from '@/lib/modelServers';
import { logExternalApiRequest } from '@/lib/externalApiLogger';
import { getClientIP } from '@/lib/ip';
import { JWT_SECRET } from '@/lib/config';

// OpenAI 호환 Legacy Completions API (FIM / Autocomplete 전용)
// Continue 등 IDE 확장에서 useLegacyCompletionsEndpoint: true 설정 시 이 경로로 요청
// 요청: { model, prompt, suffix?, max_tokens?, temperature?, stop?, stream? }
// 응답: { id, object: "text_completion", choices: [{ text, index, finish_reason }], usage }

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Name, X-Client-Version, X-User-Id',
};

const createCompletionId = () =>
  `cmpl-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

// ─── API 토큰 검증 (chat/completions와 동일 패턴) ────────────────────────────
async function verifyApiToken(token) {
  try {
    const tokenPayload = jwt.verify(token, JWT_SECRET);

    if (tokenPayload.type !== 'api_token') {
      return { valid: false, error: 'Invalid token type. API token required.' };
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')
      .substring(0, 16);

    const { query } = await import('@/lib/postgres');
    const userId = tokenPayload.sub || tokenPayload.id;

    const tokenResult = await query(
      'SELECT * FROM api_tokens WHERE token_hash = $1 AND user_id = $2 LIMIT 1',
      [tokenHash, userId]
    );

    if (tokenResult.rows.length === 0) {
      return { valid: false, error: 'API token not found.' };
    }

    const apiToken = tokenResult.rows[0];

    if (!apiToken.is_active) {
      return { valid: false, error: 'API token is inactive.' };
    }

    if (apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
      return { valid: false, error: 'API token has expired.' };
    }

    if (tokenPayload.exp && tokenPayload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'API token has expired.' };
    }

    // 마지막 사용 시각 업데이트
    await query('UPDATE api_tokens SET last_used_at = $1 WHERE id = $2', [
      new Date(),
      apiToken.id,
    ]);

    return {
      valid: true,
      userInfo: {
        userId: tokenPayload.sub || tokenPayload.id,
        email: tokenPayload.email,
        name: tokenPayload.name,
        role: tokenPayload.role,
        department: tokenPayload.department,
        cell: tokenPayload.cell,
      },
      tokenInfo: {
        tokenHash,
        tokenId: apiToken.id.toString(),
        name: apiToken.name,
      },
    };
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Invalid API token.' };
    }
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'API token has expired.' };
    }
    console.error('[v1/completions] 토큰 검증 오류:', error);
    return { valid: false, error: 'Token verification failed.' };
  }
}

// ─── 모델 서버 엔드포인트 결정 (embeddings와 동일 패턴) ──────────────────────
async function resolveEndpoint(modelId) {
  if (modelId) {
    const { serverName, modelName } = parseModelName(modelId);
    if (serverName) {
      const serverEndpoint = await getModelServerEndpointByName(serverName);
      if (serverEndpoint) return { ...serverEndpoint, modelName };
    }

    const labelEndpoint = await getModelServerEndpointByLabel(modelId);
    if (labelEndpoint) return { ...labelEndpoint, modelName: modelId };
  }

  const fallback = await getNextModelServerEndpointWithIndex();
  if (!fallback?.endpoint) return null;
  return { ...fallback, modelName: modelId };
}

function buildOpenAiUrl(endpoint, path) {
  const trimmed = endpoint.replace(/\/+$/, '');
  if (trimmed.endsWith('/v1')) return `${trimmed}${path}`;
  return `${trimmed}/v1${path}`;
}

// ─── Ollama /api/generate 스트리밍 → OpenAI SSE 변환 ────────────────────────
function ollamaStreamToCompletionSSE(ollamaStream, model, completionId) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = ollamaStream.getReader();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line);
              const text = chunk.response ?? '';
              const isDone = chunk.done === true;

              const sseChunk = {
                id: completionId,
                object: 'text_completion',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [
                  {
                    text,
                    index: 0,
                    finish_reason: isDone ? 'stop' : null,
                  },
                ],
              };

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(sseChunk)}\n\n`)
              );

              if (isDone) {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              }
            } catch {
              // 파싱 실패 라인 무시
            }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });
}

// ─── 핸들러 ──────────────────────────────────────────────────────────────────
export async function POST(request) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);
  const userAgent =
    request.headers.get('user-agent') ||
    request.headers.get('x-client-name') ||
    'unknown';

  // 인증
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        error: {
          message:
            'Authorization header is required. Please provide a valid API token.',
          type: 'invalid_request_error',
        },
      },
      { status: 401, headers: corsHeaders }
    );
  }

  const token = authHeader.split(' ')[1];
  const verificationResult = await verifyApiToken(token);
  if (!verificationResult.valid) {
    return NextResponse.json(
      {
        error: {
          message: verificationResult.error || 'Invalid API token.',
          type: 'invalid_request_error',
        },
      },
      { status: 401, headers: corsHeaders }
    );
  }

  const { userInfo } = verificationResult;

  try {
    const body = await request.json().catch(() => ({}));
    const {
      model,
      prompt,
      suffix,
      max_tokens,
      temperature,
      stop,
      stream: isStream = false,
    } = body;

    if (!model) {
      return NextResponse.json(
        {
          error: {
            message: 'model is required.',
            type: 'invalid_request_error',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (prompt == null) {
      return NextResponse.json(
        {
          error: {
            message: 'prompt is required.',
            type: 'invalid_request_error',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 엔드포인트 결정
    const endpointInfo = await resolveEndpoint(model);
    if (!endpointInfo) {
      return NextResponse.json(
        {
          error: {
            message: 'No model server endpoint available.',
            type: 'server_error',
          },
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const { endpoint, provider, modelName, apiKey } = endpointInfo;
    const resolvedModel = modelName || model;
    const completionId = createCompletionId();

    // ── OpenAI-compatible: /v1/completions 그대로 전달 ──────────────────────
    if (provider === 'openai-compatible') {
      const targetUrl = buildOpenAiUrl(endpoint, '/completions');
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, model: resolvedModel }),
        signal: AbortSignal.timeout(60000),
      });

      if (isStream) {
        return new Response(response.body, {
          status: response.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }

      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, {
        status: response.status,
        headers: corsHeaders,
      });
    }

    // ── Ollama: /api/generate 로 매핑 ────────────────────────────────────────
    // Continue는 FIM 토큰을 prompt 안에 직접 넣어서 보내므로
    // suffix는 별도로 처리하지 않고 prompt를 그대로 전달
    const ollamaPrompt = Array.isArray(prompt)
      ? prompt.join('')
      : String(prompt);

    const ollamaBody = {
      model: resolvedModel,
      prompt: ollamaPrompt,
      raw: true,
      stream: Boolean(isStream),
      options: {
        ...(temperature != null && { temperature }),
        ...(max_tokens != null && { num_predict: max_tokens }),
        ...(stop != null && {
          stop: Array.isArray(stop) ? stop : [stop],
        }),
      },
    };

    // suffix가 있으면 Ollama suffix 필드에 전달 (일부 FIM 모델 지원)
    if (suffix != null) {
      ollamaBody.suffix = String(suffix);
    }

    const targetUrl = `${endpoint.replace(/\/+$/, '')}/api/generate`;

    // 스트리밍 응답
    if (isStream) {
      const ollamaRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ollamaBody),
        signal: AbortSignal.timeout(60000),
      });

      if (!ollamaRes.ok || !ollamaRes.body) {
        return NextResponse.json(
          {
            error: {
              message: `Model server error: ${ollamaRes.status}`,
              type: 'server_error',
            },
          },
          { status: ollamaRes.status, headers: corsHeaders }
        );
      }

      const sseStream = ollamaStreamToCompletionSSE(
        ollamaRes.body,
        resolvedModel,
        completionId
      );

      return new Response(sseStream, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // 비스트리밍 응답
    const ollamaRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaBody),
      signal: AbortSignal.timeout(60000),
    });

    const ollamaData = await ollamaRes.json().catch(() => ({}));

    if (!ollamaRes.ok) {
      return NextResponse.json(
        {
          error: {
            message:
              ollamaData.error ||
              `Model server error: ${ollamaRes.status}`,
            type: 'server_error',
          },
        },
        { status: ollamaRes.status, headers: corsHeaders }
      );
    }

    // Ollama → OpenAI text_completion 형식 변환
    const openAIResponse = {
      id: completionId,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      model: resolvedModel,
      choices: [
        {
          text: ollamaData.response ?? '',
          index: 0,
          finish_reason: ollamaData.done ? 'stop' : 'length',
        },
      ],
      usage: {
        prompt_tokens: ollamaData.prompt_eval_count ?? 0,
        completion_tokens: ollamaData.eval_count ?? 0,
        total_tokens:
          (ollamaData.prompt_eval_count ?? 0) +
          (ollamaData.eval_count ?? 0),
      },
    };

    // 외부 API 로깅
    try {
      await logExternalApiRequest({
        userId: userInfo?.userId,
        apiType: 'completions',
        model: resolvedModel,
        endpoint: '/v1/completions',
        requestSize: JSON.stringify(body).length,
        responseSize: JSON.stringify(openAIResponse).length,
        responseTime: Date.now() - startTime,
        statusCode: 200,
        clientIP,
        userAgent,
      });
    } catch {
      // 로깅 실패는 응답에 영향 없음
    }

    return NextResponse.json(openAIResponse, {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('[v1/completions] 서버 오류:', error);
    return NextResponse.json(
      {
        error: {
          message: error.message || 'Internal server error',
          type: 'server_error',
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}
