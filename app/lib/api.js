/**
 * 사용 가능한 직접 연결된 모델 서버 모델 목록을 가져옵니다.
 * @param {object} headers - API 요청에 사용할 헤더입니다.
 * @returns {Promise<object>} 모델 설정 데이터입니다.
 */
export async function fetchDirectModels(headers) {
  try {
    const response = await fetch('/api/models', { headers });
    if (!response.ok) {
      throw new Error(`Direct 모델 로드 실패: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('fetchDirectModels API 호출 실패:', error);
    throw error;
  }
}

/**
 * 채팅 메시지를 보내고 스트리밍 응답을 받습니다.
 * @param {string} apiEndpoint - '/api/webapp-generate'
 * @param {object} payload - API에 전송할 데이터
 * @param {AbortSignal} signal - 요청 중단을 위한 AbortSignal
 * @returns {Promise<Response>} fetch 응답 객체
 */
export async function sendChatMessage(apiEndpoint, payload, signal) {
  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
      body: JSON.stringify(payload),
      signal: signal,
    });

    if (!response.ok) {
      // 응답 본문을 텍스트로 먼저 읽기 (JSON 파싱 실패 대비)
      let responseText = '';
      let errorData = {};
      try {
        responseText = await response.text();
        if (responseText) {
          try {
            errorData = JSON.parse(responseText);
          } catch (error) {
            console.warn('[Catch] 에러 발생:', error.message);
            // JSON이 아닌 경우 텍스트 그대로 사용
            errorData = { error: responseText };
          }
        }
      } catch (e) {
        console.warn('응답 본문 읽기 실패:', e);
      }

      // 에러 로그에 response 정보 포함
      const timestamp = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
      });
      const isQuotaError =
        response.status === 429 &&
        (errorData?.error?.code === 'insufficient_quota' ||
          (errorData?.error?.message || responseText || '')
            .toLowerCase()
            .includes('exceeded your current quota'));
      const isNotFoundError = response.status === 404;
      const logFn = isQuotaError || isNotFoundError ? console.warn : console.error;
      logFn(
        `ERROR ${timestamp} ${response.status} ${response.statusText} POST ${apiEndpoint}`,
        {
          url: apiEndpoint,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          response: responseText || errorData,
          request: {
            model: payload?.model,
            method: 'POST',
          },
        }
      );

      // 에러 메시지 구성
      let errorMessage =
        errorData.error ||
        `모델 호출에 실패했습니다. (HTTP ${response.status})`;

      // 모델 이름 정규화 함수
      const normalizeModelInMessage = (
        message,
        originalModel,
        normalizedModel
      ) => {
        if (!message || !originalModel || !normalizedModel) return message;

        let normalized = message;

        // 1. 원본 모델 이름 직접 대체
        if (normalized.includes(originalModel)) {
          normalized = normalized.replace(
            new RegExp(
              originalModel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              'g'
            ),
            normalizedModel
          );
        }

        // 2. "models/" 접두사가 포함된 경우도 대체
        const modelWithPrefix = `models/${normalizedModel}`;
        if (normalized.includes(modelWithPrefix)) {
          normalized = normalized.replace(
            new RegExp(
              modelWithPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              'g'
            ),
            normalizedModel
          );
        }

        // 3. 따옴표로 감싸진 모델 이름 패턴 대체 (예: 'models/gemini-2.0-flash')
        const quotedModelPattern = /(['"])(models\/[^'"]+)\1/gi;
        normalized = normalized.replace(
          quotedModelPattern,
          (match, quote, modelName) => {
            const normalizedName = modelName.startsWith('models/')
              ? modelName.substring(7)
              : modelName;
            return `${quote}${normalizedName}${quote}`;
          }
        );

        // 4. 따옴표 없이 사용된 모델 이름 패턴도 처리
        const unquotedModelPattern = /models\/([a-zA-Z0-9_\-:.]+)/g;
        normalized = normalized.replace(
          unquotedModelPattern,
          (match, modelName) => {
            return modelName.split(':')[0].trim();
          }
        );

        return normalized;
      };

      // 에러 메시지 정규화 (원본 모델 이름 제거)
      const originalModel = errorData.originalModel || payload?.model;
      let normalizedModel = errorData.normalizedModel;

      // normalizedModel이 없으면 원본 모델에서 직접 정규화
      if (!normalizedModel && originalModel) {
        normalizedModel = originalModel.trim();
        if (normalizedModel.startsWith('models/')) {
          normalizedModel = normalizedModel.substring(7);
        }
        normalizedModel = normalizedModel.split(':')[0].trim();
        normalizedModel = normalizedModel.split('/').pop().trim();
      }

      if (
        originalModel &&
        normalizedModel &&
        originalModel !== normalizedModel
      ) {
        errorMessage = normalizeModelInMessage(
          errorMessage,
          originalModel,
          normalizedModel
        );
      }

      // 상세 정보가 있으면 추가 (정규화 후)
      if (errorData.details && errorData.details !== errorMessage) {
        let normalizedDetails = errorData.details;
        if (originalModel && normalizedModel) {
          normalizedDetails = normalizeModelInMessage(
            normalizedDetails,
            originalModel,
            normalizedModel
          );
        }
        errorMessage += `\n\n상세 정보: ${normalizedDetails}`;
      }

      // 모델 정보가 있으면 추가
      if (errorData.originalModel || errorData.normalizedModel) {
        errorMessage += `\n\n모델 정보:`;
        if (errorData.originalModel) {
          errorMessage += `\n- 원본 모델: ${errorData.originalModel}`;
        }
        if (errorData.normalizedModel) {
          errorMessage += `\n- 정규화된 모델: ${errorData.normalizedModel}`;
        }
      }

      throw new Error(errorMessage);
    }
    return response; // 스트리밍 처리를 위해 응답 객체 자체를 반환
  } catch (error) {
    const message = error?.message || '';
    const isQuotaError =
      /insufficient_quota|exceeded your current quota/i.test(message);
    const isNotFoundError = /http 404|not found/i.test(message);
    const logFn = isQuotaError || isNotFoundError ? console.warn : console.error;
    logFn('sendChatMessage API 호출 실패:', error);
    throw error;
  }
}

/**
 * 메시지를 대화 기록에 저장합니다.
 * @param {string} roomId - 채팅방 ID
 * @param {object} messagePayload - 저장할 메시지 데이터
 * @returns {Promise<object>} 저장 결과
 */
export async function saveMessageToHistory(roomId, messagePayload) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`/api/webapp-chat/history/${roomId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(messagePayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `메시지 저장 실패 (HTTP ${response.status})`
      );
    }

    return await response.json();
  } catch (error) {
    console.error('saveMessageToHistory API 호출 실패:', error);
    throw error;
  }
}
