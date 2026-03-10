import { query } from './postgres';

// Docker 환경 감지 함수
function isDockerEnvironment() {
  if (typeof process !== 'undefined') {
    if (process.env.DOCKER_CONTAINER || process.env.KUBERNETES_SERVICE_HOST) {
      return true;
    }
    try {
      if (typeof require !== 'undefined') {
        const fs = require('fs');
        if (fs.existsSync && fs.existsSync('/.dockerenv')) {
          return true;
        }
      }
    } catch (e) {
      console.debug(
        '[Model Server Monitor] Docker env check failed:',
        e.message
      );
    }
  }
  return false;
}

// Docker 환경에서 localhost를 host.docker.internal로 변환
function normalizeEndpointUrl(url) {
  if (!url) return url;

  // Docker 환경에서만 변환
  if (isDockerEnvironment()) {
    // localhost 또는 127.0.0.1을 host.docker.internal로 변환
    const normalized = url
      .replace(/^http:\/\/localhost:/, 'http://host.docker.internal:')
      .replace(/^http:\/\/127\.0\.0\.1:/, 'http://host.docker.internal:')
      .replace(/^https:\/\/localhost:/, 'https://host.docker.internal:')
      .replace(/^https:\/\/127\.0\.0\.1:/, 'https://host.docker.internal:');

    if (normalized !== url) {
      console.log(
        `[Model Server Monitor] Docker 환경에서 URL 변환: ${url} -> ${normalized}`
      );
    }

    return normalized;
  }

  return url;
}

