import { NextResponse } from 'next/server';
import {
  getNextModelServerEndpointWithIndex,
  parseModelName,
  getModelServerEndpointByName,
} from '@/lib/modelServers';
// getDB는 더 이상 사용하지 않음
import { logQARequest } from '@/lib/qaLogger';
import { logExternalApiRequest } from '@/lib/externalApiLogger';
import { fetchWithRetry } from '@/lib/retryUtils';

// 간단한 로그 기록 함수 (generate와 동일한 로그 테이블 사용)
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
        'model_server_proxy_chat',
        data.level || 'info',
        data.category || 'model_server_proxy_chat',
        data.method || 'POST',
        data.endpoint || '',
        data.model || 'unknown',
        data.message || null,
        data.error || null,
        new Date(),
        JSON.stringify(metadata),
        data.provider || null,
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

// VSCode Continue 전용 모델 서버 Chat 프록시
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
    xForwardedFor: request.headers.get('x-forwarded-for'),
    xRealIP: request.headers.get('x-real-ip'),
    acceptLanguage: request.headers.get('accept-language'),
    referer: request.headers.get('referer'),
    origin: request.headers.get('origin'),
    authorization: request.headers.get('authorization') ? 'present' : 'absent',
  };

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('[Model Server Chat Proxy] JSON 파싱 오류:', jsonError);
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
          message: '요청 본문이 올바른 JSON 형식이 아닙니다.',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 필수 필드 검증: prompt -> messages
    if (!body.model || !body.messages) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'model과 messages 필드는 필수입니다.',
        },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[Model Server Chat Proxy] 요청:', {
      model: body.model,
      messages: body.messages?.length || 0,
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
          `[Model Server Chat Proxy] DB 설정에서 서버 그룹 찾음: "${body.model}" -> "${serverName}"`
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
          `[Model Server Chat Proxy] 모델 "${body.model}" -> 서버 그룹 "${serverName}" -> 엔드포인트: ${modelServerEndpoint} (RR: ${roundRobinIndex}, Provider: ${provider})`
        );
      } else {
        // 서버 이름으로 찾지 못하면 전체 라운드로빈 사용
        console.warn(
          `[Model Server Chat Proxy] 서버 그룹 "${serverName}"을 찾을 수 없어 전체 라운드로빈 사용`
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

    // API 경로를 /api/chat으로 변경
    const modelServerUrl = `${modelServerEndpoint}/api/chat`;

    console.log(
      `[Model Server Chat Proxy] 인스턴스 ${roundRobinIndex}: ${modelServerUrl}`
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
      '\n\n[MODEL SERVER CHAT PROXY DEBUG] ======================================='
    );
    console.log(
      '[MODEL SERVER CHAT PROXY DEBUG] 최종 요청 정보 (to Model Server Instance):'
    );
    console.log(
      '[MODEL SERVER CHAT PROXY DEBUG]   - 목적지 URL:',
      modelServerUrl
    );
    console.log(
      '[MODEL SERVER CHAT PROXY DEBUG]   - 전달되는 헤더:',
      JSON.stringify(headersToForward, null, 2)
    );
    console.log(
      '[MODEL SERVER CHAT PROXY DEBUG]   - 요청 Body의 키:',
      Object.keys(body)
    );
    console.log(
      '[MODEL SERVER CHAT PROXY DEBUG] =======================================\n\n'
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
          endpointPath: '/api/chat',
        }
      );

      // 재시도 후 최종 provider 업데이트
      provider = providerRef.value;
    } catch (fetchError) {
      // fetch 실패 처리
      const responseTime = Date.now() - startTime;
      const errorMessage = fetchError.message || 'Unknown error';

      console.error('[Model Server Chat Proxy] 모델 서버 연결 오류:', {
        url: modelServerUrl,
        error: errorMessage,
        type: fetchError.name || 'Unknown',
        code: fetchError.code,
      });

      await logModelServerProxyRequest({
        provider: providerRef.value,
        level: 'error',
        category: 'model_server_proxy_chat',
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
        `[Model Server Chat Proxy] 오류: ${modelServerRes.status} ${modelServerRes.statusText}`,
        errorText
      );

      await logModelServerProxyRequest({
        provider: provider,
        level: 'error',
        category: 'model_server_proxy_chat',
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
          error: `모델 서버 오류: ${modelServerRes.status}`,
          details: errorText,
        },
        { status: modelServerRes.status, headers: corsHeaders }
      );
    }

    const contentType = modelServerRes.headers.get('content-type') || '';

    // 프롬프트 토큰 추정 (메시지 내용 길이 합산)
    const promptTokens = body.messages.reduce(
      (acc, msg) => acc + (msg.content?.length || 0),
      0
    );

    if (body.stream !== false) {
      const responseTime = Date.now() - startTime;

      await logModelServerProxyRequest({
        provider: provider,
        level: 'info',
        category: 'model_server_proxy_chat',
        method: 'POST',
        endpoint: modelServerUrl,
        model: body.model,
        clientIP,
        userAgent,
        responseTime,
        statusCode: modelServerRes.status,
        isStream: true,
        promptTokens,
        completionTokens: 0, // 스트리밍에서는 계산 어려움
        totalTokens: promptTokens,
      });

      // Q&A 로그 기록 (스트리밍 - 답변 제외)
      await logQARequest({
        clientIP,
        model: body.model,
        prompt: body.messages, // chat API는 messages 배열을 기록
        response: null,
        isStream: true,
        responseTime,
        statusCode: modelServerRes.status,
      });

      // 외부 API 전용 로깅 (스트리밍)
      await logExternalApiRequest({
        sourceType: 'internal',
        provider: 'model-server',
        apiType: 'chat',
        endpoint: modelServerUrl,
        model: body.model,
        messages: body.messages,
        responseTokenCount: 0, // 스트리밍에서는 실시간 계산 어려움
        promptTokenCount: promptTokens,
        responseTime,
        statusCode: modelServerRes.status,
        isStream: true,
        clientIP,
        userAgent,
        ...identificationHeaders,
      });

      return new Response(modelServerRes.body, {
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
      const responseData = await modelServerRes.text();
      const responseTime = Date.now() - startTime;

      let completionTokens = 0;
      let responseText = '';
      try {
        const parsedResponse = JSON.parse(responseData);
        // chat 응답에서는 message.content에 내용이 들어있음
        completionTokens = parsedResponse.message?.content?.length || 0;
        responseText = parsedResponse.message?.content || '';
      } catch (e) {
        responseText = responseData;
        console.warn(
          '[model-server-chat] JSON 파싱 실패, 원문 사용:',
          e?.message || e
        );
      }

      await logModelServerProxyRequest({
        provider: provider,
        level: 'info',
        category: 'model_server_proxy_chat',
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
        prompt: body.messages, // chat API는 messages 배열을 기록
        response: responseText,
        isStream: false,
        responseTime,
        statusCode: modelServerRes.status,
      });

      // 외부 API 전용 로깅 (일반 응답)
      await logExternalApiRequest({
        sourceType: 'internal',
        provider: 'model-server',
        apiType: 'chat',
        endpoint: modelServerUrl,
        model: body.model,
        messages: body.messages,
        responseTokenCount: completionTokens,
        promptTokenCount: promptTokens,
        responseTime,
        statusCode: modelServerRes.status,
        isStream: false,
        clientIP,
        userAgent,
        ...identificationHeaders,
      });

      console.log(`[Model Server Chat Proxy] 완료: ${responseTime}ms`);

      return new Response(responseData, {
        status: modelServerRes.status,
        headers: {
          'Content-Type': contentType || 'application/json',
          ...corsHeaders,
        },
      });
    }
  } catch (error) {
    console.error('[Model Server Chat Proxy] 서버 오류:', error);

    await logModelServerProxyRequest({
      provider: provider || 'model-server',
      level: 'error',
      category: 'model_server_proxy_chat',
      endpoint: 'unknown',
      model: 'unknown',
      clientIP,
      userAgent,
      responseTime: Date.now() - startTime,
      statusCode: 500,
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
