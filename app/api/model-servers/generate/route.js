import { NextResponse } from 'next/server';
import {
  getNextModelServerEndpointWithIndex,
  parseModelName,
  getModelServerEndpointByName,
} from '@/lib/modelServers';
import { logQARequest } from '@/lib/qaLogger';
import { logExternalApiRequest } from '@/lib/externalApiLogger';
import { fetchWithRetry } from '@/lib/retryUtils';

// 간단한 로그 기록 함수
async function logModelServerProxyRequest(data) {
  try {
    const { query } = await import('@/lib/postgres');

    // metadata에 추가 정보 포함 (null/undefined 제외)
    const metadata = {
      endpoint: data.endpoint || '',
      ...(data.responseTime && { responseTime: `${data.responseTime}ms` }),
      method: data.method || 'POST',
      model: data.model || 'unknown',
      ...(data.statusCode && { responseStatus: data.statusCode }),
      ...(data.responseSize && { responseSize: data.responseSize }),
      ...(data.requestSize && { requestSize: data.requestSize }),
      ...(data.isStream !== undefined && { isStream: data.isStream }),
      ...(data.roundRobinIndex !== null &&
        data.roundRobinIndex !== undefined && {
          roundRobinIndex: data.roundRobinIndex,
        }),
      ...(data.promptTokens && { promptTokens: data.promptTokens }),
      ...(data.completionTokens && { completionTokens: data.completionTokens }),
      ...(data.totalTokens && { totalTokens: data.totalTokens }),
      ...(data.hasFiles && { hasFiles: data.hasFiles }),
      ...(data.fileCount && { fileCount: data.fileCount }),
      ...(data.clientIP && { clientIP: data.clientIP }),
      ...(data.userAgent && { userAgent: data.userAgent }),
    };

    // null/undefined 값 제거
    Object.keys(metadata).forEach((key) => {
      if (
        metadata[key] === null ||
        metadata[key] === undefined ||
        metadata[key] === ''
      ) {
        delete metadata[key];
      }
    });

    await query(
      `INSERT INTO model_logs (type, level, category, method, endpoint, model, message, error, timestamp, metadata, provider, client_ip, user_agent, response_time, status_code, is_stream, prompt_tokens, completion_tokens, total_tokens, has_files, file_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        'model_server_proxy',
        data.level || 'info',
        data.category || 'model_server_proxy',
        data.method || 'POST',
        data.endpoint || '',
        data.model || 'unknown',
        data.message || null,
        data.error || null,
        data.timestamp || new Date(),
        JSON.stringify(metadata),
        data.provider || 'model-server',
        data.clientIP || null,
        data.userAgent || null,
        data.responseTime || null,
        data.statusCode || null,
        data.isStream !== undefined ? data.isStream : null,
        data.promptTokens || null,
        data.completionTokens || null,
        data.totalTokens || null,
        data.hasFiles || null,
        data.fileCount || null,
      ]
    );
  } catch (error) {
    console.error('로그 기록 실패:', error);
  }
}

// VSCode Continue 전용 단순 모델 서버 프록시
// 라운드로빈 로드밸런싱만 추가된 순수 모델 서버 API

export async function POST(request) {
  const startTime = Date.now();
  const clientIP =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // 외부 API 로깅을 위한 추가 헤더 정보 수집
  const identificationHeaders = {
    // === 기본 프록시 정보 ===
    xForwardedFor: request.headers.get('x-forwarded-for'),
    xRealIP: request.headers.get('x-real-ip'),
    xForwardedProto: request.headers.get('x-forwarded-proto'),
    xForwardedHost: request.headers.get('x-forwarded-host'),

    // === 클라이언트 정보 ===
    acceptLanguage: request.headers.get('accept-language'),
    acceptEncoding: request.headers.get('accept-encoding'),
    acceptCharset: request.headers.get('accept-charset'),
    referer: request.headers.get('referer'),
    origin: request.headers.get('origin'),
    contentType: request.headers.get('content-type'),

    // === 보안 및 인증 ===
    authorization: request.headers.get('authorization') ? 'present' : 'absent',

    // === 커스텀 식별 헤더 ===
    xRequestedWith: request.headers.get('x-requested-with'),
    xClientName: request.headers.get('x-client-name'),
    xClientVersion: request.headers.get('x-client-version'),
    xUserName: request.headers.get('x-user-name'),
    xWorkspace: request.headers.get('x-workspace'),
    xSessionId: request.headers.get('x-session-id'),

    // === 타임존 정보 ===
    timezone:
      request.headers.get('x-timezone') ||
      request.headers.get('timezone') ||
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  // CORS 헤더 설정 (VSCode Continue에서 접근 가능)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // 요청 본문 그대로 받기 - 빈 요청 처리
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('[Model Server Proxy] JSON 파싱 오류:', jsonError);
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
          message: '요청 본문이 올바른 JSON 형식이 아닙니다.',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 필수 필드 검증
    if (!body.model || !body.prompt) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'model과 prompt 필드는 필수입니다.',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[Model Server Proxy] 요청:', {
      model: body.model,
      prompt: body.prompt?.length || 0,
      stream: body.stream,
      ip: clientIP,
    });

    // 모델 이름에서 서버 이름 파싱하여 해당 서버 그룹에서만 라운드로빈
    let modelServerEndpoint;
    let roundRobinIndex;
    let provider = 'model-server'; // 기본값

    let { serverName } = parseModelName(body.model);

    // 모델 ID에서 서버 이름을 파싱하지 못한 경우, DB 설정에서 확인
    if (!serverName) {
      const { getServerNameForModel } = await import('@/lib/modelServers');
      const dbServerName = await getServerNameForModel(body.model);
      if (dbServerName) {
        serverName = dbServerName;
        console.log(
          `[Model Server Proxy] DB 설정에서 서버 그룹 찾음: "${body.model}" -> "${serverName}"`
        );
      }
    }

    if (serverName) {
      // 서버 이름이 있으면 해당 서버 그룹에서만 라운드로빈
      const serverEndpoint = await getModelServerEndpointByName(serverName);
      if (serverEndpoint) {
        modelServerEndpoint = serverEndpoint.endpoint;
        roundRobinIndex = serverEndpoint.index;
        provider = serverEndpoint.provider || 'model-server';
        console.log(
          `[Model Server Proxy] 모델 "${body.model}" -> 서버 그룹 "${serverName}" -> 엔드포인트: ${modelServerEndpoint} (RR: ${roundRobinIndex}, Provider: ${provider})`
        );
      } else {
        // 서버 이름으로 찾지 못하면 전체 라운드로빈 사용
        console.warn(
          `[Model Server Proxy] 서버 그룹 "${serverName}"을 찾을 수 없어 전체 라운드로빈 사용`
        );
        const next = await getNextModelServerEndpointWithIndex();
        modelServerEndpoint = next.endpoint;
        roundRobinIndex = next.index;
        provider = next.provider || 'model-server';
      }
    } else {
      // 서버 이름이 없으면 전체 라운드로빈 사용
      const next = await getNextModelServerEndpointWithIndex();
      modelServerEndpoint = next.endpoint;
      roundRobinIndex = next.index;
      provider = next.provider || 'model-server';
    }

    const modelServerUrl = `${modelServerEndpoint}/api/generate`;

    console.log(
      `[Model Server Proxy] 인스턴스 ${roundRobinIndex}: ${modelServerUrl}`
    );

    // 원본 요청의 헤더를 복사하되, 일부는 수정/제외합니다.
    const headersToForward = {};
    request.headers.forEach((value, key) => {
      // 'host' 헤더는 fetch가 자동으로 설정하므로 전달하지 않습니다.
      // 'content-length'는 body 길이에 따라 fetch가 설정하므로 전달하지 않습니다.
      if (!['host', 'content-length'].includes(key.toLowerCase())) {
        headersToForward[key] = value;
      }
    });
    // Content-Type은 항상 application/json으로 설정합니다.
    headersToForward['Content-Type'] = 'application/json';

    // --- 상세 디버그 로그 추가 ---
    console.log(
      '\n\n[MODEL SERVER PROXY DEBUG] ======================================='
    );
    console.log('[MODEL SERVER PROXY DEBUG] 최종 요청 정보:');
    console.log('[MODEL SERVER PROXY DEBUG]   - 목적지 URL:', modelServerUrl);
    console.log('[MODEL SERVER PROXY DEBUG]   - 메소드:', 'POST');
    console.log(
      '[MODEL SERVER PROXY DEBUG]   - 전달되는 헤더:',
      JSON.stringify(headersToForward, null, 2)
    );
    console.log(
      '[MODEL SERVER PROXY DEBUG]   - 요청 Body의 키:',
      Object.keys(body)
    );
    console.log(
      '[MODEL SERVER PROXY DEBUG] =======================================\n\n'
    );
    // --- 디버그 로그 끝 ---


    // 재시도 시 provider 업데이트를 위한 참조 객체
    const providerRef = { value: provider };

    let modelServerRes;
    try {
      modelServerRes = await fetchWithRetry(
        modelServerUrl,
        {
          method: 'POST',
          headers: headersToForward, // 수정된 헤더 사용
          body: JSON.stringify(body),
        },
        {
          maxRetries: 2, // 최대 2회 재시도 (총 3회 시도)
          isStreaming: body.stream !== false,
          getNextEndpoint: getNextModelServerEndpointWithIndex,
          providerRef: providerRef,
          endpointPath: '/api/generate',
        }
      );

      // 재시도 후 최종 provider 업데이트
      provider = providerRef.value;
    } catch (fetchError) {
      // fetch 실패 처리
      const responseTime = Date.now() - startTime;
      const errorMessage = fetchError.message || 'Unknown error';

      console.error('[Model Server Proxy] 모델 서버 연결 오류:', {
        url: modelServerUrl,
        error: errorMessage,
        type: fetchError.name || 'Unknown',
        code: fetchError.code,
      });

      await logModelServerProxyRequest({
        provider: providerRef.value,
        level: 'error',
        category: 'model_server_proxy',
        method: 'POST',
        endpoint: modelServerUrl,
        model: body.model,
        clientIP,
        userAgent,
        responseTime,
        statusCode: 503,
        isStream: body.stream !== false,
        error: `Connection error: ${errorMessage}`,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });

      return NextResponse.json(
        {
          error: 'Model server connection error',
          message: `Failed to connect to model server: ${errorMessage}`,
        },
        { status: 503, headers: corsHeaders }
      );
    }

    if (!modelServerRes.ok) {
      const errorText = await modelServerRes.text();
      console.error(
        `[Model Server Proxy] 오류: ${modelServerRes.status} ${modelServerRes.statusText}`,
        errorText
      );

      // 오류 로그 기록
      await logModelServerProxyRequest({
        provider: provider,
        level: 'error',
        category: 'model_server_proxy',
        method: 'POST',
        endpoint: modelServerUrl,
        model: body.model,
        clientIP,
        userAgent,
        responseTime: Date.now() - startTime,
        statusCode: modelServerRes.status,
        isStream: body.stream !== false,
        error: errorText,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });

      return NextResponse.json(
        {
          error: `모델 Server error: ${modelServerRes.status}`,
          details: errorText,
        },
        { status: modelServerRes.status, headers: corsHeaders }
      );
    }

    // 응답 타입 확인
    const contentType = modelServerRes.headers.get('content-type') || '';

    if (body.stream !== false) {
      // 스트리밍 응답 - 응답 텍스트 수집하면서 전달
      const responseTime = Date.now() - startTime;

      // 스트리밍 응답에서 텍스트 수집
      let accumulatedResponse = '';
      const reader = modelServerRes.body.getReader();
      const decoder = new TextDecoder();

      const stream = new ReadableStream({
        start(controller) {
          function pump() {
            return reader.read().then(({ done, value }) => {
              if (done) {
                // 스트리밍 완료 시 토큰 수 계산해서 로깅
                const promptTokens = body.prompt?.length || 0;
                const responseTokens = accumulatedResponse.length;

                // 로깅 (지연 실행)
                Promise.all([
                  logModelServerProxyRequest({
                    provider: provider,
                    level: 'info',
                    category: 'model_server_proxy',
                    method: 'POST',
                    endpoint: modelServerUrl,
                    model: body.model,
                    clientIP,
                    userAgent,
                    responseTime,
                    statusCode: modelServerRes.status,
                    isStream: true,
                    promptTokens,
                    completionTokens: responseTokens,
                    totalTokens: promptTokens + responseTokens,
                  }),
                  logQARequest({
                    clientIP,
                    model: body.model,
                    prompt: body.prompt,
                    response:
                      accumulatedResponse.substring(0, 500) +
                      (accumulatedResponse.length > 500 ? '...' : ''),
                    isStream: true,
                    responseTime,
                    statusCode: modelServerRes.status,
                  }),
                  logExternalApiRequest({
                    sourceType: 'internal',
                    provider: provider,
                    apiType: 'generate',
                    endpoint: modelServerUrl,
                    model: body.model,
                    prompt: body.prompt,
                    promptTokenCount: promptTokens,
                    responseTokenCount: responseTokens,
                    responseTime,
                    statusCode: modelServerRes.status,
                    isStream: true,
                    clientIP,
                    userAgent,
                    ...identificationHeaders,
                  }),
                ]).catch((err) => console.error('로깅 실패:', err));

                controller.close();
                return;
              }

              // 응답 텍스트 추출 및 누적
              const chunk = decoder.decode(value, { stream: true });
              try {
                const lines = chunk.split('\n').filter((line) => line.trim());
                for (const line of lines) {
                  try {
                    const parsed = JSON.parse(line);
                    if (parsed.response) {
                      accumulatedResponse += parsed.response;
                    }
                  } catch (e) {
                    if (process.env.NODE_ENV === 'development') {
                      console.debug(
                        '[model-server-generate] JSON 파싱 실패:',
                        e?.message || e
                      );
                    }
                  }
                }
              } catch (e) {
                console.warn(
                  '[model-server-generate] 청크 처리 실패:',
                  e?.message || e
                );
              }

              controller.enqueue(value);
              return pump();
            });
          }
          return pump();
        },
      });

      return new Response(stream, {
        status: modelServerRes.status,
        headers: {
          'Content-Type': contentType.includes('application/json')
            ? 'application/json'
            : 'text/plain',
          'Transfer-Encoding': 'chunked',
          ...corsHeaders,
        },
      });
    } else {
      // 일반 JSON 응답 - 응답 파싱 후 로그 기록
      const responseData = await modelServerRes.text();
      const responseTime = Date.now() - startTime;

      // 토큰 수 추정 (정확하지 않지만 대략적 통계용)
      let promptTokens = 0;
      let completionTokens = 0;
      let responseText = '';
      try {
        const parsedResponse = JSON.parse(responseData);
        promptTokens = body.prompt?.length || 0;
        completionTokens = parsedResponse.response?.length || 0;
        responseText = parsedResponse.response || '';
      } catch (e) {
        responseText = responseData;
        console.warn(
          '[model-server-generate] JSON 파싱 실패, 원문 사용:',
          e?.message || e
        );
      }

      await logModelServerProxyRequest({
        provider: provider,
        level: 'info',
        category: 'model_server_proxy',
        method: 'POST',
        endpoint: modelServerUrl,
        model: body.model,
        clientIP,
        userAgent,
        responseTime,
        statusCode: modelServerRes.status,
        isStream: false,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      });

      // Q&A 로그 기록 (비스트리밍 - 답변 포함)
      await logQARequest({
        clientIP,
        model: body.model,
        prompt: body.prompt,
        response: responseText,
        isStream: false,
        responseTime,
        statusCode: modelServerRes.status,
      });

      // 외부 API 전용 로깅 (일반 응답)
      await logExternalApiRequest({
        sourceType: 'internal',
        provider: provider,
        apiType: 'generate',
        endpoint: modelServerUrl,
        model: body.model,
        prompt: body.prompt,
        promptTokenCount: promptTokens,
        responseTokenCount: completionTokens,
        responseTime,
        statusCode: modelServerRes.status,
        isStream: false,
        clientIP,
        userAgent,
        ...identificationHeaders,
      });

      console.log(`[Model Server Proxy] 완료: ${responseTime}ms`);

      return new Response(responseData, {
        status: modelServerRes.status,
        headers: {
          'Content-Type': contentType || 'application/json',
          ...corsHeaders,
        },
      });
    }
  } catch (error) {
    console.error('[Model Server Proxy] Server error:', error);

    // Server error 로그 기록
    await logModelServerProxyRequest({
      provider: provider || 'model-server',
      level: 'error',
      category: 'model_server_proxy',
      method: 'POST',
      endpoint: 'unknown',
      model: 'unknown',
      clientIP,
      userAgent,
      responseTime: Date.now() - startTime,
      statusCode: 500,
      isStream: false,
      error: error.message,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });

    return NextResponse.json(
      {
        error: 'Proxy server error',
        message: error.message,
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS(request) {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