// DB 설정에서 모델 서버 엔드포인트들 파싱
export async function getModelServerEndpoints() {
  let raw = '';

  // 서버 환경에서는 DB 설정에서만 로드
  if (typeof window === 'undefined') {
    try {
      const settingsResult = await query(
        "SELECT custom_endpoints, ollama_endpoints, COALESCE(ollama_endpoints, '') as llm_endpoints FROM settings WHERE config_type = $1 LIMIT 1",
        ['general']
      );
      const settings =
        settingsResult.rows.length > 0 ? settingsResult.rows[0] : null;

      // customEndpoints 우선, 없으면 legacy 필드 사용
      const customEndpoints = settings?.custom_endpoints || null;
      if (
        customEndpoints &&
        Array.isArray(customEndpoints) &&
        customEndpoints.length > 0
      ) {
        raw = customEndpoints
          .filter(
            (e) =>
              e?.url &&
              e.provider !== 'openai-compatible' &&
              e.isActive !== false
          )
          .map((e) => (e.name ? `${e.name}|${e.url}` : e.url))
          .join(',');
      } else if (settings?.ollama_endpoints || settings?.llm_endpoints) {
        raw = settings?.ollama_endpoints || settings?.llm_endpoints || '';
      }
    } catch (e) {
      console.warn(
        '[Model Server Monitor] DB에서 모델서버 로드 실패:',
        e.message
      );
    }
  }

  const entries = raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  const mapped = entries
    .map((entry) => {
      // 지원 형식:
      // 1) http://host:port
      // 2) name|http://host:port
      // 3) name=http://host:port
      // 4) 유니코드 구분자 지원: ｜(U+FF5C), ＝(U+FF1D)
      // 5) 구분자 인식 실패 시 http(s):// 위치로 강제 분리 (폴백)
      let raw = entry.trim();
      // 외곽 따옴표 제거
      if (
        (raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'")) ||
        (raw.startsWith('`') && raw.endsWith('`'))
      ) {
        raw = raw.slice(1, -1).trim();
      }

      let name = null;
      let urlText = raw;

      // 우선 구분자 기반 매칭
      const sepMatch = raw.match(/^(.*?)\s*[|=｜＝]\s*(https?:\/\/.+)$/i);
      if (sepMatch) {
        name = (sepMatch[1] || '').trim();
        urlText = (sepMatch[2] || '').trim();
      } else {
        // 폴백: http(s):// 시작 위치로 강제 분리
        const httpIndex = raw.search(/https?:\/\//i);
        if (httpIndex > 0) {
          const before = raw.slice(0, httpIndex).trim();
          const after = raw.slice(httpIndex).trim();
          // before 끝의 구분자 제거
          const cleanedBefore = before.replace(/[|=｜＝]\s*$/u, '').trim();
          if (cleanedBefore.length > 0) {
            name = cleanedBefore;
          }
          urlText = after;
        }
      }

      try {
        const url = new URL(urlText);
        return {
          id: `model-server-${url.hostname}-${url.port}`,
          url: urlText,
          host: url.hostname,
          port: url.port,
          name: name || `모델 서버 ${url.port}`,
        };
      } catch (e) {
        console.warn('[Model Server Monitor] 잘못된 모델서버 무시:', entry);
        return null;
      }
    })
    .filter(Boolean);

  // URL 기준 중복 제거 (이름 있는 항목 우선)
  const byUrl = new Map();
  for (const ep of mapped) {
    const exist = byUrl.get(ep.url);
    if (!exist) {
      byUrl.set(ep.url, ep);
    } else if (!exist.name && ep.name) {
      byUrl.set(ep.url, ep);
    }
  }
  return Array.from(byUrl.values());
}

/**
 * settings.customEndpoints 또는 legacy llmEndpoints/ollamaEndpoints에서
 * 모든 모델서버를 로드합니다.
 * 결과: [{ id, url, host, port, name, provider }]
 */
export async function getAllEndpoints() {
  try {
    const settingsResult = await query(
      'SELECT custom_endpoints FROM settings WHERE config_type = $1 LIMIT 1',
      ['general']
    );
    const settings =
      settingsResult.rows.length > 0 ? settingsResult.rows[0] : null;
    const customEndpoints = settings?.custom_endpoints || null;

    // 비활성화된 서버 URL 목록 수집 (customEndpoints에서)
    const inactiveUrls = new Set();
    if (customEndpoints && Array.isArray(customEndpoints)) {
      customEndpoints.forEach((ep) => {
        if (ep.isActive === false && ep.url) {
          // URL 정규화 (trailing slash 제거)
          const normalizedUrl = ep.url.trim().replace(/\/+$/, '');
          inactiveUrls.add(normalizedUrl);
        }
      });
    }

    // 1) customEndpoints 우선
    if (
      customEndpoints &&
      Array.isArray(customEndpoints) &&
      customEndpoints.length > 0
    ) {
      const mapped = [];
      for (const item of customEndpoints) {
        if (!item?.url) continue;
        // 비활성화된 서버도 포함하되 isActive 필드 포함 (기본값은 활성화)
        const isActive = item.isActive !== false;
        try {
          const u = new URL(item.url);
          // provider를 URL 기반으로 자동 감지 (잘못된 provider도 무조건 수정)
          const url = item.url.toLowerCase();
          let provider = item.provider;

          // URL 기반으로 provider 자동 감지 및 수정 (우선순위: URL > 설정된 provider)
          if (url.includes('generativelanguage.googleapis.com')) {
            // Gemini URL은 무조건 gemini로 설정
            provider = 'gemini';
            if (item.provider && item.provider !== 'gemini') {
              console.warn(
                `[Model Server Monitor] Gemini URL인데 provider가 '${item.provider}'로 설정되어 있습니다. 'gemini'로 자동 수정합니다.`,
                { url: item.url, originalProvider: item.provider }
              );
            }
          } else if (url.includes('/v1/models') || url.includes('/v1/chat')) {
            // OpenAI 호환 URL은 무조건 openai-compatible로 설정
            provider = 'openai-compatible';
            if (item.provider && item.provider !== 'openai-compatible') {
              console.warn(
                `[Model Server Monitor] OpenAI 호환 URL인데 provider가 '${item.provider}'로 설정되어 있습니다. 'openai-compatible'로 자동 수정합니다.`,
                { url: item.url, originalProvider: item.provider }
              );
            }
          } else if (!provider || provider === 'model-server') {
            // provider가 없거나 'model-server'인 경우, 기본값으로 설정
            provider = 'ollama';
          }
          // 그 외의 경우는 설정된 provider를 그대로 사용

          mapped.push({
            id: `${provider}-${u.hostname}-${u.port || ''}`,
            url: item.url.replace(/\/+$/, ''),
            host: u.hostname,
            port: u.port || '',
            name: item.name || `${provider} ${u.port || u.hostname}`,
            provider,
            isActive, // 비활성화 상태 포함
          });
        } catch (error) {
          console.warn('[Catch] 에러 발생:', error.message);
          // skip invalid
        }
      }
      if (mapped.length > 0) return mapped;
    }

    // 2) legacy llmEndpoints/ollamaEndpoints 파싱 (model-server로 간주)
    const legacy = await getModelServerEndpoints();
    // 비활성화된 서버도 포함하되 isActive 필드 추가
    const filteredLegacy = legacy.map((e) => {
      const normalizedUrl = e.url ? e.url.trim().replace(/\/+$/, '') : '';
      const isActive = !normalizedUrl || !inactiveUrls.has(normalizedUrl);
      return {
        ...e,
        provider: 'model-server',
        isActive, // 비활성화 상태 포함
      };
    });
    return filteredLegacy;
  } catch (error) {
    console.warn('[Catch] 에러 발생:', error.message);
    // 3) 완전 폴백: env 기반 model-server 목록
    const legacy = await getModelServerEndpoints();
    // 비활성화된 서버 필터링 (settings를 다시 읽어서 확인)
    try {
      const inactiveUrls = await getInactiveUrls();

      return legacy.map((e) => {
        const normalizedUrl = e.url ? e.url.trim().replace(/\/+$/, '') : '';
        const isActive = !normalizedUrl || !inactiveUrls.has(normalizedUrl);
        return {
          ...e,
          provider: 'model-server',
          isActive, // 비활성화 상태 포함
        };
      });
    } catch (error) {
      console.warn('[Catch] 에러 발생:', error.message);
      // settings 읽기 실패 시 필터링 없이 반환 (기본값은 활성화)
      return legacy.map((e) => ({
        ...e,
        provider: 'model-server',
        isActive: true, // 기본값은 활성화
      }));
    }
  }
}

// 비활성화된 서버 URL 목록 수집 헬퍼 함수
async function getInactiveUrls() {
  try {
    const settingsResult = await query(
      'SELECT custom_endpoints FROM settings WHERE config_type = $1 LIMIT 1',
      ['general']
    );
    const settings =
      settingsResult.rows.length > 0 ? settingsResult.rows[0] : null;
    const customEndpoints = settings?.custom_endpoints || null;

    const inactiveUrls = new Set();
    if (customEndpoints && Array.isArray(customEndpoints)) {
      customEndpoints.forEach((ep) => {
        if (ep.isActive === false && ep.url) {
          const normalizedUrl = ep.url.trim().replace(/\/+$/, '');
          inactiveUrls.add(normalizedUrl);
        }
      });
    }
    return inactiveUrls;
  } catch (error) {
    console.warn('[Catch] 에러 발생:', error.message);
    return new Set();
  }
}

// 모델 Server error 이력 저장
async function saveModelServerErrorHistory(
  endpoint,
  error,
  responseTime = null
) {
  try {
    const errorType = error.name || 'UnknownError';
    const errorMessage = error.message || String(error);

    // provider 자동 감지 (URL 기반, 잘못된 provider도 수정)
    let provider = endpoint.provider;
    if (endpoint.url) {
      const url = endpoint.url.toLowerCase();
      // URL 기반으로 provider 자동 감지 및 수정 (우선순위: URL > 설정된 provider)
      if (url.includes('generativelanguage.googleapis.com')) {
        provider = 'gemini';
      } else if (url.includes('/v1/models') || url.includes('/v1/chat')) {
        provider = 'openai-compatible';
      } else if (!provider || provider === 'model-server') {
        provider = 'model-server';
      }
      // 그 외의 경우는 설정된 provider를 그대로 사용
    }
    // provider가 여전히 없으면 기본값
    if (!provider) {
      provider = 'model-server';
    }

    await query(
      `INSERT INTO model_server_error_history 
       (endpoint_url, endpoint_name, provider, error_message, error_type, response_time, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        endpoint.url || '',
        endpoint.name || '',
        provider,
        errorMessage,
        errorType,
        responseTime,
        'unhealthy',
        JSON.stringify({
          stack: error.stack,
          url: endpoint.url,
          name: endpoint.name,
          provider: provider,
          originalProvider: endpoint.provider, // 원본 provider도 저장
        }),
      ]
    );
  } catch (saveError) {
    // 테이블이 없으면 생성 시도
    if (
      saveError.code === '42P01' &&
      saveError.message?.includes('model_server_error_history')
    ) {
      try {
        console.log(
          '[Model Server Monitor] model_server_error_history 테이블이 없어 생성합니다...'
        );
        await query(`
          CREATE TABLE IF NOT EXISTS model_server_error_history (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            endpoint_url VARCHAR(500) NOT NULL,
            endpoint_name VARCHAR(255),
            provider VARCHAR(50) NOT NULL,
            error_message TEXT NOT NULL,
            error_type VARCHAR(100),
            response_time INTEGER,
            status VARCHAR(50) DEFAULT 'unhealthy',
            checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata JSONB
          )
        `);
        await query(`
          CREATE INDEX IF NOT EXISTS idx_model_server_error_history_endpoint 
          ON model_server_error_history(endpoint_url, checked_at DESC)
        `);
        await query(`
          CREATE INDEX IF NOT EXISTS idx_model_server_error_history_provider 
          ON model_server_error_history(provider, checked_at DESC)
        `);
        console.log(
          '[Model Server Monitor] model_server_error_history 테이블 생성 완료'
        );

        // provider 자동 감지 (URL 기반, 잘못된 provider도 수정)
        let provider = endpoint.provider;
        if (endpoint.url) {
          const url = endpoint.url.toLowerCase();
          // URL 기반으로 provider 자동 감지 및 수정 (우선순위: URL > 설정된 provider)
          if (url.includes('generativelanguage.googleapis.com')) {
            provider = 'gemini';
          } else if (url.includes('/v1/models') || url.includes('/v1/chat')) {
            provider = 'openai-compatible';
          } else if (!provider || provider === 'model-server') {
            provider = 'model-server';
          }
          // 그 외의 경우는 설정된 provider를 그대로 사용
        }
        if (!provider) {
          provider = 'model-server';
        }

        // 다시 저장 시도
        await query(
          `INSERT INTO model_server_error_history 
           (endpoint_url, endpoint_name, provider, error_message, error_type, response_time, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            endpoint.url || '',
            endpoint.name || '',
            provider,
            errorMessage,
            errorType,
            responseTime,
            'unhealthy',
            JSON.stringify({
              stack: error.stack,
              url: endpoint.url,
              name: endpoint.name,
              provider: provider,
              originalProvider: endpoint.provider,
            }),
          ]
        );
      } catch (createError) {
        console.error('[Model Server Monitor] 테이블 생성 실패:', createError);
        console.warn(
          '[Model Server Monitor] 스키마 생성 스크립트를 실행하세요: npm run setup-postgres'
        );
      }
    } else {
      console.error('[Model Server Monitor] 오류 이력 저장 실패:', saveError);
    }
  }
}

