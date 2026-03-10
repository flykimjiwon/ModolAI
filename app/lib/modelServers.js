let endpoints = []; // [{ url, provider }] 형태로 저장

function normalizeEndpointForRuntime(url) {
  if (!url) return url;
  // 로컬(비-Docker) 실행 시 host.docker.internal 사용을 방지
  if (process.env.DOCKER_CONTAINER || process.env.KUBERNETES_SERVICE_HOST) {
    return url;
  }
  return url
    .replace('http://host.docker.internal', 'http://localhost')
    .replace('https://host.docker.internal', 'https://localhost');
}

/**
 * 모델 설정 조회 (DB에서 직접 조회)
 */
async function getModelConfig() {
  try {
    // 1. 새 테이블 구조에서 조회 시도
    const { getModelsFromTables } = await import('@/lib/modelTables');
    let categories = await getModelsFromTables();

    // 2. 새 테이블에 데이터가 없으면 레거시 model_config에서 조회
    if (!categories) {
      const { query } = await import('@/lib/postgres');
      const modelConfigResult = await query(
        'SELECT config FROM model_config WHERE config_type = $1',
        ['models']
      );

      if (modelConfigResult.rows.length > 0) {
        categories = modelConfigResult.rows[0].config?.categories || null;
      }
    }

    return categories ? { configType: 'models', categories } : null;
  } catch (error) {
    console.warn('[Model Config] 모델 설정 조회 실패:', error.message);
    return null;
  }
}

/**
 * 설정 조회 (DB에서 직접 조회)
 */
async function getSettings() {
  try {
    const { query } = await import('@/lib/postgres');
    const settingsResult = await query(
      'SELECT custom_endpoints FROM settings WHERE config_type = $1 LIMIT 1',
      ['general']
    );

    return settingsResult.rows.length > 0 ? settingsResult.rows[0] : null;
  } catch (error) {
    console.warn('[Settings] 설정 조회 실패:', error.message);
    return null;
  }
}

/**
 * 환경에 따른 기본 모델 매핑
 * 개발환경: gemma2:1b (단일 모델)
 * 실제환경: gpt-oss:20b, gpt-oss:120b (다중 모델)
 */
export const MODEL_CONFIG = {
  development: {
    models: [
      { id: 'gemma3:1b', label: 'Gemma 3 1B' },
      { id: 'gpt-oss:20b', label: 'GPT-OSS 20B' },
      { id: 'gpt-oss:120b', label: 'GPT-OSS 120B' },
    ],
    defaultModel: 'gemma3:1b',
  },
  production: {
    models: [
      { id: 'gpt-oss:20b', label: 'GPT-OSS 20B' },
      { id: 'gpt-oss:120b', label: 'GPT-OSS 120B' },
    ],
    defaultModel: 'gpt-oss:20b',
  },
};

/**
 * 현재 환경 확인
 */
