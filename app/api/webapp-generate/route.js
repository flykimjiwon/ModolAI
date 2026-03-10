import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { updateLastActive } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import {
  getNextModelServerEndpointWithIndex,
  parseModelName,
  getModelServerEndpointByName,
  resolveModelId,
} from '@/lib/modelServers';
import {
  logModelServerRequest,
  logModelServerAPICall,
} from '@/lib/modelServerMonitor';
import { getClientIP } from '@/lib/ip';
import { logInfo, logWarn } from '@/lib/instanceLogger';
import { logExternalApiRequest } from '@/lib/externalApiLogger';
import { detectAndMaskPII } from '@/lib/piiFilter';

export const runtime = 'nodejs';

// 이 파일은 모델 검증 및 프롬프트 엔지니어링 없이 가장 기본적인 LLM 프록시 기능만 수행합니다.

function getValueByPath(source, path) {
  if (!source || !path) return undefined;
  const tokens = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let current = source;
  for (const token of tokens) {
    if (current == null) return undefined;
    current = current[token];
  }
  return current;
}

function applyTemplate(value, context) {
  if (typeof value === 'string') {
    if (value === '{{messages}}') return context.messages;
    if (value === '{{message}}') return context.message;
    let output = value;
    if (output.includes('{{OPENAI_API_KEY}}')) {
      output = output.replaceAll(
        '{{OPENAI_API_KEY}}',
        context.apiKey || ''
      );
    }
    if (output.includes('{{messages}}')) {
      output = output.replaceAll(
        '{{messages}}',
        JSON.stringify(context.messages)
      );
    }
    if (output.includes('{{message}}')) {
      output = output.replaceAll('{{message}}', context.message || '');
    }
    return output;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyTemplate(item, context));
  }
  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, val]) => {
      next[key] = applyTemplate(val, context);
    });
    return next;
  }
  return value;
}

function normalizeResponsesContent(content, role) {
  const isAssistant = role === 'assistant';
  const textType = isAssistant ? 'output_text' : 'input_text';
  if (typeof content === 'string') {
    return content ? [{ type: textType, text: content }] : [];
  }
  if (!Array.isArray(content)) {
    const text = content ? String(content) : '';
    return text ? [{ type: textType, text }] : [];
  }
  return content
    .map((item) => {
      if (typeof item === 'string') {
        return item ? { type: textType, text: item } : null;
      }
      if (!item || typeof item !== 'object') return null;
      if (item.type === 'input_text' || item.type === 'input_image') {
        return item;
      }
      if (item.type === 'text') {
        return item.text ? { type: textType, text: item.text } : null;
      }
      if (item.type === 'image_url') {
        const url = item.image_url?.url || item.url;
        if (isAssistant) return null;
        return url ? { type: 'input_image', image_url: url } : null;
      }
      return null;
    })
    .filter(Boolean);
}

function convertToResponsesInput(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: normalizeResponsesContent(msg.content, msg.role),
  }));
}

function normalizeImageInput(image) {
  if (!image) return null;
  let dataUrl = null;
  let mimeType = null;
  let name = null;
  let size = null;

  if (typeof image === 'string') {
    dataUrl = image;
  } else if (typeof image === 'object') {
    dataUrl = image.dataUrl || image.url || image.data || null;
    mimeType = image.type || image.mimeType || null;
    name = image.name || null;
    size = Number.isFinite(image.size) ? image.size : null;
  }

  if (!dataUrl) return null;

  let data = '';
  if (dataUrl.startsWith('data:')) {
    const [meta, base64] = dataUrl.split(',');
    data = base64 || '';
    if (!mimeType) {
      const match = meta.match(/data:(.*?);base64/i);
      if (match) {
        mimeType = match[1];
      }
    }
  } else {
    data = dataUrl;
  }

  return {
    dataUrl,
    data,
    mimeType: mimeType || 'image/jpeg',
    name,
    size,
  };
}

function ensureDataUrl(image) {
  if (!image) return '';
  if (image.dataUrl && image.dataUrl.startsWith('data:')) {
    return image.dataUrl;
  }
  const data = image.data || '';
  return `data:${image.mimeType || 'image/jpeg'};base64,${data}`;
}

function buildUserContent(text, images) {
  if (!images || images.length === 0) return text;
  const content = [];
  if (text) {
    content.push({ type: 'text', text });
  }
  images.forEach((image) => {
    const url = ensureDataUrl(image);
    if (url) {
      content.push({ type: 'image_url', image_url: { url } });
    }
  });
  return content;
}

function parseDataUrl(url) {
  if (!url) return { data: '', mimeType: 'image/jpeg' };
  if (url.startsWith('data:')) {
    const [meta, base64] = url.split(',');
    const match = meta.match(/data:(.*?);base64/i);
    return {
      data: base64 || '',
      mimeType: match?.[1] || 'image/jpeg',
    };
  }
  return { data: url, mimeType: 'image/jpeg' };
}

async function findModelRecord(modelId) {
  if (!modelId) return null;
  try {
    const { getModelsFromTables } = await import('@/lib/modelTables');
    let categories = await getModelsFromTables();

    if (!categories) {
      const { query } = await import('@/lib/postgres');
      const modelConfigResult = await query(
        'SELECT config FROM model_config WHERE config_type = $1 LIMIT 1',
        ['models']
      );
      categories = modelConfigResult.rows[0]?.config?.categories || null;
    }

    if (!categories) return null;

    const allModels = [];
    Object.values(categories).forEach((category) => {
      if (category.models && Array.isArray(category.models)) {
        allModels.push(...category.models);
      }
    });

    let found = allModels.find((m) => m.id === modelId);
    if (!found) {
      found = allModels.find((m) => m.modelName === modelId);
    }
    if (!found) {
      found = allModels.find(
        (m) => m.label && m.label.toLowerCase() === String(modelId).toLowerCase()
      );
    }
    if (!found) {
      const modelBase = String(modelId).split(':')[0];
      found = allModels.find((m) => {
        if (!m.modelName) return false;
        const mNameLower = m.modelName.toLowerCase();
        const modelIdLower = String(modelId).toLowerCase();
        return (
          mNameLower.includes(modelIdLower) ||
          mNameLower.startsWith(modelBase.toLowerCase() + ':')
        );
      });
    }
    return found || null;
  } catch (error) {
    console.warn('[Model Config] 모델 설정 조회 실패:', error.message);
    return null;
  }
}

function applyMultiturnLimit(history, limit, unlimited) {
  if (!Array.isArray(history)) return history;
  if (unlimited) return history;
  const numericLimit = Number.parseInt(limit, 10);
  if (!numericLimit || numericLimit <= 0) return history;
  return history.slice(-(numericLimit * 2));
}

function buildMessagesWithResponse(baseMessages, responseText) {
  if (!responseText) return baseMessages;
  return [
    ...baseMessages,
    {
      role: 'assistant',
      content: responseText,
    },
  ];
}

function getApiTypeForLog(requestPurpose) {
  const normalizedPurpose = String(requestPurpose || '').trim().toLowerCase();

  if (normalizedPurpose === 'image-analysis') {
    return 'image-analysis';
  }

  if (
    normalizedPurpose === 'ppt-generate' ||
    normalizedPurpose === 'ppt-generation' ||
    normalizedPurpose === 'ppt'
  ) {
    return 'ppt-generate';
  }

  return 'chat';
}