// 모델 서버 인스턴스 상태 체크
export async function checkModelServerHealth(endpoint) {
  const startAt = Date.now();
  let abortController = null;
  let timeoutId = null;

  try {
    // Docker 환경에서 localhost를 host.docker.internal로 변환
    const normalizedUrl = normalizeEndpointUrl(endpoint.url);
    const fetchUrl = `${normalizedUrl}/api/tags`;

    // AbortSignal.timeout이 지원되지 않는 환경을 위한 폴백
    let signal;
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      try {
        signal = AbortSignal.timeout(5000); // 5초 타임아웃
      } catch (e) {
        // AbortSignal.timeout이 실패하면 수동으로 구현
        abortController = new AbortController();
        signal = abortController.signal;
        timeoutId = setTimeout(() => {
          abortController.abort();
        }, 5000);
      }
    } else {
      // AbortSignal.timeout이 없는 경우 수동으로 구현
      abortController = new AbortController();
      signal = abortController.signal;
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, 5000);
    }

    const response = await fetch(fetchUrl, {
      method: 'GET',
      signal,
    });

    // 응답 본문을 먼저 텍스트로 읽어서 확인
    const responseText = await response.text();

    if (!response.ok) {
      // 에러 응답 본문 읽기 시도
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      if (responseText && responseText.trim()) {
        try {
          const errorJson = JSON.parse(responseText);
          errorMessage =
            errorJson.error?.message || errorJson.error || errorMessage;
        } catch (error) {
          console.warn('[Catch] 에러 발생:', error.message);
          errorMessage = responseText.substring(0, 200);
        }
      }
      throw new Error(errorMessage);
    }

    if (!responseText || responseText.trim() === '') {
      throw new Error('모델 서버에서 빈 응답을 받았습니다.');
    }

    // JSON 파싱 시도
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Model Server Monitor] JSON 파싱 실패:', {
        error: parseError.message,
        responsePreview: responseText.substring(0, 200),
        status: response.status,
        statusText: response.statusText,
        url: `${normalizedUrl}/api/tags`,
      });
      throw new Error(`JSON 파싱 실패: ${parseError.message}`);
    }

    const responseTime = Date.now() - startAt;

    return {
      ...endpoint,
      status: 'healthy',
      models: data.models || [],
      modelCount: data.models?.length || 0,
      lastCheck: new Date(),
      responseTime,
      error: null,
    };
  } catch (error) {
    // 타임아웃 정리
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const responseTime = Date.now() - startAt;

    // 에러 메시지 개선
    let errorMessage = error.message || 'Unknown error';

    // 네트워크 에러인 경우 더 자세한 정보 제공
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      errorMessage = `연결 타임아웃 (5초 초과): ${endpoint.url}`;
    } else if (
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('ECONNREFUSED')
    ) {
      errorMessage = `연결 거부됨: ${endpoint.url} (서버가 실행 중인지 확인하세요)`;
    } else if (
      error.code === 'ENOTFOUND' ||
      error.message?.includes('ENOTFOUND')
    ) {
      errorMessage = `호스트를 찾을 수 없음: ${endpoint.url} (DNS 확인 필요)`;
    } else if (error.message?.includes('fetch failed')) {
      const causeMessage = error.cause?.message || '';
      errorMessage = `네트워크 연결 실패: ${endpoint.url}${
        causeMessage ? ` (${causeMessage})` : ''
      }`;
    }

    // 오류 이력 저장
    await saveModelServerErrorHistory(endpoint, error, responseTime);

    return {
      ...endpoint,
      status: 'unhealthy',
      models: [],
      modelCount: 0,
      lastCheck: new Date(),
      responseTime: null,
      error: errorMessage,
    };
  } finally {
    // 타임아웃 정리 (성공 시에도)
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * OpenAI-compatible 인스턴스 상태 체크
 * 표준: GET {base}/v1/models (또는 base가 /v1 포함시 /models)
 * Authorization: Bearer {openaiCompatApiKey} (있으면)
 */
export async function checkOpenAICompatibleHealth(endpoint) {
  const startAt = Date.now();
  let abortController = null;
  let timeoutId = null;

  try {
    const settingsResult = await query(
      'SELECT openai_compat_api_key FROM settings WHERE config_type = $1 LIMIT 1',
      ['general']
    );
    const settings =
      settingsResult.rows.length > 0 ? settingsResult.rows[0] : null;
    const apiKey = settings?.openai_compat_api_key || '';

    // Docker 환경에서 localhost를 host.docker.internal로 변환
    const normalizedBaseUrl = normalizeEndpointUrl(endpoint.url);
    const base = normalizedBaseUrl.replace(/\/+$/, '');
    const path = /\/v1(\/|$)/.test(base) ? '/models' : '/v1/models';
    const url = `${base}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    // AbortSignal.timeout이 지원되지 않는 환경을 위한 폴백
    let signal;
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      try {
        signal = AbortSignal.timeout(5000); // 5초 타임아웃
      } catch (e) {
        // AbortSignal.timeout이 실패하면 수동으로 구현
        abortController = new AbortController();
        signal = abortController.signal;
        timeoutId = setTimeout(() => {
          abortController.abort();
        }, 5000);
      }
    } else {
      // AbortSignal.timeout이 없는 경우 수동으로 구현
      abortController = new AbortController();
      signal = abortController.signal;
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, 5000);
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal,
    });

    // 응답 본문을 먼저 텍스트로 읽어서 확인 (한 번만 읽기)
    const responseText = await res.text();

    if (!res.ok) {
      // 에러 응답 본문 처리
      let errorMessage = `HTTP ${res.status} ${res.statusText}`;
      if (responseText && responseText.trim()) {
        try {
          const errorJson = JSON.parse(responseText);
          errorMessage =
            errorJson.error?.message || errorJson.error || errorMessage;
        } catch (error) {
          console.warn('[Catch] 에러 발생:', error.message);
          errorMessage = responseText.substring(0, 200);
        }
      }
      throw new Error(errorMessage);
    }

    if (!responseText || responseText.trim() === '') {
      throw new Error('OpenAI-compatible API에서 빈 응답을 받았습니다.');
    }

    // JSON 파싱 시도
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error(
        '[Model Server Monitor] OpenAI-compatible JSON 파싱 실패:',
        {
          error: parseError.message,
          responsePreview: responseText.substring(0, 200),
          status: res.status,
          statusText: res.statusText,
          url: url,
        }
      );
      throw new Error(`JSON 파싱 실패: ${parseError.message}`);
    }

    // OpenAI 표준은 { data: [...] }, 일부 호환 구현은 { models: [...] }
    const models = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
      ? data.models
      : [];

    const responseTime = Date.now() - startAt;

    return {
      ...endpoint,
      status: 'healthy',
      models,
      modelCount: models.length,
      lastCheck: new Date(),
      responseTime,
      error: null,
    };
  } catch (error) {
    // 타임아웃 정리
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const responseTime = Date.now() - startAt;

    // 에러 메시지 개선
    let errorMessage = error.message || 'Unknown error';

    // 네트워크 에러인 경우 더 자세한 정보 제공
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      errorMessage = `연결 타임아웃 (5초 초과): ${endpoint.url}`;
    } else if (
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('ECONNREFUSED')
    ) {
      errorMessage = `연결 거부됨: ${endpoint.url} (서버가 실행 중인지 확인하세요)`;
    } else if (
      error.code === 'ENOTFOUND' ||
      error.message?.includes('ENOTFOUND')
    ) {
      errorMessage = `호스트를 찾을 수 없음: ${endpoint.url} (DNS 확인 필요)`;
    } else if (error.message?.includes('fetch failed')) {
      const causeMessage = error.cause?.message || '';
      errorMessage = `네트워크 연결 실패: ${endpoint.url}${
        causeMessage ? ` (${causeMessage})` : ''
      }`;
    }

    // 오류 이력 저장
    await saveModelServerErrorHistory(endpoint, error, responseTime);

    return {
      ...endpoint,
      status: 'unhealthy',
      models: [],
      modelCount: 0,
      lastCheck: new Date(),
      responseTime: null,
      error: errorMessage,
    };
  } finally {
    // 타임아웃 정리 (성공 시에도)
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Gemini 인스턴스 상태 체크
 * GET {base}/v1beta/models?key={apiKey}
 */
export async function checkGeminiHealth(endpoint) {
  const startAt = Date.now();
  let abortController = null;
  let timeoutId = null;

  try {
    // DB에서 API Key 조회
    let apiKey = '';
    try {
      const settingsResult = await query(
        'SELECT custom_endpoints FROM settings WHERE config_type = $1 LIMIT 1',
        ['general']
      );
      if (settingsResult.rows.length > 0) {
        const customEndpoints = settingsResult.rows[0].custom_endpoints || [];
        const endpointConfig = customEndpoints.find(
          (e) => e.url && e.url.trim() === endpoint.url.trim()
        );
        if (endpointConfig && endpointConfig.apiKey) {
          apiKey = endpointConfig.apiKey;
        }
      }
    } catch (e) {
      console.warn(
        '[Model Server Monitor] Gemini API key 조회 실패:',
        e.message
      );
    }

    if (!apiKey) {
      throw new Error('Gemini API key is required but not configured.');
    }

    const base =
      endpoint.url.replace(/\/+$/, '') ||
      'https://generativelanguage.googleapis.com';
    const url = `${base}/v1beta/models?key=${apiKey}`;
    const headers = { 'Content-Type': 'application/json' };

    // AbortSignal.timeout이 지원되지 않는 환경을 위한 폴백
    let signal;
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      try {
        signal = AbortSignal.timeout(5000); // 5초 타임아웃
      } catch (e) {
        // AbortSignal.timeout이 실패하면 수동으로 구현
        abortController = new AbortController();
        signal = abortController.signal;
        timeoutId = setTimeout(() => {
          abortController.abort();
        }, 5000);
      }
    } else {
      // AbortSignal.timeout이 없는 경우 수동으로 구현
      abortController = new AbortController();
      signal = abortController.signal;
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, 5000);
    }

    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal,
    });

    // 응답 본문을 먼저 텍스트로 읽어서 확인 (한 번만 읽기)
    const responseText = await res.text();

    if (!res.ok) {
      // 에러 응답 본문 처리
      let errorMessage = `HTTP ${res.status} ${res.statusText}`;
      if (responseText && responseText.trim()) {
        try {
          const errorJson = JSON.parse(responseText);
          errorMessage =
            errorJson.error?.message || errorJson.error || errorMessage;
        } catch (error) {
          console.warn('[Catch] 에러 발생:', error.message);
          errorMessage = responseText.substring(0, 200);
        }
      }
      throw new Error(errorMessage);
    }

    if (!responseText || responseText.trim() === '') {
      throw new Error('Gemini API에서 빈 응답을 받았습니다.');
    }

    // JSON 파싱 시도
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Model Server Monitor] Gemini JSON 파싱 실패:', {
        error: parseError.message,
        responsePreview: responseText.substring(0, 200),
        status: res.status,
        statusText: res.statusText,
        url: url.replace(/key=[^&]+/, 'key=***'), // API 키 마스킹
      });
      throw new Error(`JSON 파싱 실패: ${parseError.message}`);
    }

    const rawModels = Array.isArray(data?.models) ? data.models : [];
    const models = rawModels.filter((m) =>
      m.supportedGenerationMethods?.includes('generateContent')
    );

    const responseTime = Date.now() - startAt;

    return {
      ...endpoint,
      status: 'healthy',
      models,
      modelCount: models.length,
      lastCheck: new Date(),
      responseTime,
      error: null,
    };
  } catch (error) {
    // 타임아웃 정리
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const responseTime = Date.now() - startAt;

    // 에러 메시지 개선
    let errorMessage = error.message || 'Unknown error';

    // 네트워크 에러인 경우 더 자세한 정보 제공
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      errorMessage = `연결 타임아웃 (5초 초과): ${endpoint.url}`;
    } else if (
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('ECONNREFUSED')
    ) {
      errorMessage = `연결 거부됨: ${endpoint.url} (서버가 실행 중인지 확인하세요)`;
    } else if (
      error.code === 'ENOTFOUND' ||
      error.message?.includes('ENOTFOUND')
    ) {
      errorMessage = `호스트를 찾을 수 없음: ${endpoint.url} (DNS 확인 필요)`;
    } else if (error.message?.includes('fetch failed')) {
      const causeMessage = error.cause?.message || '';
      errorMessage = `네트워크 연결 실패: ${endpoint.url}${
        causeMessage ? ` (${causeMessage})` : ''
      }`;
    }

    // 오류 이력 저장
    await saveModelServerErrorHistory(endpoint, error, responseTime);

    return {
      ...endpoint,
      status: 'unhealthy',
      models: [],
      modelCount: 0,
      lastCheck: new Date(),
      responseTime: null,
      error: errorMessage,
    };
  } finally {
    // 타임아웃 정리 (성공 시에도)
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

// 마지막 상태 확인 시간 추적
let lastCheckTime = 0;
const MIN_CHECK_INTERVAL = 30000000; // 최소 500분 간격

// 모든 인스턴스 상태 확인 (model-server + openai-compatible)
export async function checkAllModelServerInstances() {
  const now = Date.now();
  const timeSinceLastCheck = now - lastCheckTime;

  // 최소 간격 이내 호출 시 스킵
  if (timeSinceLastCheck < MIN_CHECK_INTERVAL) {
    console.log(
      `[Model Server Monitor] 상태 확인 스킵: 마지막 확인 후 ${Math.round(
        timeSinceLastCheck / 1000
      )}초 경과 (최소 ${MIN_CHECK_INTERVAL / 1000}초 간격 필요)`
    );
    return [];
  }

  lastCheckTime = now;

  try {
    // 비활성화된 서버 목록 확인 (추가 보장)
    const inactiveUrls = await getInactiveUrls();

    const endpoints = await getAllEndpoints();

    // 비활성화된 서버 추가 필터링 (이중 보장)
    // OpenAI Compatible과 Gemini는 외부 API이므로 상태 체크 제외
    const activeEndpoints = endpoints.filter((endpoint) => {
      if (!endpoint.url) return true; // URL이 없으면 유지
      const normalizedUrl = endpoint.url.trim().replace(/\/+$/, '');

      // 비활성화된 서버 제외
      if (inactiveUrls.has(normalizedUrl)) return false;

      // 외부 API는 상태 체크 제외 (항상 온라인으로 간주)
      if (endpoint.provider === 'openai-compatible') return false;
      if (endpoint.provider === 'gemini') return false;

      return true;
    });

    console.log(
      `[Model Server Monitor] ${
        activeEndpoints.length
      }개 인스턴스 상태 확인 중... (비활성 ${
        endpoints.length - activeEndpoints.length
      }개 제외)`
    );

    const checks = await Promise.allSettled(
      activeEndpoints.map(async (endpoint) => {
        try {
          // URL 기반으로 provider 재확인 및 강제 수정 (이중 체크)
          let provider = endpoint.provider;
          if (endpoint.url) {
            const url = endpoint.url.toLowerCase();

            // Gemini URL 체크 (가장 우선)
            if (url.includes('generativelanguage.googleapis.com')) {
              provider = 'gemini';
              if (endpoint.provider !== 'gemini') {
                console.warn(
                  '[Model Server Monitor] Gemini URL이지만 provider가 gemini가 아닙니다. provider를 gemini로 수정합니다.',
                  {
                    url: endpoint.url,
                    currentProvider: endpoint.provider,
                  }
                );
              }
              return await checkGeminiHealth({
                ...endpoint,
                provider: 'gemini',
              });
            }

            // OpenAI 호환 URL 체크
            if (url.includes('/v1/models') || url.includes('/v1/chat')) {
              provider = 'openai-compatible';
              if (endpoint.provider !== 'openai-compatible') {
                console.warn(
                  '[Model Server Monitor] OpenAI 호환 URL이지만 provider가 openai-compatible이 아닙니다. provider를 openai-compatible로 수정합니다.',
                  {
                    url: endpoint.url,
                    currentProvider: endpoint.provider,
                  }
                );
              }
              return await checkOpenAICompatibleHealth({
                ...endpoint,
                provider: 'openai-compatible',
              });
            }
          }

          // URL 기반 체크를 통과한 경우, provider에 따라 분기
          if (provider === 'openai-compatible') {
            return await checkOpenAICompatibleHealth({ ...endpoint, provider });
          } else if (provider === 'gemini') {
            return await checkGeminiHealth({ ...endpoint, provider });
          } else {
            // 기본값: model-server (Ollama 등)
            return await checkModelServerHealth({
              ...endpoint,
              provider: provider || 'model-server',
            });
          }
        } catch (error) {
          // 개별 엔드포인트 체크 실패 시에도 계속 진행
          console.error(
            `[Model Server Monitor] 엔드포인트 체크 실패: ${endpoint.url}`,
            error
          );
          return {
            ...endpoint,
            status: 'unhealthy',
            models: [],
            modelCount: 0,
            lastCheck: new Date(),
            responseTime: null,
            error: error.message || 'Unknown error',
          };
        }
      })
    );

    // Promise.allSettled 결과를 처리
    const results = checks.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // 이론적으로는 위의 catch에서 처리되지만, 안전장치로 추가
        console.error('[Model Server Monitor] Promise 실패:', result.reason);
        return {
          status: 'unhealthy',
          models: [],
          modelCount: 0,
          lastCheck: new Date(),
          responseTime: null,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });

    return results;
  } catch (error) {
    console.error('[Model Server Monitor] 인스턴스 상태 확인 실패:', error);
    return [];
  }
}

// 상세 API 요청 로그 기록 (라운드로빈 추적 포함)
export async function logModelServerRequest(instanceId, requestData) {
  try {
    const logEntry = {
      instanceId,
      instanceType: 'model-server',
      level: 'INFO',
      category: 'api_request',
      method: requestData.method || 'POST',
      endpoint: requestData.endpoint || '/api/generate',
      requestType: requestData.requestType || 'unknown', // 'text', 'image', 'multimodal'
      model: requestData.model || 'unknown',
      hasFiles: requestData.hasFiles || false,
      fileCount: requestData.fileCount || 0,
      fileTypes: requestData.fileTypes || [],
      userAgent: requestData.userAgent || '',
      clientIP: requestData.clientIP || '',
      requestSize: requestData.requestSize || 0, // bytes
      responseTime: requestData.responseTime || null, // ms
      responseStatus: requestData.responseStatus || null,
      responseSize: requestData.responseSize || 0, // bytes
      errorMessage: requestData.errorMessage || null,
      roundRobinIndex: requestData.roundRobinIndex || null, // 라운드로빈 순서
      roomId: requestData.roomId || null,
      userId: requestData.userId || null,
      timestamp: new Date(),
      metadata: requestData.metadata || {},
    };

    await query(
      `INSERT INTO model_logs (instance_id, instance_type, level, category, message, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        logEntry.instanceId,
        logEntry.instanceType,
        logEntry.level,
        logEntry.category,
        JSON.stringify(logEntry),
        JSON.stringify(logEntry.metadata),
      ]
    );

    const logMessage = `${requestData.method || 'POST'} ${
      requestData.endpoint || '/api/generate'
    } - Model: ${requestData.model} - Type: ${requestData.requestType} - RR: ${
      requestData.roundRobinIndex
    } - ${requestData.responseTime}ms`;
    console.log(`[Model Server Request] [${instanceId}] ${logMessage}`);
  } catch (error) {
    console.error('모델 서버 요청 로그 저장 실패:', error);
  }
}

