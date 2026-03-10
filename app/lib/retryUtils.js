/**
 * 재시도 가능한 네트워크 오류인지 확인
 */
function isRetryableError(error) {
  return (
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEDOUT' ||
    error.message?.includes('fetch failed') ||
    error.message?.includes('timeout')
  );
}

/**
 * 재시도 가능한 HTTP 상태 코드인지 확인
 */
function isRetryableHttpStatus(status) {
  return status === 404 || // Not Found
    status === 502 || // Bad Gateway
    status === 503 || // Service Unavailable
    status === 504; // Gateway Timeout
}

/**
 * 지수 백오프 지연 시간 계산
 */
function getBackoffDelay(attempt, baseDelay = 500) {
  return baseDelay * Math.pow(2, attempt);
}

/**
 * 모델 서버 호출을 위한 재시도 로직
 * @param {string} url - 호출할 URL
 * @param {object} options - fetch 옵션
 * @param {object} config - 재시도 설정
 * @param {number} config.maxRetries - 최대 재시도 횟수 (기본값: 2)
 * @param {boolean} config.isStreaming - 스트리밍 여부 (기본값: false)
 * @param {number} config.streamTimeoutMs - 스트리밍 타임아웃 (기본값: 900000)
 * @param {number} config.normalTimeoutMs - 일반 타임아웃 (기본값: 600000)
 * @param {function} config.getNextEndpoint - 다음 엔드포인트를 가져오는 함수 (선택사항)
 * @param {object} config.providerRef - 프로바이더 참조 객체 (선택사항)
 * @param {function} config.onRetry - 재시도 시 호출되는 콜백 (선택사항)
 * @param {string} config.endpointPath - 엔드포인트 경로 (예: '/api/chat', '/api/generate') (선택사항)
 * @returns {Promise<Response>} fetch 응답
 */
export async function fetchWithRetry(url, options, config = {}) {
  const {
    maxRetries = 2,
    isStreaming = false,
    streamTimeoutMs = 900000, // 15분
    normalTimeoutMs = 600000, // 10분
    getNextEndpoint = null,
    providerRef = null,
    onRetry = null,
    endpointPath = '', // 엔드포인트 경로 (예: '/api/chat')
  } = config;

  let lastError;
  let lastResponse;
  let currentUrl = url;
  const timeoutMs = isStreaming ? streamTimeoutMs : normalTimeoutMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[Retry Utils] 모델 서버 호출 시도 ${attempt + 1}/${maxRetries + 1}`,
        {
          url: currentUrl,
          timeout: `${timeoutMs / 1000}초`,
          stream: isStreaming,
        }
      );

      // AbortController를 사용한 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        // fetch 호출
        const response = await fetch(currentUrl, {
          ...options,
          signal: controller.signal,
        });

        // 성공 시 타임아웃 정리
        clearTimeout(timeoutId);

        // HTTP 응답 상태 코드 확인
        if (!response.ok) {
          const status = response.status;
          const isRetryableHttpError = isRetryableHttpStatus(status);

          if (isRetryableHttpError && attempt < maxRetries && getNextEndpoint) {
            console.warn(
              `[Retry Utils] HTTP ${status} 오류, 다음 인스턴스로 재시도`,
              { url: currentUrl, status, attempt: attempt + 1 }
            );

            lastResponse = response;

            // 다음 엔드포인트로 변경
            const nextEndpointInfo = await getNextEndpoint();
            if (nextEndpointInfo && nextEndpointInfo.endpoint) {
              currentUrl = endpointPath 
                ? `${nextEndpointInfo.endpoint}${endpointPath}`
                : nextEndpointInfo.endpoint;
              if (providerRef && nextEndpointInfo.provider) {
                providerRef.value = nextEndpointInfo.provider;
              }
            }

            // 재시도 콜백 호출
            if (onRetry) {
              onRetry(attempt, currentUrl, status);
            }

            // 재시도 전 지연 (지수 백오프)
            const delayMs = getBackoffDelay(attempt);
            await new Promise((resolve) => setTimeout(resolve, delayMs));

            continue;
          }

          // 재시도 불가능한 HTTP 오류면 응답 반환
          console.log(
            `[Retry Utils] 모델 서버 호출 완료 (HTTP ${status}, 재시도 불가)`
          );
          return response;
        }

        // 성공 응답
        console.log(
          `[Retry Utils] 모델 서버 호출 성공 (시도 ${attempt + 1})`
        );
        return response;
      } catch (fetchErr) {
        // fetch 실패 시 타임아웃 정리
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    } catch (error) {
      lastError = error;

      // 재시도 가능한 네트워크 오류인지 확인
      const isRetryable = isRetryableError(error);

      // 재시도 가능한 오류이고 마지막 시도가 아니면 재시도
      if (isRetryable && attempt < maxRetries && getNextEndpoint) {
        // 다음 엔드포인트로 변경
        const nextEndpointInfo = await getNextEndpoint();
        if (nextEndpointInfo && nextEndpointInfo.endpoint) {
          const nextUrl = endpointPath
            ? `${nextEndpointInfo.endpoint}${endpointPath}`
            : nextEndpointInfo.endpoint;
          if (providerRef && nextEndpointInfo.provider) {
            providerRef.value = nextEndpointInfo.provider;
          }

          console.warn(
            `[Retry Utils] 시도 ${attempt + 1} 실패, 다음 인스턴스로 재시도`,
            {
              currentUrl,
              nextUrl,
              error: error.message,
            }
          );

          currentUrl = nextUrl;

          // 재시도 콜백 호출
          if (onRetry) {
            onRetry(attempt, currentUrl, null, error);
          }

          // 재시도 전 지연 (지수 백오프)
          const delayMs = getBackoffDelay(attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));

          continue;
        }
      }

      // 재시도 불가능하거나 마지막 시도면 에러 throw
      throw error;
    }
  }

  // 모든 재시도 실패 시 마지막 응답 또는 에러 반환
  if (lastResponse) {
    return lastResponse;
  }
  throw lastError;
}

