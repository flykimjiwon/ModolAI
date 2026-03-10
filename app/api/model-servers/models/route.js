import { NextResponse } from 'next/server';
import { getNextModelServerEndpoint } from '@/lib/modelServers';
import { verifyAdmin } from '@/lib/adminAuth';

export async function GET(request) {
  try {
    // 관리자 권한 확인
    const adminCheck = verifyAdmin(request);
    if (!adminCheck.success) {
      return adminCheck;
    }

    // 특정 모델서버 지정 지원 (?endpoint=)
    const url = new URL(request.url);
    const endpointParam = url.searchParams.get('endpoint');
    let provider = url.searchParams.get('provider') || 'model-server';
    // endpointParam이 있으면 항상 DB에서 provider 확인 (프론트엔드에서 잘못된 provider를 보낼 수 있음)
    if (endpointParam) {
      try {
        const { query } = await import('@/lib/postgres');
        const settingsResult = await query(
          'SELECT custom_endpoints FROM settings WHERE config_type = $1 LIMIT 1',
          ['general']
        );
        if (settingsResult.rows.length > 0) {
          const customEndpoints = settingsResult.rows[0].custom_endpoints || [];
          // URL 정규화 함수 (trailing slash 제거)
          const normalizeUrl = (url) => {
            try {
              const urlObj = new URL(url.trim());
              return `${urlObj.protocol}//${urlObj.hostname.toLowerCase()}${
                urlObj.port ? `:${urlObj.port}` : ''
              }${urlObj.pathname.replace(/\/+$/, '')}`;
            } catch (error) {
              console.warn('[Catch] 에러 발생:', error.message);
              return url.trim().toLowerCase().replace(/\/+$/, '');
            }
          };
          const normalizedEndpointParam = normalizeUrl(endpointParam);
          const endpointConfig = customEndpoints.find(
            (e) => e.url && normalizeUrl(e.url) === normalizedEndpointParam
          );
          if (endpointConfig) {
            // URL 기반으로 provider 자동 감지 (우선순위: URL > DB 설정)
            const url = endpointConfig.url.toLowerCase();
            if (url.includes('generativelanguage.googleapis.com')) {
              provider = 'gemini';
            } else if (url.includes('/v1/models') || url.includes('/v1/chat')) {
              provider = 'openai-compatible';
            } else if (endpointConfig.provider) {
              // URL 기반 감지 실패 시 DB 설정 사용
              provider = endpointConfig.provider;
            }
          }
        }
      } catch (e) {
        console.warn(
          '[model-servers/models] settings 조회 실패:',
          e?.message || e
        );
      }
    }
    let modelServerUrl = '';
    if (endpointParam) {
      // 빈 문자열 체크
      if (!endpointParam.trim()) {
        return NextResponse.json(
          { error: 'endpoint 파라미터가 비어있습니다.' },
          { status: 400 }
        );
      }

      try {
        const parsed = new URL(endpointParam);
        if (!/^https?:$/.test(parsed.protocol)) {
          return NextResponse.json(
            {
              error: `유효하지 않은 프로토콜입니다. http:// 또는 https://로 시작해야 합니다. (현재: ${parsed.protocol})`,
            },
            { status: 400 }
          );
        }
        // openai-compatible과 gemini는 포트가 없어도 허용
        // provider가 'model-server'이거나 'ollama'인 경우에만 포트 검증
        if (
          provider !== 'openai-compatible' &&
          provider !== 'gemini' &&
          !parsed.port
        ) {
          return NextResponse.json(
            {
              error: `Ollama 모델서버는 포트 번호가 필요합니다. (예: http://localhost:11434)`,
            },
            { status: 400 }
          );
        }
        modelServerUrl = `${parsed.protocol}//${parsed.host}`;
      } catch (error) {
        return NextResponse.json(
          {
            error: `유효하지 않은 endpoint 형식입니다: ${endpointParam}. 올바른 URL 형식인지 확인해주세요.`,
          },
          { status: 400 }
        );
      }
    } else {
      // 모델 서버 모델서버 가져오기 (기존 로드밸런싱 시스템 활용)
      modelServerUrl = await getNextModelServerEndpoint();
      
      // 모델 서버가 설정되지 않은 경우 에러 반환
      if (!modelServerUrl || (typeof modelServerUrl === 'string' && modelServerUrl.trim() === '')) {
        return NextResponse.json(
          {
            error: '모델 서버가 설정되지 않았습니다. 관리자 설정에서 모델 서버를 등록해주세요.',
            errorType: 'configuration',
          },
          { status: 400 }
        );
      }
    }

    // Gemini 분기: /v1beta/models
    if (provider === 'gemini') {
      // DB에서 API Key 조회
      let apiKey = '';
      try {
        const { query } = await import('@/lib/postgres');
        const settingsResult = await query(
          'SELECT custom_endpoints FROM settings WHERE config_type = $1 LIMIT 1',
          ['general']
        );
        if (settingsResult.rows.length > 0) {
          const customEndpoints = settingsResult.rows[0].custom_endpoints || [];
          const endpointConfig = customEndpoints.find(
            (e) =>
              e.url && e.url.trim() === (endpointParam || modelServerUrl).trim()
          );
          if (endpointConfig && endpointConfig.apiKey) {
            apiKey = endpointConfig.apiKey;
          }
        }
      } catch (e) {
        console.warn(
          '[Model Servers Models] Gemini API key 조회 실패:',
          e.message
        );
      }

      if (!apiKey) {
        return NextResponse.json(
          {
            error: 'Gemini API key is required but not configured.',
            errorType: 'configuration',
          },
          { status: 400 }
        );
      }

      const base =
        (endpointParam || modelServerUrl).replace(/\/+$/, '') ||
        'https://generativelanguage.googleapis.com';
      const target = `${base}/v1beta/models?key=${apiKey}`;
      const headers = { 'Content-Type': 'application/json' };

      // 타임아웃 처리를 위한 AbortController 생성
      let abortController = null;
      let timeoutId = null;
      let signal;

      try {
        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
          try {
            signal = AbortSignal.timeout(30000);
          } catch (e) {
            abortController = new AbortController();
            signal = abortController.signal;
            timeoutId = setTimeout(() => {
              abortController.abort();
            }, 30000);
          }
        } else {
          abortController = new AbortController();
          signal = abortController.signal;
          timeoutId = setTimeout(() => {
            abortController.abort();
          }, 30000);
        }
      } finally {
        // 타임아웃 정리는 catch 블록에서 처리
      }

      let res;
      try {
        res = await fetch(target, {
          method: 'GET',
          headers,
          signal,
        });
      } finally {
        // 타임아웃 정리 (성공/실패 모두)
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }

      if (!res.ok) {
        // 에러 응답 본문 읽기 시도
        let errorMessage = `${res.status} ${res.statusText}`;
        try {
          const errorText = await res.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage =
                errorJson.error?.message || errorJson.error || errorMessage;
            } catch (error) {
              console.warn('[Catch] 에러 발생:', error.message);
              errorMessage = errorText.substring(0, 200); // 텍스트가 너무 길면 잘라내기
            }
          }
        } catch (error) {
          console.warn('[Catch] 에러 발생:', error.message);
          // 에러 본문 읽기 실패 시 기본 메시지 사용
        }

        return NextResponse.json(
          {
            error: `Gemini 모델 목록 조회 실패: ${errorMessage}`,
            errorType: 'connection',
          },
          { status: res.status }
        );
      }

      // 응답 본문을 먼저 텍스트로 읽어서 확인
      const responseText = await res.text();
      if (!responseText || responseText.trim() === '') {
        return NextResponse.json(
          {
            error: 'Gemini API에서 빈 응답을 받았습니다.',
            errorType: 'empty_response',
          },
          { status: 502 }
        );
      }

      // JSON 파싱 시도
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[Model Servers Models] Gemini JSON 파싱 실패:', {
          error: parseError.message,
          responsePreview: responseText.substring(0, 200),
          status: res.status,
          statusText: res.statusText,
        });
        return NextResponse.json(
          {
            error: `Gemini API 응답 파싱 실패: ${parseError.message}`,
            errorType: 'parse_error',
            details: responseText.substring(0, 200),
          },
          { status: 502 }
        );
      }
      const rawModels = Array.isArray(data?.models) ? data.models : [];
      const models = rawModels
        .filter((m) =>
          m.supportedGenerationMethods?.includes('generateContent')
        )
        .map((m) => {
          const fullName = m.name || '';
          // Gemini 모델의 경우 "models/" 접두사 제거 (표시용)
          const displayName = fullName.startsWith('models/')
            ? fullName.substring(7)
            : fullName;
          return {
            id: fullName, // 원본 ID 유지
            name: displayName, // 표시용 이름 (models/ 제거)
            size: null,
            modified_at: null,
            digest: null,
            sizeFormatted: '',
          };
        });

      return NextResponse.json({
        success: true,
        models,
        total: models.length,
        provider: 'gemini',
        baseUrl: base,
      });
    }

    // OpenAI-compatible 분기: /v1/models
    if (provider === 'openai-compatible') {
      // DB에서 API Key 조회 또는 ENV 폴백
      let apiKey = process.env.OPENAI_COMPAT_API_KEY || '';
      try {
        const { query } = await import('@/lib/postgres');
        const settingsResult = await query(
          `SELECT * FROM settings WHERE config_type = $1 LIMIT 1`,
          ['general']
        );
        const settings = settingsResult.rows[0];
        if (settings?.openai_compat_api_key) {
          apiKey = settings.openai_compat_api_key;
        }
      } catch (e) {
        console.warn(
          '[model-servers/models] settings 조회 실패, ENV 사용:',
          e?.message || e
        );
      }

      const base = (endpointParam || modelServerUrl).replace(/\/+$/, '');
      const path = /\/v1(\/|$)/.test(base) ? '/models' : '/v1/models';
      const target = `${base}${path}`;
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      // 타임아웃 처리를 위한 AbortController 생성
      let abortController = null;
      let timeoutId = null;
      let signal;

      try {
        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
          try {
            signal = AbortSignal.timeout(30000);
          } catch (e) {
            abortController = new AbortController();
            signal = abortController.signal;
            timeoutId = setTimeout(() => {
              abortController.abort();
            }, 30000);
          }
        } else {
          abortController = new AbortController();
          signal = abortController.signal;
          timeoutId = setTimeout(() => {
            abortController.abort();
          }, 30000);
        }
      } finally {
        // 타임아웃 정리는 catch 블록에서 처리
      }

      let res;
      try {
        res = await fetch(target, {
          method: 'GET',
          headers,
          signal,
        });
      } finally {
        // 타임아웃 정리 (성공/실패 모두)
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }

      if (!res.ok) {
        // 에러 응답 본문 읽기 시도
        let errorMessage = `${res.status} ${res.statusText}`;
        try {
          const errorText = await res.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage =
                errorJson.error?.message || errorJson.error || errorMessage;
            } catch (error) {
              console.warn('[Catch] 에러 발생:', error.message);
              errorMessage = errorText.substring(0, 200);
            }
          }
        } catch (error) {
          console.warn('[Catch] 에러 발생:', error.message);
          // 에러 본문 읽기 실패 시 기본 메시지 사용
        }

        return NextResponse.json(
          {
            error: `OpenAI 호환 모델 목록 조회 실패: ${errorMessage}`,
            errorType: 'connection',
          },
          { status: res.status }
        );
      }

      // 응답 본문을 먼저 텍스트로 읽어서 확인
      const responseText = await res.text();
      if (!responseText || responseText.trim() === '') {
        return NextResponse.json(
          {
            error: 'OpenAI 호환 API에서 빈 응답을 받았습니다.',
            errorType: 'empty_response',
          },
          { status: 502 }
        );
      }

      // JSON 파싱 시도
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[Model Servers Models] OpenAI 호환 JSON 파싱 실패:', {
          error: parseError.message,
          responsePreview: responseText.substring(0, 200),
          status: res.status,
          statusText: res.statusText,
        });
        return NextResponse.json(
          {
            error: `OpenAI 호환 API 응답 파싱 실패: ${parseError.message}`,
            errorType: 'parse_error',
            details: responseText.substring(0, 200),
          },
          { status: 502 }
        );
      }
      const rawModels = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.models)
        ? data.models
        : [];
      const models = rawModels.map((m) => ({
        id: m.id || m.name || '',
        name: m.id || m.name || '',
        size: null,
        modified_at: m.created || m.modified_at || null,
        digest: null,
        sizeFormatted: '',
      }));

      return NextResponse.json({
        success: true,
        models,
        total: models.length,
        provider: 'openai-compatible',
        baseUrl: base,
      });
    }

    // 내부 헬퍼: 타임아웃 + 재시도 지원 (model-server)
    async function fetchModelServerTagsWithRetry(
      primaryUrl,
      { timeoutMs = 30000, retryIfNoEndpoint = true } = {}
    ) {
      // 타임아웃 처리를 위한 헬퍼 함수
      const createAbortSignal = () => {
        let abortController = null;
        let timeoutId = null;
        let signal;

        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
          try {
            signal = AbortSignal.timeout(timeoutMs);
          } catch (e) {
            abortController = new AbortController();
            signal = abortController.signal;
            timeoutId = setTimeout(() => {
              abortController.abort();
            }, timeoutMs);
          }
        } else {
          abortController = new AbortController();
          signal = abortController.signal;
          timeoutId = setTimeout(() => {
            abortController.abort();
          }, timeoutMs);
        }

        return { signal, timeoutId };
      };

      // 1차 시도: 현재 선택된/라운드로빈 모델서버
      let timeoutId1 = null;
      try {
        const { signal, timeoutId } = createAbortSignal();
        timeoutId1 = timeoutId;

        const res = await fetch(`${primaryUrl}/api/tags`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal,
        });

        // 타임아웃 정리
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        return res;
      } catch (err) {
        // 타임아웃 정리
        if (timeoutId1) {
          clearTimeout(timeoutId1);
        }

        // 타임아웃 또는 네트워크 오류 시, 모델서버 미지정 상태라면 다른 인스턴스로 1회 재시도
        const isTimeout =
          err?.name === 'TimeoutError' ||
          err?.name === 'AbortError' ||
          err?.name === 'ConnectTimeoutError' ||
          err?.code === 'UND_ERR_CONNECT_TIMEOUT';
        const isNetworkish =
          err?.name === 'FetchError' ||
          err?.code === 'ECONNREFUSED' ||
          err?.code === 'ENOTFOUND';
        const canRetry =
          !endpointParam && retryIfNoEndpoint && (isTimeout || isNetworkish);
        if (!canRetry) throw err;

        // 다음 라운드로빈 모델서버로 재시도
        let timeoutId2 = null;
        try {
          const fallback = await getNextModelServerEndpoint();
          const { signal, timeoutId } = createAbortSignal();
          timeoutId2 = timeoutId;

          const res = await fetch(`${fallback}/api/tags`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal,
          });

          // 타임아웃 정리
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          // 재시도 응답에 실패 코드가 오면 그대로 상위에서 처리
          // 성공 시에는 그대로 반환
          return res;
        } catch (retryErr) {
          // 타임아웃 정리
          if (timeoutId2) {
            clearTimeout(timeoutId2);
          }
          throw retryErr;
        }
      }
    }

    // 모델 서버의 /api/tags 모델서버에 요청 (타임아웃 30초, 필요 시 1회 재시도)
    let response;
    try {
      response = await fetchModelServerTagsWithRetry(modelServerUrl, {
        timeoutMs: 30000,
        retryIfNoEndpoint: true,
      });
    } catch (fetchError) {
      // fetch 자체가 실패한 경우 (네트워크 오류, 타임아웃 등)
      console.error('[Model Servers Models] 모델 서버 연결 실패:', {
        url: modelServerUrl,
        error: fetchError.message,
        name: fetchError.name,
        code: fetchError.code,
      });
      throw fetchError; // 상위 catch 블록에서 처리
    }

    if (!response.ok) {
      // 에러 응답 본문 읽기 시도
      let errorMessage = `${response.status} ${response.statusText}`;
      try {
        const errorText = await response.text();
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage =
              errorJson.error?.message || errorJson.error || errorMessage;
          } catch (error) {
            console.warn('[Catch] 에러 발생:', error.message);
            errorMessage = errorText.substring(0, 200);
          }
        }
      } catch (error) {
        console.warn('[Catch] 에러 발생:', error.message);
        // 에러 본문 읽기 실패 시 기본 메시지 사용
      }
      
      console.error('[Model Servers Models] 모델 서버 응답 실패:', {
        url: modelServerUrl,
        status: response.status,
        statusText: response.statusText,
        errorMessage,
      });
      
      throw new Error(`모델 서버 응답 실패 (${response.status}): ${errorMessage}`);
    }

    // 응답 본문을 먼저 텍스트로 읽어서 확인
    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error('모델 서버에서 빈 응답을 받았습니다.');
    }

    // JSON 파싱 시도
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Model Servers Models] 모델 서버 JSON 파싱 실패:', {
        error: parseError.message,
        responsePreview: responseText.substring(0, 200),
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`모델 서버 응답 파싱 실패: ${parseError.message}`);
    }

    // 모델 목록을 가공하여 UI에 적합한 형태로 변환
    const models = (data.models || []).map((model) => ({
      id: model.name,
      name: model.name,
      size: model.size,
      modified_at: model.modified_at,
      digest: model.digest,
      // 크기를 읽기 쉬운 형태로 변환
      sizeFormatted: formatBytes(model.size),
    }));

    return NextResponse.json({
      success: true,
      models: models,
      total: models.length,
      modelServerUrl: modelServerUrl,
    });
  } catch (error) {
    console.error('[Model Servers Models] 모델 목록 조회 실패:', error);
    console.error('[Model Servers Models] 에러 상세:', {
      name: error.name,
      message: error.message,
      code: error.code,
      url: endpointParam || modelServerUrl,
      provider,
      stack: error.stack,
    });

    // 네트워크 에러와 타임아웃을 구분하여 처리
    const isTimeout =
      error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      error.name === 'ConnectTimeoutError' ||
      error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
      error.message?.includes('timeout') ||
      error.message?.includes('aborted') ||
      error.message?.includes('The operation was aborted');

    const isConnectionError =
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('getaddrinfo') ||
      error.message?.includes('ECONNRESET');

    // HTTP 응답 실패 (모델 서버가 응답했지만 에러 상태 코드)
    const isHttpError = error.message?.includes('모델 서버 응답 실패');

    if (isTimeout) {
      return NextResponse.json(
        {
          error:
            '모델 서버 연결 타임아웃입니다. 모델 서버가 실행 중인지 확인하세요.',
          errorType: 'timeout',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        { status: 504 }
      );
    }

    if (isConnectionError) {
      const endpointDisplay = endpointParam || modelServerUrl || '알 수 없음';
      return NextResponse.json(
        {
          error:
            `모델 서버에 연결할 수 없습니다. (${endpointDisplay}) 모델 서버 주소와 포트를 확인하세요.`,
          errorType: 'connection',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        { status: 500 }
      );
    }

    if (isHttpError) {
      // HTTP 응답 실패는 원본 에러 메시지 사용
      return NextResponse.json(
        {
          error: error.message || '모델 서버에서 모델 목록을 가져오는 데 실패했습니다.',
          errorType: 'http_error',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error:
          '모델 서버에서 모델 목록을 가져오는 데 실패했습니다. 모델 서버 상태를 확인하세요.',
        errorType: 'unknown',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

// 바이트를 읽기 쉬운 형태로 변환하는 헬퍼 함수
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