// OpenAI-compatible 인스턴스 요청 로그 기록
export async function logOpenAIRequest(instanceId, requestData) {
  try {
    // provider 감지 (instanceId 또는 endpoint에서)
    const isGemini =
      instanceId?.includes('gemini') ||
      requestData.endpoint?.includes('generativelanguage.googleapis.com') ||
      requestData.provider === 'gemini';

    // 요청 타입 결정 (messages에 이미지가 있는지 확인)
    let requestType = 'text';
    if (requestData.messages) {
      const hasImage = requestData.messages.some(
        (msg) =>
          msg.content &&
          (Array.isArray(msg.content)
            ? msg.content.some((c) => c.type === 'image_url')
            : typeof msg.content === 'string' &&
              msg.content.includes('data:image'))
      );
      requestType = hasImage ? 'multimodal' : 'text';
    }

    // 파일 정보 추출
    const hasFiles =
      requestType === 'multimodal' || requestData.hasFiles || false;
    const fileCount = requestData.fileCount || (hasFiles ? 1 : 0);

    // 메시지 생성 (간결하게 - 이미 배지로 표시되는 정보는 제외)
    // 메시지는 엔드포인트 정보만 포함 (배지에 표시되지 않는 추가 정보만)
    const messageParts = [];
    messageParts.push(
      `${requestData.method || 'POST'} ${
        requestData.endpoint || '/v1/chat/completions'
      }`
    );
    // 배지에 이미 표시되는 정보는 메시지에서 제외:
    // - Model (배지에 표시됨)
    // - Response time (배지에 표시됨)
    // - Status (배지에 표시됨)
    // - Prompt/Completion/Total tokens (배지에 표시됨)
    // - Stream (배지에 표시됨)
    // - RoundRobinIndex (배지에 표시됨)
    // 추가 컨텍스트만 포함 (예: 에러 메시지, 특별한 정보 등)

    // metadata에 추가 정보 포함 (null/undefined 제외)
    const metadata = {
      ...(requestData.metadata || {}),
      endpoint: requestData.endpoint || '/v1/chat/completions',
      ...(requestData.responseTime !== null &&
        requestData.responseTime !== undefined && {
          responseTime: `${requestData.responseTime}ms`,
        }),
      method: requestData.method || 'POST',
      model: requestData.model || 'unknown',
      ...(requestData.responseStatus && {
        responseStatus: requestData.responseStatus,
      }),
      ...(requestData.responseSize && {
        responseSize: requestData.responseSize,
      }),
      ...(requestData.requestSize && { requestSize: requestData.requestSize }),
      ...(requestData.isStream !== undefined && {
        isStream: requestData.isStream,
      }),
      ...(requestData.roundRobinIndex !== null &&
        requestData.roundRobinIndex !== undefined && {
          roundRobinIndex: requestData.roundRobinIndex,
        }),
      ...(requestData.promptTokens && {
        promptTokens: requestData.promptTokens,
      }),
      ...(requestData.completionTokens && {
        completionTokens: requestData.completionTokens,
      }),
      ...(requestData.totalTokens && { totalTokens: requestData.totalTokens }),
      ...(requestData.hasFiles && { hasFiles: requestData.hasFiles }),
      ...(requestData.fileCount && { fileCount: requestData.fileCount }),
      ...(requestData.clientIP && { clientIP: requestData.clientIP }),
      ...(requestData.userAgent && { userAgent: requestData.userAgent }),
      provider: isGemini ? 'gemini' : 'openai-compatible',
    };

    // null/undefined 값 제거
    Object.keys(metadata).forEach((key) => {
      if (metadata[key] === null || metadata[key] === undefined) {
        delete metadata[key];
      }
    });

    // Gemini인 경우 별도 카테고리 사용
    const category = isGemini ? 'gemini_proxy' : 'openai_proxy';
    const type = isGemini ? 'gemini_proxy' : 'openai_proxy';

    const logEntry = {
      instanceId,
      instanceType: isGemini ? 'gemini' : 'openai-compatible',
      type,
      level: (requestData.level || 'info').toUpperCase(),
      category,
      method: requestData.method || 'POST',
      endpoint: requestData.endpoint || '/v1/chat/completions',
      model: requestData.model || 'unknown',
      requestType,
      hasFiles,
      fileCount,
      userAgent: requestData.userAgent || '',
      clientIP: requestData.clientIP || '',
      requestSize: requestData.requestSize || 0,
      responseTime: requestData.responseTime || null,
      responseStatus: requestData.responseStatus || null,
      responseSize: requestData.responseSize || 0,
      errorMessage: requestData.errorMessage || null,
      roomId: requestData.roomId || null,
      userId: requestData.userId || null,
      isStream: requestData.isStream ?? true,
      roundRobinIndex: requestData.roundRobinIndex || null,
      promptTokens: requestData.promptTokens || null,
      completionTokens: requestData.completionTokens || null,
      totalTokens: requestData.totalTokens || null,
      message: messageParts.join(' | '), // 상세 메시지 추가
      timestamp: new Date(),
      metadata,
    };
    await query(
      `INSERT INTO model_logs (instance_id, instance_type, level, category, message, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        instanceId,
        'openai-compatible',
        logEntry.level,
        logEntry.category,
        logEntry.message,
        JSON.stringify(logEntry.metadata),
      ]
    );
    console.log(
      `[OpenAI-Compatible Request] [${instanceId}] ${logEntry.method} ${logEntry.endpoint} - Model: ${logEntry.model} - ${logEntry.responseStatus} - ${logEntry.responseTime}ms`
    );
  } catch (error) {
    console.error('OpenAI-compatible 요청 로그 저장 실패:', error);
  }
}

// 기본 이벤트 로그 기록
export async function logModelServerEvent(
  instanceId,
  level,
  message,
  metadata = {}
) {
  try {
    await query(
      `INSERT INTO model_logs (instance_id, instance_type, level, category, message, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        instanceId,
        'model-server',
        level,
        'system_event',
        message,
        JSON.stringify(metadata),
      ]
    );

    console.log(`[Model Server Log] [${level}] [${instanceId}] ${message}`);
  } catch (error) {
    console.error('모델 서버 로그 저장 실패:', error);
  }
}