export function getEnvironment() {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

/**
 * 현재 환경에 맞는 모델 옵션 반환
 */
export function getModelOptions() {
  const env = getEnvironment();
  return MODEL_CONFIG[env].models;
}

/**
 * 현재 환경의 기본 모델 반환
 */
export function getDefaultModel() {
  const env = getEnvironment();
  return MODEL_CONFIG[env].defaultModel;
}

/**
 * 모델 이름(표시 이름, UUID, 또는 모델명)을 실제 모델명(modelName)으로 변환
 * @param {string} modelName - 표시 이름, UUID, 또는 모델 이름
 * @returns {Promise<string>} 실제 모델명 (예: gemma3:1b)
 */
export async function resolveModelId(modelName) {
  if (!modelName) {
    return getDefaultModel();
  }

  try {
    // 캐시된 모델 설정 사용
    const modelConfig = await getModelConfig();

    if (modelConfig && modelConfig.categories) {
      // 모든 카테고리에서 모델 찾기
      const allModels = [];
      Object.values(modelConfig.categories).forEach((category) => {
        if (category.models && Array.isArray(category.models)) {
          allModels.push(...category.models);
        }
      });

      // 1. UUID로 찾기 (id 필드가 UUID인 경우)
      let foundModel = allModels.find((m) => m.id === modelName);
      if (foundModel) {
        // UUID로 찾았으면 modelName 반환 (실제 모델명)
        if (foundModel.modelName) {
          console.log(
            `[Model Resolver] UUID "${modelName}"을 모델명 "${foundModel.modelName}"으로 변환`
          );
          return foundModel.modelName;
        }
        // 하위 호환성: modelName이 없으면 id 반환
        return foundModel.id;
      }

      // 2. modelName 필드로 찾기 (레거시 또는 직접 모델명 입력)
      foundModel = allModels.find((m) => m.modelName === modelName);
      if (foundModel) {
        return foundModel.modelName;
      }

      // 3. 표시 이름(label)으로 찾기
      foundModel = allModels.find(
        (m) => m.label && m.label.toLowerCase() === modelName.toLowerCase()
      );
      if (foundModel) {
        const resultModelName = foundModel.modelName || foundModel.id;
        console.log(
          `[Model Resolver] 표시 이름 "${modelName}"을 모델명 "${resultModelName}"으로 변환`
        );
        return resultModelName;
      }

      // 4. 부분 일치로 찾기 (대소문자 무시)
      foundModel = allModels.find(
        (m) =>
          (m.label &&
            m.label.toLowerCase().includes(modelName.toLowerCase())) ||
          (m.modelName &&
            m.modelName.toLowerCase().includes(modelName.toLowerCase()))
      );
      if (foundModel) {
        const resultModelName = foundModel.modelName || foundModel.id;
        console.log(
          `[Model Resolver] 부분 일치 "${modelName}"을 모델명 "${resultModelName}"으로 변환`
        );
        return resultModelName;
      }
    }
  } catch (error) {
    console.warn(
      '[Model Resolver] 모델 설정 조회 실패, 원본 이름 사용:',
      error.message
    );
  }

  // 매핑을 찾지 못하면 원본 이름 반환 (이미 올바른 모델명일 수 있음)
  console.log(
    `[Model Resolver] 모델 매핑을 찾지 못함, 원본 이름 사용: "${modelName}"`
  );
  return modelName;
}

/**
 * 모델 ID(UUID 또는 모델명)에서 서버 이름을 찾습니다 (DB 설정에서 확인)
 * 동일한 표시 이름(label)을 가진 모델들의 서버 그룹을 찾습니다.
 * @param {string} modelId - 모델 ID (UUID 또는 모델명)
 * @returns {Promise<string | null>} 서버 이름 또는 null
 */
export async function getServerNameForModel(modelId) {
  if (!modelId) {
    return null;
  }

  try {
    // 캐시된 모델 설정 사용
    const modelConfig = await getModelConfig();

    if (modelConfig && modelConfig.categories) {
      // 모든 카테고리에서 모델 찾기
      const allModels = [];
      Object.values(modelConfig.categories).forEach((category) => {
        if (category.models && Array.isArray(category.models)) {
          allModels.push(...category.models);
        }
      });

      // 1. UUID로 정확히 찾기
      let foundModel = allModels.find((m) => m.id === modelId);

      if (!foundModel) {
        // 2. modelName으로 찾기
        foundModel = allModels.find((m) => m.modelName === modelId);
      }

      if (!foundModel) {
        // 3. 부분 매칭 시도 (modelName 기반)
        const modelBase = modelId.split(':')[0];
        foundModel = allModels.find((m) => {
          if (!m.modelName) return false;
          const mNameLower = m.modelName.toLowerCase();
          const modelIdLower = modelId.toLowerCase();
          // 정확히 포함되거나, 기본 이름이 일치하는 경우
          return (
            mNameLower.includes(modelIdLower) ||
            mNameLower.startsWith(modelBase.toLowerCase() + ':')
          );
        });
      }
      if (!foundModel) {
        // 4. 역방향 매칭 시도 (모델 설정의 modelName이 요청 모델 ID에 포함된 경우)
        // 예: modelId가 "gemma3:27b-it-qat"이고 설정에 "gemma3:27b"가 있으면 매칭
        foundModel = allModels.find(
          (m) =>
            m.modelName &&
            modelId.toLowerCase().includes(m.modelName.toLowerCase())
        );
      }

      if (foundModel && foundModel.label) {
        // 동일한 표시 이름(label)을 가진 모든 모델 찾기
        const targetLabel = foundModel.label.trim().toLowerCase();
        console.log(
          `[Model Server Resolver] 모델 "${modelId}" 검색 - 찾은 모델:`,
          {
            id: foundModel.id,
            modelName: foundModel.modelName,
            label: foundModel.label,
            targetLabel,
          }
        );
        console.log(
          `[Model Server Resolver] 전체 모델 수: ${allModels.length}, 각 모델의 label:`,
          allModels.map((m) => ({
            id: m.id,
            modelName: m.modelName,
            label: m.label,
            labelTrimmed: m.label?.trim().toLowerCase(),
          }))
        );

        const sameLabelModels = allModels.filter(
          (m) => m.label && m.label.trim().toLowerCase() === targetLabel
        );

        console.log(
          `[Model Server Resolver] 동일 표시 이름 "${foundModel.label}" 모델 ${sameLabelModels.length}개 찾음:`,
          sameLabelModels.map((m) => ({
            id: m.id,
            modelName: m.modelName,
            label: m.label,
            serverName: m.serverName,
            endpoint: normalizeEndpointForRuntime(m.endpoint),
          }))
        );

        // 같은 label을 가진 모델들의 서버 이름 수집
        const serverNames = new Set();
        for (const model of sameLabelModels) {
          // 모델 설정에 serverName이 있으면 사용
          if (model.serverName) {
            serverNames.add(model.serverName);
          } else {
            // modelName에서 서버 이름 파싱
            const modelNameToParse = model.modelName || model.id;
            const { serverName } = parseModelName(modelNameToParse);
            if (serverName) {
              serverNames.add(serverName);
            }
          }
        }

        // 같은 label을 가진 모델들이 같은 서버 그룹에 속해 있는지 확인
        if (serverNames.size === 1) {
          const serverName = Array.from(serverNames)[0];
          console.log(
            `[Model Server Resolver] 모델 "${modelId}" (표시 이름: "${foundModel.label}") -> 서버 그룹 "${serverName}" (동일 표시 이름 모델 ${sameLabelModels.length}개)`
          );
          return serverName;
        } else if (serverNames.size > 1) {
          console.warn(
            `[Model Server Resolver] 모델 "${modelId}" (표시 이름: "${
              foundModel.label
            }")는 여러 서버 그룹에 속해 있습니다: ${Array.from(
              serverNames
            ).join(', ')}`
          );
          // 첫 번째 서버 이름 반환 (또는 가장 일반적인 것)
          return Array.from(serverNames)[0];
        } else {
          // 서버 이름을 찾지 못한 경우, modelName에서 직접 파싱 시도
          const modelNameToParse = foundModel.modelName || foundModel.id;
          const { serverName } = parseModelName(modelNameToParse);
          if (serverName) {
            // 파싱된 서버 이름이 실제로 존재하는지 확인
            const serverEndpoints = await getModelServerEndpointsByName(
              serverName
            );
            if (serverEndpoints && serverEndpoints.length > 0) {
              console.log(
                `[Model Server Resolver] 모델 "${modelId}" -> 서버 그룹 "${serverName}" (모델명에서 파싱 및 검증)`
              );
              return serverName;
            } else {
              console.warn(
                `[Model Server Resolver] 모델 "${modelId}"에서 파싱한 서버 이름 "${serverName}"이 실제로 존재하지 않습니다.`
              );
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('[Model Server Resolver] 모델 설정 조회 실패:', error.message);
  }

  return null;
}

/**
 * Docker 환경 감지
 */
function isDockerEnvironment() {
  // Docker 환경 감지: 환경변수 또는 파일 시스템 확인
  if (typeof process !== 'undefined') {
    // Docker Compose나 Kubernetes 환경 변수 확인 (가장 신뢰할 수 있음)
    if (process.env.DOCKER_CONTAINER || process.env.KUBERNETES_SERVICE_HOST) {
      return true;
    }

    // /.dockerenv 파일 존재 확인 (동기 방식)
    try {
      // Node.js 환경에서만 동작
      if (typeof require !== 'undefined') {
        const fs = require('fs');
        if (fs.existsSync && fs.existsSync('/.dockerenv')) {
          return true;
        }
      }
    } catch (e) {
      console.debug(
        '[Model Servers] Docker env check failed:',
        e.message
      );
    }
  }
  return false;
}

/**
 * DB 설정에서 LLM_ENDPOINTS를 파싱해 전역 배열에 저장합니다.
 * 개발환경: http://localhost:11434 (단일 인스턴스)
 * 실제환경: 다중 인스턴스 (로드밸런싱)
 * 반환 형식: [{ url, provider }]
 */
export async function initModelServerEndpoints() {
  let parsed = [];

  // 서버 환경에서는 DB 설정에서만 로드
  if (typeof window === 'undefined') {
    try {
      const { query } = await import('@/lib/postgres');
      const settingsResult = await query(
        `SELECT 
          custom_endpoints, ollama_endpoints, 
          COALESCE(ollama_endpoints, '') as llm_endpoints
         FROM settings 
         WHERE config_type = 'general' 
         LIMIT 1`
      );
      const settings =
        settingsResult.rows.length > 0 ? settingsResult.rows[0] : null;

      // customEndpoints 우선, 없으면 legacy 필드 사용
      if (
        Array.isArray(settings?.customEndpoints) &&
        settings.customEndpoints.length > 0
      ) {
        parsed = settings.customEndpoints
          .filter((e) => e?.url)
          .map((e) => {
            const url = e.url.trim().toLowerCase();
            // URL 기반으로 provider 자동 감지 (우선순위: URL > 설정된 provider)
            let provider = e.provider;

            if (url.includes('generativelanguage.googleapis.com')) {
              // Gemini URL은 무조건 gemini로 설정
              provider = 'gemini';
              if (e.provider && e.provider !== 'gemini') {
                console.warn(
                  `[Model Servers] Gemini URL인데 provider가 '${e.provider}'로 설정되어 있습니다. 'gemini'로 자동 수정합니다.`,
                  { url: e.url, originalProvider: e.provider }
                );
              }
            } else if (url.includes('/v1/models') || url.includes('/v1/chat')) {
              // OpenAI 호환 URL은 무조건 openai-compatible로 설정
              provider = 'openai-compatible';
              if (e.provider && e.provider !== 'openai-compatible') {
                console.warn(
                  `[Model Servers] OpenAI 호환 URL인데 provider가 '${e.provider}'로 설정되어 있습니다. 'openai-compatible'로 자동 수정합니다.`,
                  { url: e.url, originalProvider: e.provider }
                );
              }
            } else if (!provider || provider === 'model-server') {
              // provider가 없거나 'model-server'인 경우, 기본값으로 설정
              provider = 'model-server';
            }
            // 그 외의 경우는 설정된 provider를 그대로 사용

            return {
              url: e.url.trim(),
              provider,
              apiKey: e.apiKey || '', // API key 추가
            };
          })
          .filter((e) => e.url);
      } else {
        const rawDb = settings?.llmEndpoints || settings?.ollamaEndpoints || '';
        const urlList = rawDb
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
          // name|url 또는 name=url 지원, url만 추출
          .map((entry) => {
            const m = entry.match(/^(.*?)\s*[|=｜＝]\s*(https?:\/\/.+)$/i);
            return m ? m[2].trim() : entry;
          });
        parsed = urlList.map((url) => ({
          url,
          provider: 'model-server', // legacy는 모두 model-server로 간주
        }));
      }
    } catch (e) {
      console.warn(
        '[Model Servers] DB에서 모델서버 로드 실패:',
        e?.message || e
      );
    }
  }

  // 환경변수에서 OLLAMA_ENDPOINTS 확인 (Docker 환경에서 유용)
  if (
    parsed.length === 0 &&
    typeof process !== 'undefined' &&
    process.env.OLLAMA_ENDPOINTS
  ) {
    const envEndpoints = process.env.OLLAMA_ENDPOINTS.split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    if (envEndpoints.length > 0) {
      parsed = envEndpoints.map((url) => ({
        url,
        provider: 'model-server', // 환경변수는 모두 model-server로 간주
      }));
      console.log(
        '[Model Servers] 환경변수 OLLAMA_ENDPOINTS에서 모델 서버 로드:',
        parsed.map((e) => e.url)
      );
    }
  }

  // 최종 기본값 (DB에 설정이 없을 경우에만)
  if (parsed.length === 0) {
    const env = getEnvironment();
    const isDocker = isDockerEnvironment();

    if (env === 'development') {
      // Docker 환경에서는 host.docker.internal 사용
      if (isDocker) {
        parsed = [
          {
            url: 'http://host.docker.internal:11434',
            provider: 'model-server',
          },
        ];
        console.log(
          '[개발환경/Docker] DB 설정이 없어 기본 모델 서버 사용: http://host.docker.internal:11434'
        );
      } else {
        parsed = [{ url: 'http://localhost:11434', provider: 'model-server' }];
        console.log(
          '[개발환경] DB 설정이 없어 기본 모델 서버 사용: http://localhost:11434'
        );
      }
    } else {
      // 프로덕션 환경에서도 Docker인 경우 기본값 제공
      if (isDocker) {
        parsed = [
          {
            url: 'http://host.docker.internal:11434',
            provider: 'model-server',
          },
        ];
        console.warn(
          '[프로덕션/Docker] DB 설정이 없어 기본 모델 서버 사용: http://host.docker.internal:11434'
        );
        console.warn(
          '[프로덕션/Docker] 관리자 설정에서 모델서버를 등록하는 것을 권장합니다.'
        );
      } else {
        console.warn(
          '[프로덕션] DB 설정에서 모델서버 정보를 찾을 수 없습니다. 관리자 설정에서 모델서버를 등록해주세요.'
        );
        // 프로덕션에서는 기본값을 사용하지 않음
        parsed = [];
      }
    }
  }

  endpoints = parsed;
  if (endpoints.length > 0) {
    console.log(
      `[${getEnvironment()}] 모델 서버 초기화:`,
      endpoints.map((e) => `${e.url} (${e.provider})`)
    );
  } else {
    console.warn(`[${getEnvironment()}] 모델 서버가 설정되지 않았습니다.`);
  }
}

/**
 * 서버 이름으로 같은 이름을 가진 모든 모델 서버 엔드포인트 찾기
 * @param {string} serverName - 서버 이름 (예: "spark-ollama")
 * @returns {Promise<Array<{endpoint: string, provider: string}>>} 찾은 엔드포인트 목록
 */
export async function getModelServerEndpointsByName(serverName) {
  if (!serverName) return [];

  try {
    // 캐시된 설정 사용
    const settings = await getSettings();
    const customEndpoints = settings?.custom_endpoints || null;

    if (customEndpoints && Array.isArray(customEndpoints)) {
      const found = customEndpoints
        .filter(
          (e) =>
            e?.name &&
            e.name.trim().toLowerCase() === serverName.trim().toLowerCase() &&
            e?.url &&
            e.isActive !== false // 비활성화된 서버 제외 (기본값은 활성화)
        )
        .map((e) => ({
          endpoint: e.url.trim(),
          provider:
            e.provider === 'openai-compatible'
              ? 'openai-compatible'
              : e.provider === 'gemini'
              ? 'gemini'
              : 'model-server',
          apiKey: e.apiKey || '', // API key 추가
        }));

      return found;
    }
  } catch (error) {
    console.warn(
      '[Model Servers] 서버 이름으로 엔드포인트 찾기 실패:',
      error.message
    );
  }

  return [];
}

/**
 * 동일한 표시 이름을 가진 모델들의 endpoint를 수집합니다
 * @param {string} modelId - 모델 ID
 * @returns {Promise<Array<{endpoint: string, provider: string}>>} endpoint 목록
 */
export async function getEndpointsByLabel(modelId) {
  if (!modelId) return [];

  try {
    // 캐시된 모델 설정 사용
    const modelConfig = await getModelConfig();

    if (!modelConfig || !modelConfig.categories) {
      return [];
    }

    // 모든 카테고리에서 모델 찾기
    const allModels = [];
    Object.values(modelConfig.categories).forEach((category) => {
      if (category.models && Array.isArray(category.models)) {
        allModels.push(...category.models);
      }
    });

    // 1. UUID로 정확히 찾기
    let foundModel = allModels.find((m) => m.id === modelId);

    if (!foundModel) {
      // 2. modelName으로 찾기
      foundModel = allModels.find((m) => m.modelName === modelId);
    }

    if (!foundModel) {
      // 3. 부분 매칭 시도 (modelName 기반)
      const modelBase = modelId.split(':')[0];
      foundModel = allModels.find((m) => {
        if (!m.modelName) return false;
        const mNameLower = m.modelName.toLowerCase();
        const modelIdLower = modelId.toLowerCase();
        return (
          mNameLower.includes(modelIdLower) ||
          mNameLower.startsWith(modelBase.toLowerCase() + ':')
        );
      });
    }

    if (!foundModel) {
      // 4. 역방향 매칭 시도
      foundModel = allModels.find(
        (m) =>
          m.modelName &&
          modelId.toLowerCase().includes(m.modelName.toLowerCase())
      );
    }

    if (!foundModel || !foundModel.label) {
      console.log(
        `[getEndpointsByLabel] 모델 "${modelId}" - foundModel 또는 label이 없음`
      );
      return [];
    }

    // 동일한 표시 이름을 가진 모든 모델 찾기
    const targetLabel = foundModel.label.trim().toLowerCase();
    console.log(`[getEndpointsByLabel] 모델 "${modelId}" 검색 - 찾은 모델:`, {
      id: foundModel.id,
      modelName: foundModel.modelName,
      label: foundModel.label,
      targetLabel,
        endpoint: normalizeEndpointForRuntime(foundModel.endpoint),
    });
    console.log(
      `[getEndpointsByLabel] 전체 모델 수: ${allModels.length}, 각 모델의 label과 endpoint:`,
      allModels.map((m) => ({
        id: m.id,
        modelName: m.modelName,
        label: m.label,
        labelTrimmed: m.label?.trim().toLowerCase(),
        endpoint: normalizeEndpointForRuntime(m.endpoint),
      }))
    );

    const sameLabelModels = allModels.filter(
      (m) => m.label && m.label.trim().toLowerCase() === targetLabel
    );

    console.log(
      `[getEndpointsByLabel] 동일 표시 이름 "${foundModel.label}" 모델 ${sameLabelModels.length}개 찾음:`,
      sameLabelModels.map((m) => ({
        id: m.id,
        modelName: m.modelName,
        label: m.label,
        endpoint: m.endpoint,
      }))
    );

    if (sameLabelModels.length === 0) {
      console.log(
        `[getEndpointsByLabel] 동일 표시 이름을 가진 모델이 없습니다`
      );
      return [];
    }

    // 모든 모델의 endpoint 수집
    const endpoints = [];
    const endpointSet = new Set(); // 중복 제거용

    for (const model of sameLabelModels) {
      if (!model.endpoint) continue;

      const endpoint = normalizeEndpointForRuntime(model.endpoint.trim());
      if (endpointSet.has(endpoint)) continue; // 이미 추가된 endpoint는 제외

      // endpoint에서 provider 확인 (URL 기반 자동 감지 + customEndpoints에서 찾기)
      let provider = 'model-server'; // 기본값

      // URL 기반으로 provider 자동 감지 (우선순위: URL > DB 설정)
      const url = endpoint.toLowerCase();
      if (url.includes('generativelanguage.googleapis.com')) {
        provider = 'gemini';
      } else if (url.includes('/v1/models') || url.includes('/v1/chat')) {
        provider = 'openai-compatible';
      } else {
        // URL 기반 감지 실패 시 캐시된 설정에서 확인
        try {
          const settings = await getSettings();
          const customEndpoints = settings?.custom_endpoints || null;

          if (customEndpoints && Array.isArray(customEndpoints)) {
            const epConfig = customEndpoints.find(
              (e) => e.url && e.url.trim() === endpoint
            );
            if (epConfig && epConfig.provider) {
              // DB에서 찾은 provider도 URL 기반으로 재확인
              const dbUrl = epConfig.url.toLowerCase();
              if (dbUrl.includes('generativelanguage.googleapis.com')) {
                provider = 'gemini';
              } else if (
                dbUrl.includes('/v1/models') ||
                dbUrl.includes('/v1/chat')
              ) {
                provider = 'openai-compatible';
              } else {
                provider =
                  epConfig.provider === 'openai-compatible'
                    ? 'openai-compatible'
                    : epConfig.provider === 'gemini'
                    ? 'gemini'
                    : 'model-server';
              }
            }
          }
        } catch (e) {
          console.warn(
            '[getEndpointsByLabel] provider 확인 실패:',
            e.message
          );
        }
      }

      endpoints.push({
        endpoint,
        provider,
        apiKey: model.apiKey || '',
      });
      endpointSet.add(endpoint);
    }

    if (endpoints.length > 0) {
      console.log(
        `[Model Server Resolver] 모델 "${modelId}" (표시 이름: "${foundModel.label}") -> ${endpoints.length}개 endpoint (동일 표시 이름 모델 ${sameLabelModels.length}개)`
      );
    }

    return endpoints;
  } catch (error) {
    console.warn(
      '[Model Server Resolver] 표시 이름 기반 endpoint 조회 실패:',
      error.message
    );
    return [];
  }
}

/**
 * 서버 이름으로 모델 서버 엔드포인트 찾기 (하위 호환성)
 * 같은 이름을 가진 서버가 여러 개 있으면 라운드로빈으로 선택
 * @param {string} serverName - 서버 이름 (예: "spark-ollama")
 * @returns {Promise<{endpoint: string, provider: string, index: number} | null>} 찾은 엔드포인트 정보 또는 null
 */
const serverNameCursors = new Map(); // 서버 이름별 라운드로빈 커서

export async function getModelServerEndpointByName(serverName) {
  if (!serverName) return null;

  const endpoints = await getModelServerEndpointsByName(serverName);

  if (endpoints.length === 0) {
    return null;
  }

  // 같은 이름의 서버가 여러 개 있으면 라운드로빈
  if (endpoints.length > 1) {
    const currentCursor = serverNameCursors.get(serverName) || 0;
    const selectedIndex = currentCursor % endpoints.length;
    const selected = endpoints[selectedIndex];

    // 커서 업데이트
    serverNameCursors.set(serverName, (currentCursor + 1) % endpoints.length);

    console.log(
      `[Model Servers] 서버 "${serverName}" 라운드로빈: ${selectedIndex + 1}/${
        endpoints.length
      } -> ${selected.endpoint}`
    );

    return {
      endpoint: selected.endpoint,
      provider: selected.provider,
      apiKey: selected.apiKey || '',
      index: selectedIndex,
    };
  }

  // 서버가 하나만 있으면 그대로 반환
  return {
    endpoint: endpoints[0].endpoint,
    provider: endpoints[0].provider,
    apiKey: endpoints[0].apiKey || '',
    index: 0,
  };
}

/**
 * 동일한 표시 이름을 가진 모델들의 endpoint 중 하나를 라운드로빈으로 선택
 * @param {string} modelId - 모델 ID
 * @returns {Promise<{endpoint: string, provider: string, index: number} | null>} 선택된 엔드포인트 정보 또는 null
 */
const labelCursors = new Map(); // 표시 이름별 라운드로빈 커서

export async function getModelServerEndpointByLabel(modelId) {
  if (!modelId) return null;

  try {
    // 캐시된 모델 설정 사용
    const modelConfig = await getModelConfig();

    if (!modelConfig || !modelConfig.categories) {
      return null;
    }

    // 모든 카테고리에서 모델 찾기
    const allModels = [];
    Object.values(modelConfig.categories).forEach((category) => {
      if (category.models && Array.isArray(category.models)) {
        allModels.push(...category.models);
      }
    });

    // 1. UUID로 정확히 찾기
    let foundModel = allModels.find((m) => m.id === modelId);

    if (!foundModel) {
      // 2. modelName으로 찾기
      foundModel = allModels.find((m) => m.modelName === modelId);
    }

    if (!foundModel) {
      // 3. 부분 매칭 시도 (modelName 기반)
      const modelBase = modelId.split(':')[0];
      foundModel = allModels.find((m) => {
        if (!m.modelName) return false;
        const mNameLower = m.modelName.toLowerCase();
        const modelIdLower = modelId.toLowerCase();
        return (
          mNameLower.includes(modelIdLower) ||
          mNameLower.startsWith(modelBase.toLowerCase() + ':')
        );
      });
    }

    if (!foundModel) {
      // 4. 역방향 매칭 시도
      foundModel = allModels.find(
        (m) =>
          m.modelName &&
          modelId.toLowerCase().includes(m.modelName.toLowerCase())
      );
    }

    if (!foundModel || !foundModel.label) {
      return null;
    }

    // 표시 이름을 키로 사용
    const labelKey = foundModel.label.trim().toLowerCase();
    const endpoints = await getEndpointsByLabel(modelId);

    if (endpoints.length === 0) {
      return null;
    }

    // 동일한 표시 이름을 가진 모델들의 endpoint가 여러 개 있으면 라운드로빈
    if (endpoints.length > 1) {
      const currentCursor = labelCursors.get(labelKey) || 0;
      const selectedIndex = currentCursor % endpoints.length;
      const selected = endpoints[selectedIndex];

      // 커서 업데이트 (표시 이름을 키로 사용)
      labelCursors.set(labelKey, (currentCursor + 1) % endpoints.length);

      console.log(
        `[Model Servers] 표시 이름 기반 라운드로빈 (표시 이름 "${
          foundModel.label
        }", 모델 "${modelId}"): ${selectedIndex + 1}/${endpoints.length} -> ${
          selected.endpoint
        }`
      );

      return {
        endpoint: selected.endpoint,
        provider: selected.provider,
        apiKey: selected.apiKey || '',
        index: selectedIndex,
      };
    }

    // endpoint가 하나만 있으면 그대로 반환
    return {
      endpoint: endpoints[0].endpoint,
      provider: endpoints[0].provider,
      apiKey: endpoints[0].apiKey || '',
      index: 0,
    };
  } catch (error) {
    console.warn(
      '[Model Server Resolver] 표시 이름 기반 endpoint 선택 실패:',
      error.message
    );
    return null;
  }
}

/**
 * 모델 이름에서 서버 이름과 실제 모델 이름 파싱
 * 형식: {server-name}-{model-name} 또는 {server-name}:{model-name}
 * 예: "spark-ollama-gemma3:27b" -> { serverName: "spark-ollama", modelName: "gemma3:27b" }
 * @param {string} modelName - 전체 모델 이름
 * @returns {{ serverName: string | null, modelName: string }} 파싱된 서버 이름과 모델 이름
 */
export function parseModelName(modelName) {
  if (!modelName || typeof modelName !== 'string') {
    return { serverName: null, modelName: modelName || '' };
  }

  // 형식 1: {server-name}-{model-name} (하이픈으로 구분)
  // 마지막 하이픈 이후가 모델 이름이 되도록 함 (모델 이름에 하이픈이 있을 수 있음)
  // 하지만 서버 이름이 명확하게 구분되어야 함
  // 예: "spark-ollama-gemma3:27b" -> 서버: "spark-ollama", 모델: "gemma3:27b"

  // 먼저 콜론(:)이 있는지 확인 (모델 이름에 콜론이 있을 수 있음)
  const colonIndex = modelName.lastIndexOf(':');

  if (colonIndex > 0) {
    // 콜론이 있으면, 콜론 앞부분에서 서버 이름 찾기
    const beforeColon = modelName.substring(0, colonIndex);
    const afterColon = modelName.substring(colonIndex + 1);

    // 하이픈으로 구분된 부분 찾기 (마지막 하이픈 전까지가 서버 이름일 수 있음)
    const lastHyphenIndex = beforeColon.lastIndexOf('-');

    if (lastHyphenIndex > 0) {
      const potentialServerName = beforeColon.substring(0, lastHyphenIndex);
      const potentialModelPrefix = beforeColon.substring(lastHyphenIndex + 1);

      // 서버 이름이 2글자 이상이고, 모델 이름이 있으면 파싱 성공
      if (potentialServerName.length >= 2 && potentialModelPrefix.length > 0) {
        return {
          serverName: potentialServerName,
          modelName: `${potentialModelPrefix}:${afterColon}`,
        };
      }
    }
  } else {
    // 콜론이 없으면 하이픈으로만 구분
    // 마지막 하이픈을 기준으로 분리 (서버 이름은 최소 2글자 이상)
    const parts = modelName.split('-');
    if (parts.length >= 3) {
      // 마지막 부분을 제외한 나머지를 서버 이름으로
      const serverNameParts = parts.slice(0, -1);
      const modelNamePart = parts[parts.length - 1];

      if (serverNameParts.join('-').length >= 2 && modelNamePart.length > 0) {
        return {
          serverName: serverNameParts.join('-'),
          modelName: modelNamePart,
        };
      }
    }
  }

  // 파싱 실패 시 서버 이름 없음
  return { serverName: null, modelName: modelName };
}

/**
 * 라운드‑로빈으로 다음 모델서버를 반환합니다.
 * 처음 호출 시 initModelServerEndpoints() 가 자동으로 실행됩니다.
 * @returns {Promise<string>} 모델 서버 URL
 */
let cursor = 0;
export async function getNextModelServerEndpoint() {
  if (endpoints.length === 0) await initModelServerEndpoints();

  // 모델 서버가 설정되지 않은 경우
  if (endpoints.length === 0) {
    console.warn('[Model Servers] 모델 서버가 설정되지 않았습니다.');
    return null;
  }

  const ep = endpoints[cursor];
  cursor = (cursor + 1) % endpoints.length;

  // ep가 undefined인 경우 처리
  if (!ep) {
    console.warn('[Model Servers] 모델 서버 엔드포인트를 찾을 수 없습니다.');
    return null;
  }

  return ep.url || ep; // 하위 호환성: 객체 또는 문자열 모두 지원
}

// 현재 라운드로빈 인덱스 반환 (로깅용)
export function getCurrentRoundRobinIndex() {
  return cursor;
}

// 라운드로빈과 모델서버를 함께 반환 (상세 로깅용)
// @returns {Promise<{ endpoint: string, provider: string, index: number }>}
export async function getNextModelServerEndpointWithIndex() {
  if (endpoints.length === 0) await initModelServerEndpoints();
  const currentIndex = cursor;
  const ep = endpoints[cursor];
  cursor = (cursor + 1) % endpoints.length;
  return {
    endpoint: ep.url || ep, // 하위 호환성
    provider: ep.provider || 'model-server', // 기본값은 model-server
    apiKey: ep.apiKey || '',
    index: currentIndex,
  };
}

// 하위 호환성을 위한 별칭 (점진적 마이그레이션)
export const initLlmEndpoints = initModelServerEndpoints;
export const getNextLlmEndpoint = getNextModelServerEndpoint;
export const getNextLlmEndpointWithIndex = getNextModelServerEndpointWithIndex;
export const initOllamaEndpoints = initModelServerEndpoints;
export const getNextOllamaEndpoint = getNextModelServerEndpoint;
export const getNextOllamaEndpointWithIndex =
  getNextModelServerEndpointWithIndex;