async function logImageAnalysisToMessages({
  requestPurpose,
  roomId,
  userId,
  userRole,
  model,
  text,
  clientIP,
}) {
  if (requestPurpose !== 'image-analysis') return;
  if (!roomId || !userId) return;
  const normalizedText = typeof text === 'string' ? text.trim() : '';
  if (!normalizedText) return;

  try {
    await query(
      `INSERT INTO messages (role, user_role, model, text, room_id, user_id, client_ip, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'assistant',
        userRole || 'user',
        model || null,
        `[image-analysis]\n${normalizedText}`,
        roomId,
        userId,
        clientIP || null,
        new Date(),
      ]
    );
  } catch (error) {
    console.warn('[image-analysis] messages 로그 저장 실패:', error?.message || error);
  }
}

export async function POST(request) {
  try {
    // 클라이언트 IP 및 사용자 정보 추출
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';

    // 요청 시작 로그
    logInfo('AI 생성 요청 시작', {
      userAgent,
      ip: clientIP,
    });

    // JWT 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      logWarn('인증 실패: Bearer 토큰 없음');
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }
    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      console.warn('[Catch] 에러 발생:', error.message);
      return NextResponse.json({ error: '잘못된 토큰' }, { status: 401 });
    }

    // 마지막 활동 시각 기록 (10분 throttle)
    if (payload?.sub) updateLastActive(payload.sub);

    // 클라이언트 페이로드
    const {
      roomId,
      model, // 모델 UUID 또는 모델명
      prompt: clientOriginalPrompt, // 'prompt' 변수 이름을 변경하여 충돌 방지
      question,
      multiturnHistory = [],
      images = [],
      piiInputProcessed = false,
      requestPurpose = 'chat',
      ...llmPayload
    } = await request.json();

    const normalizedImages = Array.isArray(images)
      ? images.map(normalizeImageInput).filter(Boolean)
      : [];
    if (normalizedImages.length > 0) {
      console.log(
        `[generate] 이미지 ${normalizedImages.length}개 수신`,
        normalizedImages.map((image, index) => ({
          index: index + 1,
          name: image.name || 'unknown',
          size: Number.isFinite(image.size) ? image.size : null,
          mimeType: image.mimeType,
        }))
      );
    }

    // 모델 UUID를 실제 모델명으로 변환
    const actualModelName = await resolveModelId(model);
    const matchedModel = await findModelRecord(actualModelName);

    console.log('[generate] 모델 정보:', {
      originalModel: model,
      actualModelName: actualModelName,
    });

    // 최종 프롬프트 구성 (로깅용)
    const finalPrompt = clientOriginalPrompt || question || '';

    console.log(
      '[generate] 클라이언트에서 받은 원본 multiturnHistory:',
      multiturnHistory
    );
    console.log('[generate] 클라이언트에서 받은 원본 question:', question);

    // PostgreSQL 클라이언트 연결

    const fileContent = '';
    const filteredMultiturnHistory = applyMultiturnLimit(
      multiturnHistory,
      matchedModel?.multiturnLimit,
      matchedModel?.multiturnUnlimited
    );

    // 모델별 시스템 프롬프트 및 모델 지정 모델서버 조회 (UUID 사용)
    let systemPrompt = null;
    let modelEndpointUrl = null;
    let modelApiConfig = null;
    let modelApiKey = null;
    let isManualEndpoint = false;
    try {
      // 새 테이블 구조에서 모델 조회 (레거시 지원 포함)
      const { getModelsFromTables } = await import('@/lib/modelTables');
      let categories = await getModelsFromTables();

      // 새 테이블에 데이터가 없으면 레거시 model_config에서 조회
      if (!categories) {
        const modelConfigResult = await query(
          'SELECT config FROM model_config WHERE config_type = $1',
          ['models']
        );
        if (modelConfigResult.rows.length > 0) {
          categories = modelConfigResult.rows[0].config?.categories || null;
        }
      }

      if (categories) {
        // 모든 카테고리에서 해당 모델 찾기 (UUID, modelName, label로 검색)
        for (const category of Object.values(categories)) {
          const foundModel = category.models?.find(
            (m) => m.id === model || m.modelName === model || m.label === model
          );
          if (foundModel) {
            console.log('[DEBUG] foundModel 찾음:', {
              id: foundModel.id,
              modelName: foundModel.modelName,
              label: foundModel.label,
              endpoint: foundModel.endpoint,
              hasApiConfig: !!foundModel.apiConfig,
              hasApiKey: !!foundModel.apiKey
            });
            if (foundModel.systemPrompt && foundModel.systemPrompt.length > 0) {
              systemPrompt = foundModel.systemPrompt
                .filter((line) => line.trim() !== '')
                .join('\n');
              console.log(
                `[generate] 모델 ${model} (${actualModelName})의 시스템 프롬프트 적용: ${systemPrompt.length}자`
              );
            }
            if (
              foundModel.endpoint &&
              typeof foundModel.endpoint === 'string'
            ) {
              modelEndpointUrl = foundModel.endpoint.trim();
              console.log('[DEBUG] modelEndpointUrl 설정:', modelEndpointUrl);
            }
            if (modelEndpointUrl === 'manual') {
              isManualEndpoint = true;
              modelApiConfig = foundModel.apiConfig || null;
              modelApiKey = foundModel.apiKey || null;
              console.log('[DEBUG] Manual endpoint 감지:', {
                isManualEndpoint,
                hasApiConfig: !!modelApiConfig,
                hasApiKey: !!modelApiKey
              });
            }
            if (systemPrompt || modelEndpointUrl) break;
          }
        }
      }
    } catch (systemPromptError) {
      console.warn(
        '[generate] 시스템 프롬프트 조회 실패:',
        systemPromptError.message
      );
    }

    let maxUserQuestionLength = 300000;
    try {
      const settingsResult = await query(
        `SELECT max_user_question_length FROM settings WHERE config_type = $1 LIMIT 1`,
        ['general']
      );
      const settingsRow = settingsResult.rows[0];
      if (
        settingsRow &&
        typeof settingsRow.max_user_question_length === 'number'
      ) {
        maxUserQuestionLength = settingsRow.max_user_question_length;
      }
    } catch (error) {
      console.warn('[generate] 질문 길이 설정 조회 실패:', error.message);
    }

    // 사용자 질문 검증 (길이 체크)
    const { validateUserQuestion } = await import('@/lib/contextManager');
    const userValidation = validateUserQuestion(
      question,
      maxUserQuestionLength
    );
    if (!userValidation.valid) {
      return NextResponse.json(
        {
          error: userValidation.error,
        },
        { status: 400 }
      );
    }

    const systemPromptPreview = systemPrompt
      ? systemPrompt.replace(/\s+/g, ' ').slice(0, 120)
      : '';
    console.log(
      `[generate] 질문 길이: ${question.length}자, 파일 내용: ${fileContent.length}자, 히스토리: ${filteredMultiturnHistory.length}개 메시지`
    );
    console.log(
      `[generate] systemPrompt 적용 여부: ${!!systemPrompt}, 길이: ${systemPrompt ? systemPrompt.length : 0}, 미리보기: "${systemPromptPreview}"`
    );

    let finalQuestion = question;
    if (matchedModel?.piiFilterRequest && piiInputProcessed !== true) {
      const piiResult = await detectAndMaskPII(question, {
        mxtVrf: matchedModel?.piiRequestMxtVrf !== false,
        maskOpt: matchedModel?.piiRequestMaskOpt !== false,
      }, {
        model: actualModelName,
        roomId: roomId || null,
        clientIP,
        userAgent,
        xForwardedFor: request.headers.get('x-forwarded-for'),
        xRealIP: request.headers.get('x-real-ip'),
        acceptLanguage: request.headers.get('accept-language'),
        referer: request.headers.get('referer'),
        origin: request.headers.get('origin'),
        jwtUserId: payload?.sub || null,
        jwtEmail: payload?.email || null,
        jwtName: payload?.name || null,
        jwtRole: payload?.role || null,
      });
      if (piiResult.detected) {
        console.log(`[PII] 요청에서 ${piiResult.detectedCnt}개 PII 감지 → LLM 차단`);
        const piiNotice = `⚠️ 개인정보가 탐지되었습니다. 필터링된 정보를 복사 후 재 질문 해주세요.\n\n마스킹된 내용:\n${piiResult.maskedText}`;
        const maskedStream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ response: piiNotice }) + '\n'));
            controller.close();
          },
        });
        return new Response(maskedStream, { headers: { 'Content-Type': 'application/x-ndjson' } });
      }
    }

    const userText = fileContent ? `${fileContent}\n\n${finalQuestion}` : finalQuestion;
    const userContent = buildUserContent(userText, normalizedImages);

    // 로깅용 전체 메시지 히스토리 구성 (multiturnHistory + 현재 질문)
    const fullMessagesForLogging = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...filteredMultiturnHistory.map((msg) => ({
        role: msg.role,
        content: typeof msg.text === 'string' ? msg.text : msg.text || '',
      })),
      { role: 'user', content: userContent },
    ];

    // 모델서버 타입 조회 (DB → env fallback) 및 모델 지정 모델서버 우선 적용
    let endpointType = 'llm';
    let openaiCompatBase = process.env.OPENAI_COMPAT_BASE || '';
    let openaiCompatApiKey = process.env.OPENAI_COMPAT_API_KEY || '';
    let forcedLlmEndpoint = null;
    try {
      const settingsResult = await query(
        `SELECT * FROM settings WHERE config_type = $1 LIMIT 1`,
        ['general']
      );
      const settingsRow = settingsResult.rows[0];

      if (settingsRow) {
        const settingsDoc = {
          ...settingsRow,
          endpointType: settingsRow.endpoint_type,
          openaiCompatBase: settingsRow.openai_compat_base,
          openaiCompatApiKey: settingsRow.openai_compat_api_key,
          customEndpoints: settingsRow.custom_endpoints,
        };

        endpointType =
          settingsDoc.endpointType === 'openai-compatible'
            ? 'openai-compatible'
            : 'llm';
        if (settingsDoc.openaiCompatBase)
          openaiCompatBase = settingsDoc.openaiCompatBase;
        if (settingsDoc.openaiCompatApiKey)
          openaiCompatApiKey = settingsDoc.openaiCompatApiKey;
        // 모델이 endpoint를 명시한 경우 provider 기준으로 덮어쓰기
        if (modelEndpointUrl) {
          const list = Array.isArray(settingsDoc.customEndpoints)
            ? settingsDoc.customEndpoints
            : [];
          const matched = list.find((e) => e.url === modelEndpointUrl);
          if (matched) {
            if (matched.provider === 'openai-compatible') {
              endpointType = 'openai-compatible';
              openaiCompatBase = matched.url;
            }
          }
        }
      }
    } catch (settingsError) {
      console.warn('[generate] 설정 조회 실패:', settingsError.message);
    }
    if (isManualEndpoint) {
      endpointType = 'manual';
      console.log('[DEBUG] endpointType을 manual로 설정');
    }
    console.log('[DEBUG] 최종 endpointType:', endpointType);

    // 요청 타입 분석
    const hasFiles = normalizedImages.length > 0;
    const requestType = hasFiles ? 'multimodal' : 'text';
    const apiTypeForLog = getApiTypeForLog(requestPurpose);

    if (endpointType === 'manual') {
      if (!modelApiConfig) {
        return NextResponse.json(
          { error: '수동 API 설정이 없습니다.' },
          { status: 400 }
        );
      }

      let manualConfig;
      try {
        manualConfig =
          typeof modelApiConfig === 'string'
            ? JSON.parse(modelApiConfig)
            : modelApiConfig;
      } catch (error) {
        return NextResponse.json(
          { error: '수동 API 설정 JSON 파싱에 실패했습니다.' },
          { status: 400 }
        );
      }

      const baseMessages = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...filteredMultiturnHistory.map((msg) => ({
          role: msg.role,
          content: typeof msg.text === 'string' ? msg.text : msg.text || '',
        })),
        {
          role: 'user',
          content: userContent,
        },
      ];

      const context = {
        apiKey: (modelApiKey || process.env.OPENAI_API_KEY || '').trim(),
        messages: baseMessages,
        message: userText,
      };

      const manualUrl = applyTemplate(manualConfig?.url, context);
      if (!manualUrl) {
        return NextResponse.json(
          { error: '수동 API URL이 설정되지 않았습니다.' },
          { status: 400 }
        );
      }

      const method = (manualConfig?.method || 'POST').toUpperCase();
      const headers = applyTemplate(manualConfig?.headers || {}, context);
      let body = applyTemplate(manualConfig?.body, context);
      const manualStreamEnabled = manualConfig?.stream === true;

      if (
        manualUrl.includes('/v1/responses') &&
        body &&
        typeof body === 'object' &&
        body.input === context.message &&
        Array.isArray(context.messages) &&
        context.messages.length > 1
      ) {
        body = { ...body, input: context.messages };
      }
      if (
        manualUrl.includes('/v1/responses') &&
        body &&
        typeof body === 'object' &&
        Array.isArray(body.input)
      ) {
        body = { ...body, input: convertToResponsesInput(body.input) };
      }

      console.log('[Manual API] 설정 확인:', {
        hasStream: !!manualConfig?.stream,
        streamValue: manualConfig?.stream,
        manualStreamEnabled,
        bodyHasStream: body?.stream,
      });

      if (
        manualStreamEnabled &&
        body &&
        typeof body === 'object' &&
        body.stream === undefined
      ) {
        body = { ...body, stream: true };
      }

      const requestOptions = {
        method,
        headers,
      };
      if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
        requestOptions.body =
          typeof body === 'string' ? body : JSON.stringify(body);
      }

      console.log('[Manual API] 요청 전송:', {
        url: manualUrl,
        method,
        bodyPreview: typeof requestOptions.body === 'string'
          ? requestOptions.body.substring(0, 200)
          : 'N/A',
      });

      const startAt = Date.now();
      const manualRes = await fetch(manualUrl, requestOptions);
      if (!manualRes.ok) {
        const errorText = await manualRes.text().catch(() => '');
        try {
          await logExternalApiRequest({
            sourceType: 'internal',
            provider: 'manual',
            apiType: apiTypeForLog,
            endpoint: manualUrl,
            model: actualModelName,
            messages: fullMessagesForLogging,
            promptTokenCount: finalPrompt.length,
            responseTokenCount: 0,
            responseTime: Date.now() - startAt,
            statusCode: manualRes.status,
            isStream: manualStreamEnabled,
            error: `수동 API 요청 실패: HTTP ${manualRes.status}`,
            clientIP,
            userAgent,
            roomId: roomId || null,
            jwtUserId: payload?.sub || null,
            jwtEmail: payload?.email || null,
            jwtName: payload?.name || null,
            jwtRole: payload?.role || null,
            xForwardedFor: request.headers.get('x-forwarded-for'),
            xRealIP: request.headers.get('x-real-ip'),
            acceptLanguage: request.headers.get('accept-language'),
            referer: request.headers.get('referer'),
            origin: request.headers.get('origin'),
          });
        } catch (logErr) {
          console.warn(
            '[manual] 외부 API 로깅 실패(무시):',
            logErr?.message || logErr
          );
        }
        return NextResponse.json(
          {
            error: `수동 API 요청 실패: HTTP ${manualRes.status}`,
            details: errorText,
          },
          { status: manualRes.status }
        );
      }

      const manualContentType = manualRes.headers.get('content-type') || '';
      const truncatePreview = (value, limit = 500) => {
        if (!value) return '';
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        if (text.length <= limit) return text;
        return `${text.slice(0, limit)}…(${text.length} chars)`;
      };

      console.log('[Manual API] 응답 수신:', {
        status: manualRes.status,
        contentType: manualContentType,
        manualStreamEnabled,
        willUseStreaming: manualStreamEnabled,
      });

      // stream: true가 설정되어 있으면 Content-Type에 관계없이 스트리밍으로 처리
      if (manualStreamEnabled) {
        console.log('[Manual API] 스트리밍 모드로 처리 시작');
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8');
        let streamedResponseLength = 0;
        let sawDelta = false;
        let streamedResponseText = '';
        let streamErrorInfo = null;
        const previewEvents = [];
        const maxPreviewEvents = 3;
        const stream = new ReadableStream({
          async start(controller) {
            const reader = manualRes.body.getReader();
            let buffer = '';
            let currentEvent = '';

            const coerceDeltaText = (value) => {
              if (!value) return '';
              if (typeof value === 'string') return value;
              if (Array.isArray(value)) {
                return value
                  .map((item) => {
                    if (!item) return '';
                    if (typeof item === 'string') return item;
                    return item.text || '';
                  })
                  .join('');
              }
              if (typeof value === 'object') {
                return value.text || '';
              }
              return '';
            };

            const extractTextFromResponse = (parsed) => {
              const collect = (items = []) =>
                items
                  .map((item) => {
                    if (!item) return '';
                    if (Array.isArray(item.content)) {
                      return item.content
                        .map((contentItem) => contentItem?.text || '')
                        .join('');
                    }
                    return item.text || '';
                  })
                  .join('');

              if (parsed?.response?.output) {
                return collect(parsed.response.output);
              }
              if (parsed?.output) {
                return collect(parsed.output);
              }
              return '';
            };

            const emitDelta = (text) => {
              const normalized = coerceDeltaText(text);
              if (!normalized) return;
              sawDelta = true;
              streamedResponseText += normalized;
              streamedResponseLength += normalized.length;
              const payload = {
                choices: [{ delta: { content: normalized } }],
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
              );
            };

            let chunkCount = 0;
            let firstChunkLogged = false;
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  console.log('[Manual API] 스트림 종료, 총 청크:', chunkCount);
                  break;
                }
                chunkCount++;
                if (!firstChunkLogged) {
                  console.log('[Manual API] 첫 응답 청크 수신');
                  firstChunkLogged = true;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (!line.trim()) {
                    currentEvent = '';
                    continue;
                  }
                  if (line.startsWith('event:')) {
                    currentEvent = line.slice(6).trim();
                    continue;
                  }
                  if (!line.startsWith('data:')) continue;

                  const data = line.slice(5).trim();
                  if (previewEvents.length < maxPreviewEvents) {
                    previewEvents.push({
                      event: currentEvent || null,
                      data: truncatePreview(data),
                    });
                  }
                  if (data === '[DONE]') {
                    console.log('[Manual API] [DONE] 수신');
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                    return;
                  }

                  let parsed;
                  try {
                    parsed = JSON.parse(data);
                  } catch (error) {
    console.warn('[Loop] 항목 처리 실패 (건너뜀):', error.message);
    continue;
  }
                  if (
                    currentEvent === 'error' ||
                    parsed?.type === 'error' ||
                    parsed?.error
                  ) {
                    const errorInfo = parsed?.error || parsed || {};
                    streamErrorInfo = {
                      message:
                        errorInfo.message ||
                        '요청 처리 중 오류가 발생했습니다.',
                      type: errorInfo.type || 'error',
                      code: errorInfo.code || null,
                    };
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          error: streamErrorInfo,
                        })}\n\n`
                      )
                    );
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                    return;
                  }

                  if (parsed?.choices?.[0]?.delta?.content) {
                    emitDelta(parsed.choices[0].delta.content);
                    continue;
                  }

                  if (
                    currentEvent === 'response.output_text.delta' ||
                    parsed?.type === 'response.output_text.delta'
                  ) {
                    emitDelta(parsed?.delta);
                    continue;
                  }

                  if (
                    currentEvent === 'response.output_text.done' ||
                    parsed?.type === 'response.output_text.done'
                  ) {
                    if (!sawDelta) {
                      emitDelta(parsed?.text);
                    }
                    continue;
                  }

                  if (!sawDelta) {
                    const fallbackText = extractTextFromResponse(parsed);
                    if (fallbackText) {
                      emitDelta(fallbackText);
                    }
                  }
                }
              }
            } catch (streamError) {
              console.error('[manual stream] 스트림 처리 오류:', streamError);
              controller.error(streamError);
            } finally {
              console.log('[Manual API] 스트림 응답 미리보기:', {
                status: manualRes.status,
                contentType: manualContentType,
                sawDelta,
                streamErrorInfo,
                previewEvents,
              });
              try {
                await logExternalApiRequest({
                  sourceType: 'internal',
                  provider: 'manual',
                  apiType: apiTypeForLog,
                  endpoint: manualUrl,
                  model: actualModelName,
                  messages: buildMessagesWithResponse(
                    fullMessagesForLogging,
                    streamedResponseText
                  ),
                  promptTokenCount: finalPrompt.length,
                  responseTokenCount: streamedResponseLength,
                  responseTime: Date.now() - startAt,
                  statusCode: streamErrorInfo ? 429 : manualRes.status,
                  isStream: true,
                  error: streamErrorInfo
                    ? `수동 API 스트림 오류: ${streamErrorInfo.message}`
                    : undefined,
                  clientIP,
                  userAgent,
                  roomId: roomId || null,
                  jwtUserId: payload?.sub || null,
                  jwtEmail: payload?.email || null,
                  jwtName: payload?.name || null,
                  jwtRole: payload?.role || null,
                  xForwardedFor: request.headers.get('x-forwarded-for'),
                  xRealIP: request.headers.get('x-real-ip'),
                  acceptLanguage: request.headers.get('accept-language'),
                  referer: request.headers.get('referer'),
                  origin: request.headers.get('origin'),
                });
              } catch (logErr) {
                console.warn(
                  '[manual] 외부 API 로깅 실패(무시):',
                  logErr?.message || logErr
                );
              }
              await logImageAnalysisToMessages({
                requestPurpose,
                roomId: roomId || null,
                userId: payload?.sub || null,
                userRole: payload?.role || null,
                model: actualModelName,
                text: streamedResponseText,
                clientIP,
              });
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          },
        });
      }

      let responseData = null;
      let responseText = '';
      try {
        responseData = await manualRes.json();
      } catch (error) {
        responseText = await manualRes.text().catch(() => '');
      }
      console.log('[Manual API] 비스트리밍 응답 미리보기:', {
        status: manualRes.status,
        contentType: manualContentType,
        responseText: truncatePreview(responseText),
        responseJson: responseData ? truncatePreview(responseData) : null,
      });

      const responsePath = manualConfig?.responseMapping?.path;
      let mapped =
        responseData && responsePath
          ? getValueByPath(responseData, responsePath)
          : null;
      if (mapped === null || mapped === undefined) {
        if (responseText) {
          mapped = responseText;
        } else if (responseData) {
          mapped =
            typeof responseData === 'string'
              ? responseData
              : JSON.stringify(responseData);
        } else {
          mapped = '';
        }
      }

      const responseString =
        typeof mapped === 'string' ? mapped : JSON.stringify(mapped);
      try {
        await logExternalApiRequest({
          sourceType: 'internal',
          provider: 'manual',
          apiType: apiTypeForLog,
          endpoint: manualUrl,
          model: actualModelName,
          messages: buildMessagesWithResponse(
            fullMessagesForLogging,
            responseString
          ),
          promptTokenCount: finalPrompt.length,
          responseTokenCount: responseString.length,
          responseTime: Date.now() - startAt,
          statusCode: manualRes.status,
          isStream: false,
          clientIP,
          userAgent,
          roomId: roomId || null,
          jwtUserId: payload?.sub || null,
          jwtEmail: payload?.email || null,
          jwtName: payload?.name || null,
          jwtRole: payload?.role || null,
          xForwardedFor: request.headers.get('x-forwarded-for'),
          xRealIP: request.headers.get('x-real-ip'),
          acceptLanguage: request.headers.get('accept-language'),
          referer: request.headers.get('referer'),
          origin: request.headers.get('origin'),
        });
      } catch (logErr) {
        console.warn(
          '[manual] 외부 API 로깅 실패(무시):',
          logErr?.message || logErr
        );
      }
      await logImageAnalysisToMessages({
        requestPurpose,
        roomId: roomId || null,
        userId: payload?.sub || null,
        userRole: payload?.role || null,
        model: actualModelName,
        text: responseString,
        clientIP,
      });
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(`${JSON.stringify({ response: responseString })}\n`)
          );
          controller.close();
        },
      });

      return new Response(stream, {
        status: manualRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (endpointType === 'gemini') {
      // Gemini API 호출
      const base =
        (openaiCompatBase || '').replace(/\/+$/, '') ||
        'https://generativelanguage.googleapis.com';
      if (!openaiCompatApiKey) {
        return NextResponse.json(
          { error: 'Gemini API key가 설정되지 않았습니다.' },
          { status: 400 }
        );
      }

      // Gemini 모델 이름 정규화
      // 1. "models/" 접두사 제거 (Gemini API에서 반환하는 형식)
      // 2. 버전 태그(:latest 등) 제거
      // 3. 공백 제거
      // 예: "models/gemini-pro:latest" -> "gemini-pro"
      // 예: "gemini-pro:latest" -> "gemini-pro"
      let normalizedModel = actualModelName.trim();

      // "models/" 접두사 제거 (여러 번 반복될 수 있으므로 모두 제거)
      while (normalizedModel.startsWith('models/')) {
        normalizedModel = normalizedModel.substring(7);
      }

      // 버전 태그 제거 (콜론 이후 부분)
      normalizedModel = normalizedModel.split(':')[0].trim();

      // 슬래시가 남아있으면 마지막 부분만 사용 (안전장치)
      if (normalizedModel.includes('/')) {
        normalizedModel = normalizedModel.split('/').pop().trim();
      }

      if (!normalizedModel) {
        return NextResponse.json(
          { error: `유효하지 않은 모델 이름입니다: "${actualModelName}"` },
          { status: 400 }
        );
      }

      // URL 구성 시 models/ 중복 방지를 위해 한번 더 체크
      const cleanModelName = normalizedModel.replace(/^models\//, '');
      const geminiUrl = `${base}/v1beta/models/${cleanModelName}:streamGenerateContent?key=${openaiCompatApiKey}`;
      const headers = { 'Content-Type': 'application/json' };

      console.log(
        `[generate] Gemini API 호출: 모델=${cleanModelName} (정규화=${normalizedModel}, 원본=${actualModelName}), URL=${geminiUrl.replace(
          /key=[^&]+/,
          'key=***'
        )}`
      );

      // Gemini API 형식으로 변환
      const convertToGeminiFormat = (messages) => {
        const contents = [];
        for (const msg of messages) {
          const role = msg.role === 'assistant' ? 'model' : 'user';
          const parts = [];

          if (typeof msg.content === 'string') {
            if (msg.content) {
              parts.push({ text: msg.content });
            }
          } else if (Array.isArray(msg.content)) {
            msg.content.forEach((item) => {
              if (typeof item === 'string' && item) {
                parts.push({ text: item });
                return;
              }
              if (item?.type === 'text' && item.text) {
                parts.push({ text: item.text });
                return;
              }
              if (item?.type === 'image_url' && item.image_url?.url) {
                const { data, mimeType } = parseDataUrl(item.image_url.url);
                if (data) {
                  parts.push({
                    inline_data: {
                      mime_type: mimeType,
                      data,
                    },
                  });
                }
              }
            });
          } else {
            const fallbackText = String(msg.content || '');
            if (fallbackText) {
              parts.push({ text: fallbackText });
            }
          }

          if (parts.length > 0) {
            contents.push({ role, parts });
          }
        }
        return { contents };
      };

      // Gemini API를 위한 메시지 배열 구성
      // systemPrompt와 파일 내용은 첫 user 메시지에 포함
      const openaiMessages = [
        ...filteredMultiturnHistory.map((msg) => ({
          role: msg.role,
          content: typeof msg.text === 'string' ? msg.text : msg.text || '',
        })),
        {
          role: 'user',
          content: buildUserContent(
            [systemPrompt || '', fileContent || '', question]
              .filter(Boolean)
              .join('\n\n'),
            normalizedImages
          ),
        },
      ];

      const body = convertToGeminiFormat(openaiMessages);

      const startAt = Date.now();
      const openaiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      let instanceId = 'gemini-unknown';
      try {
        const u = new URL(base);
        instanceId = `gemini-${u.hostname}-${u.port || ''}`;
      } catch (error) {
        console.warn('[Gemini] URL 파싱 실패, 기본 인스턴스 ID 사용:', error.message);
      }

      // HTTP 상태 코드 체크
      if (!openaiRes.ok) {
        let errorMessage = `HTTP ${openaiRes.status} ${openaiRes.statusText}`;
        let errorDetails = null;

        try {
          // 에러 응답 본문 읽기 시도
          const errorText = await openaiRes.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              // 에러 메시지 추출 (여러 형식 지원)
              let rawErrorMessage = null;
              if (errorJson.error) {
                if (typeof errorJson.error === 'string') {
                  rawErrorMessage = errorJson.error;
                } else if (errorJson.error.message) {
                  rawErrorMessage = errorJson.error.message;
                } else if (typeof errorJson.error === 'object') {
                  rawErrorMessage = JSON.stringify(errorJson.error);
                }
              }
              errorMessage = rawErrorMessage || errorMessage;
              errorDetails = errorJson;

              // 에러 메시지에서 원본 모델 이름을 정규화된 모델 이름으로 대체
              // 여러 패턴으로 시도: 원본 모델 이름, "models/" 접두사 포함 등
              if (errorMessage && actualModelName && cleanModelName) {
                // 1. 원본 모델 이름 직접 대체
                if (errorMessage.includes(actualModelName)) {
                  errorMessage = errorMessage.replace(
                    new RegExp(
                      actualModelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                      'g'
                    ),
                    cleanModelName
                  );
                }
                // 2. "models/" 접두사가 포함된 경우도 대체
                const modelWithPrefix = `models/${cleanModelName}`;
                if (errorMessage.includes(modelWithPrefix)) {
                  errorMessage = errorMessage.replace(
                    new RegExp(
                      modelWithPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                      'g'
                    ),
                    cleanModelName
                  );
                }
                // 3. 따옴표로 감싸진 모델 이름 패턴 대체 (예: 'models/gemini-2.0-flash')
                const quotedModelPattern = new RegExp(
                  `(['"])([^'"]*${model.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                  )}[^'"]*)\\1`,
                  'gi'
                );
                errorMessage = errorMessage.replace(
                  quotedModelPattern,
                  (match, quote, content) => {
                    // content에서 모델 이름을 정규화된 이름으로 대체
                    const normalizedContent = content.replace(
                      new RegExp(
                        model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                        'g'
                      ),
                      cleanModelName
                    );
                    return `${quote}${normalizedContent}${quote}`;
                  }
                );
              }
            } catch (error) {
              console.warn('[Catch] 에러 발생:', error.message);
              errorMessage = errorText.substring(0, 500);
              errorDetails = { raw: errorText.substring(0, 200) };

              // 텍스트 에러 메시지에서도 원본 모델 이름을 정규화된 모델 이름으로 대체
              if (errorMessage && actualModelName && cleanModelName) {
                // 1. 원본 모델 이름 직접 대체
                if (errorMessage.includes(actualModelName)) {
                  errorMessage = errorMessage.replace(
                    new RegExp(
                      actualModelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                      'g'
                    ),
                    cleanModelName
                  );
                }
                // 2. "models/" 접두사가 포함된 경우도 대체
                const modelWithPrefix = `models/${cleanModelName}`;
                if (errorMessage.includes(modelWithPrefix)) {
                  errorMessage = errorMessage.replace(
                    new RegExp(
                      modelWithPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                      'g'
                    ),
                    cleanModelName
                  );
                }
                // 3. 따옴표로 감싸진 모델 이름 패턴 대체
                const quotedModelPattern = new RegExp(
                  `(['"])([^'"]*${model.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                  )}[^'"]*)\\1`,
                  'gi'
                );
                errorMessage = errorMessage.replace(
                  quotedModelPattern,
                  (match, quote, content) => {
                    const normalizedContent = content.replace(
                      new RegExp(
                        model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                        'g'
                      ),
                      cleanModelName
                    );
                    return `${quote}${normalizedContent}${quote}`;
                  }
                );
              }
            }
          }
        } catch (e) {
          console.warn('[generate] Gemini 에러 응답 읽기 실패:', e);
        }

        // 상세 로깅 (404 에러의 경우 모델 이름과 URL 확인)
        const timestamp = new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul',
        });
        const responseTime = Date.now() - startAt;
        console.error(
          `ERROR ${timestamp} ${responseTime}ms POST ${geminiUrl.replace(
            /key=[^&]+/,
            'key=***'
          )}`,
          {
            status: openaiRes.status,
            statusText: openaiRes.statusText,
            errorMessage,
            errorDetails,
            cleanModelName,
            originalModel: actualModelName,
            url: geminiUrl.replace(/key=[^&]+/, 'key=***'),
            response: errorDetails || errorMessage,
            request: {
              model: cleanModelName,
              originalModel: actualModelName,
              method: 'POST',
            },
            headers: Object.fromEntries(openaiRes.headers.entries()),
          }
        );

        try {
          const { logOpenAIRequest } = await import('@/lib/modelServerMonitor');
          await logOpenAIRequest(instanceId, {
            method: 'POST',
            endpoint: geminiUrl,
            model: cleanModelName,
            originalModel: actualModelName,
            messages: openaiMessages,
            userAgent,
            clientIP,
            responseTime: Date.now() - startAt,
            responseStatus: openaiRes.status,
            errorMessage: `${errorMessage} (정규화된 모델: ${cleanModelName}, 원본: ${actualModelName})`,
            isStream: true,
            roomId,
            userId: payload?.email || 'unknown',
            level: 'error',
            hasFiles,
            fileCount: 0,
            provider: 'gemini', // Gemini API임을 명시
          });
        } catch (logErr) {
          console.error('[generate] 로그 기록 실패:', logErr);
        }

        // 실패한 호출도 외부 API 로깅에 기록
        try {
          await logExternalApiRequest({
            sourceType: 'internal',
            provider: 'gemini',
            apiType: apiTypeForLog,
            endpoint: geminiUrl,
            model: cleanModelName, // 정규화된 모델명
            messages: fullMessagesForLogging, // 전체 메시지 히스토리 포함
            promptTokenCount: finalPrompt.length,
            responseTokenCount: 0,
            responseTime: Date.now() - startAt,
            statusCode: openaiRes.status,
            isStream: true,
            error: errorMessage,
            clientIP,
            userAgent,
            roomId: roomId || null,
            jwtUserId: payload?.sub || null,
            jwtEmail: payload?.email || null,
            jwtName: payload?.name || null,
            jwtRole: payload?.role || null,
            xForwardedFor: request.headers.get('x-forwarded-for'),
            xRealIP: request.headers.get('x-real-ip'),
            acceptLanguage: request.headers.get('accept-language'),
            referer: request.headers.get('referer'),
            origin: request.headers.get('origin'),
          });
        } catch (logErr) {
          console.warn(
            '[generate] 외부 API 로깅 실패(무시):',
            logErr?.message || logErr
          );
        }

        // 404 에러의 경우 더 자세한 메시지 제공
        if (openaiRes.status === 404) {
          // 에러 메시지에서 모델 이름 관련 정보 추출 (이미 정규화된 에러 메시지 사용)
          const modelNotFoundPattern = /model\s+['"]([^'"]+)['"]/i;
          const match = errorMessage.match(modelNotFoundPattern);
          const mentionedModel = match ? match[1] : null;

          // 에러 메시지가 이미 정규화되었는지 확인
          const isAlreadyNormalized =
            mentionedModel === normalizedModel ||
            (mentionedModel && !mentionedModel.includes('models/'));

          let finalErrorMessage = `Gemini 모델을 찾을 수 없습니다.`;

          if (isAlreadyNormalized) {
            // 이미 정규화된 경우
            finalErrorMessage += `\n모델 이름: "${normalizedModel}"`;
            if (actualModelName !== normalizedModel) {
              finalErrorMessage += ` (원본: "${actualModelName}")`;
            }
          } else if (mentionedModel && mentionedModel !== normalizedModel) {
            // 에러 메시지에 다른 모델 이름이 언급된 경우
            finalErrorMessage += `\n요청한 모델: "${actualModelName}"`;
            finalErrorMessage += `\n정규화된 모델: "${normalizedModel}"`;
            if (
              mentionedModel !== actualModelName &&
              mentionedModel !== normalizedModel
            ) {
              finalErrorMessage += `\nAPI가 언급한 모델: "${mentionedModel}"`;
            }
          } else {
            // 기본 케이스
            finalErrorMessage += `\n모델 이름: "${normalizedModel}"`;
            if (actualModelName !== normalizedModel) {
              finalErrorMessage += ` (원본: "${actualModelName}")`;
            }
          }

          finalErrorMessage += `\n\n올바른 모델 이름인지 확인해주세요. Gemini API에서 사용 가능한 모델 목록을 확인하세요.`;

          return NextResponse.json(
            {
              error: finalErrorMessage,
              details: errorMessage, // 원본 에러 메시지는 details에만 포함
              normalizedModel,
              originalModel: model,
            },
            { status: 404 }
          );
        }

        // 다른 에러의 경우에도 모델 정보 포함 (에러 메시지는 이미 정규화됨)
        let finalErrorMessage = `Gemini API 오류: ${errorMessage}`;
        if (errorMessage.includes('model') || errorMessage.includes('모델')) {
          // 에러 메시지에 이미 정규화된 모델 이름이 포함되어 있으므로 추가 정보만 제공
          if (model !== normalizedModel) {
            finalErrorMessage += `\n사용한 모델: "${normalizedModel}" (원본: "${model}")`;
          } else {
            finalErrorMessage += `\n사용한 모델: "${normalizedModel}"`;
          }
        }

        return NextResponse.json(
          {
            error: finalErrorMessage,
            details: errorMessage, // 원본 에러 메시지는 details에만 포함
            normalizedModel,
            originalModel: model,
          },
          { status: openaiRes.status || 500 }
        );
      }

      if (!openaiRes.body) {
        try {
          const { logOpenAIRequest } = await import('@/lib/modelServerMonitor');
          await logOpenAIRequest(instanceId, {
            method: 'POST',
            endpoint: geminiUrl,
            model: cleanModelName,
            messages: openaiMessages,
            userAgent,
            clientIP,
            responseTime: Date.now() - startAt,
            responseStatus: openaiRes.status,
            errorMessage: `Empty response body (HTTP ${openaiRes.status})`,
            isStream: true,
            roomId,
            userId: payload?.email || 'unknown',
            level: 'error',
            hasFiles,
            fileCount: 0,
            provider: 'gemini', // Gemini API임을 명시
          });
        } catch (logErr) {
          console.error('[generate] 로그 기록 실패:', logErr);
        }
        return NextResponse.json(
          { error: `Gemini API 응답 오류: HTTP ${openaiRes.status}` },
          { status: openaiRes.status }
        );
      }

      // Gemini 스트리밍 응답을 OpenAI 형식으로 변환
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const reader = openaiRes.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let accumulatedText = '';
          let buffer = ''; // 완전한 JSON 객체를 수집하기 위한 버퍼
          let streamClosed = false;
          let streamError = null;

          // Gemini 응답 처리 함수
          const processGeminiResponse = (geminiData) => {
            if (streamClosed) return; // 이미 닫힌 스트림은 처리하지 않음

            try {
              // 에러 응답 확인
              if (geminiData.error) {
                const errorMsg =
                  geminiData.error.message || JSON.stringify(geminiData.error);
                console.error('[generate] Gemini API 에러:', errorMsg);
                streamError = errorMsg;
                streamClosed = true;
                controller.error(new Error(`Gemini API 오류: ${errorMsg}`));
                return;
              }

              if (geminiData.candidates && geminiData.candidates[0]) {
                const candidate = geminiData.candidates[0];

                // 차단된 응답 확인 (SAFETY, RECITATION 등)
                if (
                  candidate.finishReason &&
                  (candidate.finishReason === 'SAFETY' ||
                    candidate.finishReason === 'RECITATION' ||
                    candidate.finishReason === 'OTHER')
                ) {
                  const safetyRatings = candidate.safetyRatings || [];
                  const blockedReasons = safetyRatings
                    .filter((r) => r.blocked)
                    .map((r) => `${r.category}: ${r.probability}`)
                    .join(', ');

                  const errorMsg = `응답이 차단되었습니다. 이유: ${
                    candidate.finishReason
                  }${blockedReasons ? ` (${blockedReasons})` : ''}`;
                  console.warn('[generate] Gemini 응답 차단:', errorMsg);
                  streamError = errorMsg;

                  // 에러를 스트림으로 전송
                  const errorChunk = {
                    id: `chatcmpl-${Date.now()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: actualModelName,
                    choices: [
                      {
                        index: 0,
                        delta: { content: `\n\n[오류] ${errorMsg}` },
                        finish_reason: candidate.finishReason,
                      },
                    ],
                  };
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`)
                  );
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  streamClosed = true;
                  controller.close();
                  return;
                }

                const content = candidate.content;

                if (content && content.parts && content.parts[0]) {
                  const text = content.parts[0].text || '';
                  if (text) {
                    accumulatedText += text;

                    const openaiChunk = {
                      id: `chatcmpl-${Date.now()}`,
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: cleanModelName,
                      choices: [
                        {
                          index: 0,
                          delta: { content: text },
                          finish_reason: null,
                        },
                      ],
                    };

                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`)
                    );
                  }
                }

                if (candidate.finishReason) {
                  const finalChunk = {
                    id: `chatcmpl-${Date.now()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: cleanModelName,
                    choices: [
                      {
                        index: 0,
                        delta: {},
                        finish_reason: candidate.finishReason,
                      },
                    ],
                  };
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`)
                  );
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  streamClosed = true;
                  controller.close();
                  return;
                }
              } else if (
                geminiData.candidates &&
                geminiData.candidates.length === 0
              ) {
                // 후보가 없는 경우 (모두 차단됨)
                console.warn(
                  '[generate] Gemini 응답 후보 없음 - 모든 응답이 차단되었을 수 있습니다.'
                );
                streamError =
                  '응답을 생성할 수 없습니다. 안전 필터에 의해 차단되었을 수 있습니다.';
                const errorChunk = {
                  id: `chatcmpl-${Date.now()}`,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: cleanModelName,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        content:
                          '\n\n[오류] 응답을 생성할 수 없습니다. 안전 필터에 의해 차단되었을 수 있습니다.',
                      },
                      finish_reason: 'content_filter',
                    },
                  ],
                };
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`)
                );
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                streamClosed = true;
                controller.close();
                return;
              }
            } catch (e) {
              // 처리 중 에러 발생 시 로그만 남기고 계속 진행
              console.warn('[generate] Gemini 응답 처리 중 오류:', e.message);
            }
          };

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                // 스트림 종료 시 남은 버퍼 처리
                if (buffer.trim() && !streamClosed) {
                  try {
                    const geminiData = JSON.parse(buffer.trim());
                    processGeminiResponse(geminiData);
                  } catch (e) {
                    console.warn(
                      '[generate] Gemini 버퍼 JSON 파싱 실패:',
                      e?.message || e
                    );
                  }
                }
                break;
              }

              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;

              // 완전한 JSON 객체를 찾아서 처리
              // 중괄호 매칭을 사용하여 완전한 JSON 객체 찾기
              let braceCount = 0;
              let startIndex = -1;

              for (let i = 0; i < buffer.length; i++) {
                const char = buffer[i];

                if (char === '{') {
                  if (startIndex === -1) {
                    startIndex = i; // JSON 객체 시작 위치
                  }
                  braceCount++;
                } else if (char === '}') {
                  braceCount--;

                  // 중괄호가 모두 닫혔으면 완전한 JSON 객체
                  if (braceCount === 0 && startIndex !== -1) {
                    const jsonStr = buffer.substring(startIndex, i + 1);
                    buffer = buffer.substring(i + 1); // 처리한 부분 제거

                    try {
                      const geminiData = JSON.parse(jsonStr);
                      if (!streamClosed) {
                        processGeminiResponse(geminiData);
                      }
                    } catch (e) {
                      // JSON 파싱 실패는 무시 (불완전한 객체일 수 있음)
                      console.warn(
                        '[generate] Gemini JSON 파싱 실패:',
                        e.message
                      );
                    }

                    // 다음 JSON 객체를 찾기 위해 초기화
                    startIndex = -1;
                    braceCount = 0;
                  }
                }
              }

              // 처리되지 않은 부분만 버퍼에 유지
              if (startIndex !== -1) {
                buffer = buffer.substring(startIndex);
              } else {
                buffer = '';
              }
            }

            // 스트림 정상 종료
            if (!streamClosed) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          } catch (error) {
            console.error('[generate] Gemini 스트리밍 오류:', error);
            streamError = error?.message || String(error);
            if (!streamClosed) {
              try {
                controller.error(error);
              } catch (e) {
                console.warn(
                  '[generate] 스트림 종료 처리 실패:',
                  e?.message || e
                );
              }
            }
          } finally {
            try {
              await logExternalApiRequest({
                sourceType: 'internal',
                provider: 'gemini',
                apiType: apiTypeForLog,
                endpoint: geminiUrl,
                model: cleanModelName,
                messages: buildMessagesWithResponse(
                  fullMessagesForLogging,
                  accumulatedText
                ),
                promptTokenCount: finalPrompt.length,
                responseTokenCount: accumulatedText.length,
                responseTime: Date.now() - startAt,
                statusCode: streamError ? 429 : openaiRes.status,
                isStream: true,
                error: streamError || undefined,
                clientIP,
                userAgent,
                roomId: roomId || null,
                jwtUserId: payload?.sub || null,
                jwtEmail: payload?.email || null,
                jwtName: payload?.name || null,
                jwtRole: payload?.role || null,
                xForwardedFor: request.headers.get('x-forwarded-for'),
                xRealIP: request.headers.get('x-real-ip'),
                acceptLanguage: request.headers.get('accept-language'),
                referer: request.headers.get('referer'),
                origin: request.headers.get('origin'),
              });
            } catch (logErr) {
              console.warn(
                '[generate] Gemini 외부 API 로깅 실패(무시):',
                logErr?.message || logErr
              );
            }
            await logImageAnalysisToMessages({
              requestPurpose,
              roomId: roomId || null,
              userId: payload?.sub || null,
              userRole: payload?.role || null,
              model: cleanModelName,
              text: accumulatedText,
              clientIP,
            });
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else if (endpointType === 'openai-compatible') {
      // OpenAI 호환형 호출
      const base = (openaiCompatBase || '').replace(/\/+$/, '');
      if (!base) {
        return NextResponse.json(
          { error: 'OpenAI 호환 모델서버가 설정되지 않았습니다.' },
          { status: 400 }
        );
      }
      // /v1/chat/completions 경로 조합 (base에 /v1 포함돼 있어도 동작)
      const openaiUrl = `${base}${
        /\/v1(\/|$)/.test(base) ? '/chat/completions' : '/v1/chat/completions'
      }`;
      const headers = { 'Content-Type': 'application/json' };
      if (openaiCompatApiKey)
        headers['Authorization'] = `Bearer ${openaiCompatApiKey}`;

      // OpenAI 호환 API를 위한 메시지 배열 구성
      const openaiMessages = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...filteredMultiturnHistory.map((msg) => ({
          role: msg.role,
          content: typeof msg.text === 'string' ? msg.text : msg.text || '',
        })),
        {
          role: 'user',
          content: buildUserContent(
            fileContent ? `${fileContent}\n\n${question}` : question,
            normalizedImages
          ),
        },
      ];

      const body = {
        model: actualModelName, // UUID -> 실제 모델명으로 변환된 값 사용
        stream: true,
        messages: openaiMessages,
      };

      const startAt = Date.now();
      const openaiRes = await fetch(openaiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      // 인스턴스 식별자 구성 (OPENAI 호환 인스턴스)
      let instanceId = 'openai-compatible-unknown';
      try {
        const u = new URL(base);
        instanceId = `openai-compatible-${u.hostname}-${u.port || ''}`;
      } catch (error) {
        console.warn('[OpenAI Compatible] URL 파싱 실패, 기본 인스턴스 ID 사용:', error.message);
      }

      if (!openaiRes.body) {
        // modellogs에도 에러 기록
        try {
          const { logOpenAIRequest } = await import('@/lib/modelServerMonitor');
          await logOpenAIRequest(instanceId, {
            method: 'POST',
            endpoint: openaiUrl,
            model,
            messages: openaiMessages,
            userAgent,
            clientIP,
            responseTime: Date.now() - startAt,
            responseStatus: openaiRes.status,
            errorMessage: `Empty response body (HTTP ${openaiRes.status})`,
            isStream: true,
            roomId,
            userId: payload?.email || 'unknown',
            level: 'error',
            hasFiles,
            fileCount: 0,
            promptTokens: finalPrompt.length,
          });
        } catch (e) {
          console.warn(
            '[openai-compatible] modellogs 에러 기록 실패(무시):',
            e?.message || e
          );
        }

        // 실패한 호출도 외부 API 로깅에 기록
        try {
          await logExternalApiRequest({
            sourceType: 'internal',
            provider: 'openai-compatible',
            apiType: apiTypeForLog,
            endpoint: openaiUrl,
            model: actualModelName, // 실제 모델명
            messages: fullMessagesForLogging, // 전체 메시지 히스토리 포함
            promptTokenCount: finalPrompt.length,
            responseTokenCount: 0,
            responseTime: Date.now() - startAt,
            statusCode: openaiRes.status,
            isStream: true,
            error: `Empty response body (HTTP ${openaiRes.status})`,
            clientIP,
            userAgent,
            roomId: roomId || null,
            jwtUserId: payload?.sub || null,
            jwtEmail: payload?.email || null,
            jwtName: payload?.name || null,
            jwtRole: payload?.role || null,
            xForwardedFor: request.headers.get('x-forwarded-for'),
            xRealIP: request.headers.get('x-real-ip'),
            acceptLanguage: request.headers.get('accept-language'),
            referer: request.headers.get('referer'),
            origin: request.headers.get('origin'),
          });
        } catch (logErr) {
          console.warn(
            '[openai-compatible] 외부 API 로깅 실패(무시):',
            logErr?.message || logErr
          );
        }

        return NextResponse.json(
          {
            error: `OpenAI 호환 응답 스트림이 비어있습니다. (HTTP ${openaiRes.status})`,
          },
          { status: 500 }
        );
      }

      // OpenAI 호환 API 실패 시 로깅 (body는 있지만 status가 실패인 경우)
      if (!openaiRes.ok) {
        try {
          let errorText = '';
          try {
            // 응답 본문을 읽기 전에 복제
            const clonedRes = openaiRes.clone();
            errorText = await clonedRes.text();
          } catch (e) {
            errorText = `HTTP ${openaiRes.status}: ${openaiRes.statusText}`;
          }

          await logExternalApiRequest({
            sourceType: 'internal',
            provider: 'openai-compatible',
            apiType: apiTypeForLog,
            endpoint: openaiUrl,
            model: actualModelName, // 실제 모델명
            messages: fullMessagesForLogging, // 전체 메시지 히스토리 포함
            promptTokenCount: finalPrompt.length,
            responseTokenCount: 0,
            responseTime: Date.now() - startAt,
            statusCode: openaiRes.status,
            isStream: true,
            error: errorText.substring(0, 500),
            clientIP,
            userAgent,
            roomId: roomId || null,
            jwtUserId: payload?.sub || null,
            jwtEmail: payload?.email || null,
            jwtName: payload?.name || null,
            jwtRole: payload?.role || null,
            xForwardedFor: request.headers.get('x-forwarded-for'),
            xRealIP: request.headers.get('x-real-ip'),
            acceptLanguage: request.headers.get('accept-language'),
            referer: request.headers.get('referer'),
            origin: request.headers.get('origin'),
          });
        } catch (logErr) {
          console.warn(
            '[openai-compatible] 외부 API 로깅 실패(무시):',
            logErr?.message || logErr
          );
        }
      }

      // OpenAI SSE → 기존 JSONL {response: "..."}로 변환 스트림
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const reader = openaiRes.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          let accumulatedResponse = '';
          let firstResponseAt = null;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line) continue;
                // SSE 형식: data: {...} 또는 [DONE]
                const m = line.startsWith('data:')
                  ? line.slice(5).trim()
                  : null;
                if (m === null) continue;
                if (m === '[DONE]') {
                  controller.close();
                  // 스트림 완료 시 외부 API 로깅 (openai-compatible)
                  try {
                    const responseTime = Date.now() - startAt;
                    await logExternalApiRequest({
                      sourceType: 'internal',
                      provider: 'openai-compatible',
                      apiType: apiTypeForLog,
                      endpoint: openaiUrl,
                      model: actualModelName, // 실제 모델명
                      messages: fullMessagesForLogging, // 전체 메시지 히스토리 포함
                      promptTokenCount: finalPrompt.length,
                      responseTokenCount: accumulatedResponse.length,
                      responseTime,
                      firstResponseTime: firstResponseAt
                        ? firstResponseAt - startAt
                        : responseTime,
                      finalResponseTime: responseTime,
                      statusCode: openaiRes.status,
                      isStream: true,
                      clientIP,
                      userAgent,
                      roomId: roomId || null,
                    });
                  } catch (e) {
                    console.warn(
                      '[openai-compatible] 외부 API 로깅 실패(무시):',
                      e?.message || e
                    );
                  }
                  await logImageAnalysisToMessages({
                    requestPurpose,
                    roomId: roomId || null,
                    userId: payload?.sub || null,
                    userRole: payload?.role || null,
                    model: actualModelName,
                    text: accumulatedResponse,
                    clientIP,
                  });
                  // modellogs에도 OPENAI 프록시 로그 기록
                  try {
                    const { logOpenAIRequest } = await import(
                      '@/lib/modelServerMonitor'
                    );
                    await logOpenAIRequest(instanceId, {
                      method: 'POST',
                      endpoint: openaiUrl,
                      model,
                      messages: openaiMessages,
                      userAgent,
                      clientIP,
                      requestSize: JSON.stringify(body).length,
                      responseTime: Date.now() - startAt,
                      responseStatus: openaiRes.status,
                      responseSize: accumulatedResponse.length,
                      isStream: true,
                      roomId,
                      userId: payload?.email || 'unknown',
                      level: openaiRes.ok ? 'info' : 'error',
                      hasFiles,
                      fileCount: 0,
                      promptTokens: finalPrompt.length,
                      completionTokens: accumulatedResponse.length,
                      totalTokens:
                        finalPrompt.length + accumulatedResponse.length,
                    });
                  } catch (e) {
                    console.warn(
                      '[openai-compatible] modellogs 기록 실패(무시):',
                      e?.message || e
                    );
                  }
                  return;
                }
                try {
                  const json = JSON.parse(m);
                  const delta =
                    json.choices?.[0]?.delta?.content ??
                    json.choices?.[0]?.text ??
                    '';
                  if (delta) {
                    accumulatedResponse += delta;
                    if (!firstResponseAt) {
                      firstResponseAt = Date.now();
                    }
                    controller.enqueue(
                      encoder.encode(JSON.stringify({ response: delta }) + '\n')
                    );
                  }
                } catch (error) {
                  console.warn('[Catch] 에러 발생:', error.message);
                  // 무시
                }
              }
            }
            // 남은 버퍼 처리
            const rest = buffer.trim();
            if (rest.startsWith('data:')) {
              const payload = rest.slice(5).trim();
              if (payload && payload !== '[DONE]') {
                try {
                  const json = JSON.parse(payload);
                  const delta =
                    json.choices?.[0]?.delta?.content ??
                    json.choices?.[0]?.text ??
                    '';
                  if (delta) {
                    accumulatedResponse += delta;
                    if (!firstResponseAt) {
                      firstResponseAt = Date.now();
                    }
                    controller.enqueue(
                      encoder.encode(JSON.stringify({ response: delta }) + '\n')
                    );
                  }
                } catch (error) {
                  console.warn('[Catch] 에러 발생:', error.message);
                  // 무시
                }
              }
            }
            controller.close();
            // 스트림 자연 종료 시 외부 API 로깅 (openai-compatible)
            try {
              const responseTime = Date.now() - startAt;
              await logExternalApiRequest({
                sourceType: 'internal',
                provider: 'openai-compatible',
                apiType: apiTypeForLog,
                endpoint: openaiUrl,
                model: actualModelName, // 실제 모델명
                messages: fullMessagesForLogging, // 전체 메시지 히스토리 포함
                promptTokenCount: finalPrompt.length,
                responseTokenCount: accumulatedResponse.length,
                responseTime,
                statusCode: openaiRes.status,
                isStream: true,
                clientIP,
                userAgent,
                roomId: roomId || null,
              });
            } catch (e) {
              console.warn(
                '[openai-compatible] 외부 API 로깅 실패(무시):',
                e?.message || e
              );
            }
            await logImageAnalysisToMessages({
              requestPurpose,
              roomId: roomId || null,
              userId: payload?.sub || null,
              userRole: payload?.role || null,
              model: actualModelName,
              text: accumulatedResponse,
              clientIP,
            });
            // modellogs에도 OPENAI 프록시 로그 기록
            try {
              const { logOpenAIRequest } = await import(
                '@/lib/modelServerMonitor'
              );
              await logOpenAIRequest(instanceId, {
                method: 'POST',
                endpoint: openaiUrl,
                model,
                messages: openaiMessages,
                userAgent,
                clientIP,
                requestSize: JSON.stringify(body).length,
                responseTime: Date.now() - startAt,
                responseStatus: openaiRes.status,
                responseSize: accumulatedResponse.length,
                isStream: true,
                roomId,
                userId: payload?.email || 'unknown',
                level: openaiRes.ok ? 'info' : 'error',
                hasFiles,
                fileCount: 0,
                promptTokens: finalPrompt.length,
                completionTokens: accumulatedResponse.length,
                totalTokens: finalPrompt.length + accumulatedResponse.length,
              });
            } catch (e) {
              console.warn(
                '[openai-compatible] modellogs 기록 실패(무시):',
                e?.message || e
              );
            }
          } catch (e) {
            console.error('[generate] OpenAI 호환 스트림 처리 오류:', e);
            controller.error(e);
          }
        },
      });

      return new Response(stream, {
        status: openaiRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // LLM 요청 (라운드로빈 추적)
      let llmEndpoint = forcedLlmEndpoint;
      let roundRobinIndex = null;
      if (!llmEndpoint) {
        // 모델 이름에서 서버 이름 파싱
        let { serverName } = parseModelName(model);

        // 모델 ID에서 서버 이름을 파싱하지 못한 경우, DB 설정에서 확인
        if (!serverName) {
          const { getServerNameForModel } = await import('@/lib/modelServers');
          const dbServerName = await getServerNameForModel(model);
          if (dbServerName) {
            serverName = dbServerName;
            console.log(
              `[Model Server Selection] DB 설정에서 서버 그룹 찾음: "${model}" -> "${serverName}"`
            );
          }
        }

        if (serverName) {
          // 서버 이름이 있으면 해당 서버 그룹에서만 라운드로빈
          const serverEndpoint = await getModelServerEndpointByName(serverName);
          if (serverEndpoint) {
            llmEndpoint = serverEndpoint.endpoint;
            roundRobinIndex = serverEndpoint.index;
            console.log(
              `[Model Server Selection] 모델 "${model}" -> 서버 그룹 "${serverName}" -> 엔드포인트: ${llmEndpoint} (RR: ${roundRobinIndex})`
            );
          } else {
            // 서버 이름으로 찾지 못하면 전체 라운드로빈 사용
            console.warn(
              `[Model Server Selection] 서버 그룹 "${serverName}"을 찾을 수 없어 전체 라운드로빈 사용`
            );
            const next = await getNextModelServerEndpointWithIndex();
            llmEndpoint = next.endpoint;
            roundRobinIndex = next.index;
          }
        } else {
          // 서버 이름이 없으면 전체 라운드로빈 사용
          const next = await getNextModelServerEndpointWithIndex();
          llmEndpoint = next.endpoint;
          roundRobinIndex = next.index;
        }
      }
      const llmUrl = `${llmEndpoint}/api/chat`;
      const startTime = Date.now();
      const streamStartTime = Date.now(); // 스트림 시작 시간 (로깅용)
      const instanceId = `llm-${new URL(llmEndpoint).hostname}-${
        new URL(llmEndpoint).port
      }`;

      // Ollama /api/chat을 위한 메시지 배열 구성
      const ollamaMessages = [
        ...filteredMultiturnHistory.map((msg) => ({
          role: msg.role,
          content: typeof msg.text === 'string' ? msg.text : msg.text || '',
        })),
        {
          role: 'user',
          content: userText,
          ...(normalizedImages.length > 0
            ? { images: normalizedImages.map((image) => image.data).filter(Boolean) }
            : {}),
        },
      ];

      console.log(
        `[generate] Ollama /api/chat 호출: ${filteredMultiturnHistory.length}개 히스토리 + 현재 질문`
      );

      const llmRes = await fetch(llmUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: actualModelName, // UUID -> 실제 모델명으로 변환된 값 사용
          messages: ollamaMessages,
          stream: true,
          options: systemPrompt
            ? {
                ...llmPayload.options,
                system: systemPrompt,
              }
            : llmPayload.options,
        }),
      });

      const responseTime = Date.now() - startTime;

      // 상세 LLM 요청 로그 기록
      const requestLogData = {
        method: 'POST',
        endpoint: '/api/chat',
        requestType,
        model,
        hasFiles,
        fileCount: 0,
        userAgent,
        clientIP,
        requestSize: JSON.stringify({ model, messages: ollamaMessages }).length,
        responseTime,
        responseStatus: llmRes.status,
        responseSize: 0, // 스트림이므로 나중에 계산 어려움
        errorMessage: llmRes.ok
          ? null
          : `HTTP ${llmRes.status}: ${llmRes.statusText}`,
        roundRobinIndex,
        roomId,
        userId: payload?.email || 'unknown',
      };

      await logModelServerRequest(instanceId, requestLogData);

      // 기존 로그도 유지
      if (llmRes.ok) {
        await logModelServerAPICall(llmEndpoint, true, responseTime);
      } else {
        await logModelServerAPICall(
          llmEndpoint,
          false,
          responseTime,
          new Error(`HTTP ${llmRes.status}: ${llmRes.statusText}`)
        );

        // 실패한 호출도 외부 API 로깅에 기록
        try {
          let errorText = '';
          try {
            // 응답 본문을 읽기 전에 복제 (스트림 소비 방지)
            const clonedRes = llmRes.clone();
            errorText = await clonedRes.text();
          } catch (e) {
            errorText = `HTTP ${llmRes.status}: ${llmRes.statusText}`;
          }

          await logExternalApiRequest({
            sourceType: 'internal',
            provider: 'model-server',
            apiType: apiTypeForLog,
            endpoint: llmUrl,
            model: actualModelName, // 실제 모델명
            messages: fullMessagesForLogging, // 전체 메시지 히스토리 포함
            promptTokenCount: ollamaMessages.reduce(
              (sum, m) => sum + (m.content?.length || 0),
              0
            ),
            responseTokenCount: 0,
            responseTime,
            statusCode: llmRes.status,
            isStream: true,
            error: errorText.substring(0, 500),
            clientIP,
            userAgent,
            roomId: roomId || null,
            jwtUserId: payload?.sub || null,
            jwtEmail: payload?.email || null,
            jwtName: payload?.name || null,
            jwtRole: payload?.role || null,
            xForwardedFor: request.headers.get('x-forwarded-for'),
            xRealIP: request.headers.get('x-real-ip'),
            acceptLanguage: request.headers.get('accept-language'),
            referer: request.headers.get('referer'),
            origin: request.headers.get('origin'),
          });
        } catch (logErr) {
          console.warn(
            '[webapp-generate] 외부 API 로깅 실패(무시):',
            logErr?.message || logErr
          );
        }
      }

      const piiFilterResponse = matchedModel?.piiFilterResponse === true;

      // 스트림 응답 (응답 내용 누적하여 로깅)
      const stream = new ReadableStream({
        async start(controller) {
          const reader = llmRes.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let accumulatedResponse = '';
          const streamStartTime = Date.now();

          try {
            const parseOllamaLine = (rawLine) => {
              if (!rawLine) return null;
              let line = rawLine.trim();
              if (!line) return null;
              if (line.startsWith('data:')) {
                line = line.replace(/^data:\s*/, '');
                if (line === '[DONE]') {
                  return { done: true };
                }
              }
              if (!line.startsWith('{')) return null;
              try {
                return JSON.parse(line);
              } catch (parseError) {
                const start = line.indexOf('{');
                const end = line.lastIndexOf('}');
                if (start !== -1 && end > start) {
                  try {
                    return JSON.parse(line.slice(start, end + 1));
                  } catch (innerError) {
                    return null;
                  }
                }
                return null;
              }
            };
            let buffer = '';
            let parseFailureCount = 0;
            let streamClosed = false;
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;

              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (!line.trim()) continue;

                try {
                  const json = parseOllamaLine(line);
                  if (!json) {
                    parseFailureCount += 1;
                    continue;
                  }

                  if (json.message?.content) {
                    accumulatedResponse += json.message.content;

                    if (!piiFilterResponse) {
                      const responseChunk =
                        JSON.stringify({
                          response: json.message.content,
                        }) + '\n';
                      if (!streamClosed) {
                        try {
                          controller.enqueue(
                            new TextEncoder().encode(responseChunk)
                          );
                        } catch (enqueueError) {
                          streamClosed = true;
                        }
                      }
                    }
                  }

                  if (json.done) {
                    break;
                  }
                } catch (parseError) {
                  parseFailureCount += 1;
                }
              }
            }

            if (piiFilterResponse && accumulatedResponse) {
              const piiResult = await detectAndMaskPII(accumulatedResponse, {
                mxtVrf: matchedModel?.piiResponseMxtVrf !== false,
                maskOpt: matchedModel?.piiResponseMaskOpt !== false,
              }, {
                model: actualModelName,
                roomId: roomId || null,
                clientIP,
                userAgent,
                xForwardedFor: request.headers.get('x-forwarded-for'),
                xRealIP: request.headers.get('x-real-ip'),
                acceptLanguage: request.headers.get('accept-language'),
                referer: request.headers.get('referer'),
                origin: request.headers.get('origin'),
                jwtUserId: payload?.sub || null,
                jwtEmail: payload?.email || null,
                jwtName: payload?.name || null,
                jwtRole: payload?.role || null,
              });
              const finalResponse = piiResult.detected ? piiResult.maskedText : accumulatedResponse;
              if (piiResult.detected) {
                console.log(`[PII] 응답에서 ${piiResult.detectedCnt}개 PII 감지 → 마스킹 적용`);
              }
              if (!streamClosed) {
                try {
                  controller.enqueue(
                    new TextEncoder().encode(JSON.stringify({ response: finalResponse }) + '\n')
                  );
                } catch (enqueueError) {
                  streamClosed = true;
                }
              }
              accumulatedResponse = finalResponse;
            }

            if (!streamClosed) {
              try {
                controller.close();
              } catch (closeError) {
                streamClosed = true;
              }
            }

            if (parseFailureCount > 0) {
              console.info(
                `[generate] Ollama 응답 파싱 실패 ${parseFailureCount}건 (부분 청크로 인해 일부 라인 스킵)`
              );
            }

            // 스트림 완료 후 외부 API 로깅
            if (llmRes.ok) {
              try {
                const streamResponseTime = Date.now() - streamStartTime;
                const promptTokens = ollamaMessages.reduce(
                  (sum, m) => sum + (m.content?.length || 0),
                  0
                );
                const responseTokens = accumulatedResponse.length;

                // 사용자 정보 추출
                const jwtUserId = payload?.sub || null;
                const jwtEmail = payload?.email || null;
                const jwtName = payload?.name || null;
                const jwtRole = payload?.role || null;

                await logExternalApiRequest({
                  sourceType: 'internal',
                  provider: 'model-server',
                  apiType: apiTypeForLog,
                  endpoint: llmUrl,
                  model: actualModelName, // 실제 모델명
                  messages: fullMessagesForLogging, // 전체 메시지 히스토리 포함
                  promptTokenCount: promptTokens,
                  responseTokenCount: responseTokens,
                  responseTime: streamResponseTime,
                  statusCode: llmRes.status,
                  isStream: true,
                  clientIP,
                  userAgent,
                  roomId: roomId || null,
                  jwtUserId,
                  jwtEmail,
                  jwtName,
                  jwtRole,
                  xForwardedFor: request.headers.get('x-forwarded-for'),
                  xRealIP: request.headers.get('x-real-ip'),
                  acceptLanguage: request.headers.get('accept-language'),
                  referer: request.headers.get('referer'),
                  origin: request.headers.get('origin'),
                });
              } catch (logError) {
                console.warn(
                  '[webapp-generate] 외부 API 로깅 실패(무시):',
                  logError?.message || logError
                );
              }
              await logImageAnalysisToMessages({
                requestPurpose,
                roomId: roomId || null,
                userId: payload?.sub || null,
                userRole: payload?.role || null,
                model: actualModelName,
                text: accumulatedResponse,
                clientIP,
              });
            }
          } catch (streamError) {
            console.error('[webapp-generate] 스트림 처리 오류:', streamError);
            controller.error(streamError);
          }
        },
      });

      return new Response(stream, {
        status: llmRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('[/api/generate] 서버 에러:', err);

    // 에러 상황에서도 로그 기록
    try {
      if (typeof instanceId !== 'undefined' && instanceId) {
        await logModelServerRequest(instanceId, {
          method: 'POST',
          endpoint: '/api/generate',
          requestType:
            typeof requestType !== 'undefined' ? requestType : 'unknown',
          model: actualModelName || 'unknown',
          responseTime: 0,
          responseStatus: 500,
          errorMessage: err.message,
          roundRobinIndex:
            typeof roundRobinIndex !== 'undefined' ? roundRobinIndex : null,
          roomId: roomId || null,
          userId: typeof payload !== 'undefined' ? payload?.email : 'unknown',
        });
      }
    } catch (logErr) {
      console.error('LLM 에러 로깅 실패:', logErr);
    }

    return NextResponse.json(
      { error: '프록시 요청 실패', details: err.message },
      { status: 500 }
    );
  }
}