// 모델 서버 인스턴스 상태를 DB에 저장
export async function saveendpointStatus(modelServers) {
  try {
    // 비활성화된 서버 목록 확인
    const inactiveUrls = await getInactiveUrls();

    // 비활성화된 서버 필터링
    const activeModelServers = modelServers.filter((instance) => {
      if (!instance.url) return true; // URL이 없으면 유지 (legacy 데이터)
      const normalizedUrl = instance.url.trim().replace(/\/+$/, '');
      return !inactiveUrls.has(normalizedUrl);
    });

    // 기존 데이터 삭제 후 새로 삽입
    await query('DELETE FROM model_server');

    if (activeModelServers.length > 0) {
      console.log('modelServers:', activeModelServers);
      for (const instance of activeModelServers) {
        await query(
          `INSERT INTO model_server (endpoint, name, status, metadata, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (endpoint) DO UPDATE SET
             name = EXCLUDED.name,
             status = EXCLUDED.status,
             metadata = EXCLUDED.metadata,
             updated_at = CURRENT_TIMESTAMP`,
          [
            instance.url,
            instance.name || instance.id,
            instance.status || 'unknown',
            JSON.stringify(instance),
          ]
        );
      }
    }

    // 로그 기록
    const healthyCount = activeModelServers.filter(
      (i) => i.status === 'healthy'
    ).length;
    const unhealthyCount = activeModelServers.length - healthyCount;

    logModelServerEvent(
      'system',
      'INFO',
      `모델 서버 상태 업데이트 완료: 정상 ${healthyCount}개, 비정상 ${unhealthyCount}개`,
      {
        healthy: healthyCount,
        unhealthy: unhealthyCount,
        total: activeModelServers.length,
      }
    );
  } catch (error) {
    console.error('모델 서버 상태 저장 실패:', error);
    logModelServerEvent('system', 'ERROR', '모델 서버 상태 저장 실패', {
      error: error.message,
    });
  }
}

// 모델 서버 API 호출 성공/실패 로그
export async function logModelServerAPICall(
  endpoint,
  success,
  responseTime,
  error = null
) {
  const instanceId = `model-server-${new URL(endpoint).hostname}-${
    new URL(endpoint).port
  }`;

  if (success) {
    logModelServerEvent(instanceId, 'INFO', `API 호출 성공`, {
      endpoint,
      responseTime: `${responseTime}ms`,
    });
  } else {
    logModelServerEvent(instanceId, 'ERROR', `API 호출 실패`, {
      endpoint,
      error: error?.message || 'Unknown error',
      responseTime: responseTime ? `${responseTime}ms` : 'timeout',
    });
  }
}

// 정기적인 모델 서버 모니터링 시작
let monitoringInterval = null;

export function startModelServerMonitoring() {
  if (monitoringInterval) return;

  console.log('[Model Server Monitor] 모니터링 시작...');

  // 즉시 한번 실행
  checkAndSaveendpointStatus();

  // 200분마다 상태 확인
  monitoringInterval = setInterval(checkAndSaveendpointStatus, 12000000);
}

export function stopModelServerMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('[Model Server Monitor] 모니터링 중단');
  }
}

async function checkAndSaveendpointStatus() {
  const now = Date.now();
  const timeSinceLastCheck = now - lastCheckTime;

  // 최소 간격 이내 호출 시 스킵
  if (timeSinceLastCheck < MIN_CHECK_INTERVAL) {
    console.log(
      `[Model Server Monitor] 상태 확인 스킵: 마지막 확인 후 ${Math.round(
        timeSinceLastCheck / 1000
      )}초 경과 (최소 ${MIN_CHECK_INTERVAL / 1000}초 간격 필요)`
    );
    return;
  }

  try {
    const modelServers = await checkAllModelServerInstances();
    await saveendpointStatus(modelServers);
  } catch (error) {
    console.error('[Model Server Monitor] 상태 확인 실패:', error);
    logModelServerEvent('system', 'ERROR', '상태 확인 실패', {
      error: error.message,
    });
  }
}

// 서버 시작시 자동 실행 (브라우저에서는 실행되지 않음)
// 빌드 단계에서는 모니터링을 시작하지 않음
if (
  typeof window === 'undefined' &&
  process.env.NEXT_PHASE !== 'phase-production-build'
) {
  // 5초 후 모니터링 시작 (서버 초기화 완료 후)
  setTimeout(() => {
    startModelServerMonitoring();
  }, 5000);

  // 프로세스 종료시 모니터링 중단
  process.on('SIGTERM', stopModelServerMonitoring);
  process.on('SIGINT', stopModelServerMonitoring);
}

// 하위 호환성을 위한 별칭 (점진적 마이그레이션)
export const getLlmEndpoints = getModelServerEndpoints;
export const checkLlmHealth = checkModelServerHealth;
export const checkAllLlmInstances = checkAllModelServerInstances;
export const logLlmRequest = logModelServerRequest;
export const logLlmEvent = logModelServerEvent;
export const logLlmAPICall = logModelServerAPICall;
export const startLlmMonitoring = startModelServerMonitoring;
export const stopLlmMonitoring = stopModelServerMonitoring;
export const getOllamaEndpoints = getModelServerEndpoints;
export const checkOllamaHealth = checkModelServerHealth;
export const checkAllOllamaInstances = checkAllModelServerInstances;
export const logOllamaRequest = logModelServerRequest;
export const logOllamaEvent = logModelServerEvent;
export const logOllamaAPICall = logModelServerAPICall;
export const startOllamaMonitoring = startModelServerMonitoring;
export const stopOllamaMonitoring = stopModelServerMonitoring;
