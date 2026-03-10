import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyAdminWithResult } from '@/lib/auth';
import {
  createAuthError,
  createValidationError,
  createServerError,
} from '@/lib/errorHandler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_SITE_TITLE = 'TechAI';
const DEFAULT_SITE_DESCRIPTION = '신한은행 Tech그룹 AI';
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

async function ensureSettingsColumns() {
  const result = await query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'settings'
  `);
  const columns = new Set(result.rows.map((row) => row.column_name));
  const missing = [];

  if (!columns.has('max_images_per_message')) {
    missing.push(
      'ADD COLUMN IF NOT EXISTS max_images_per_message INTEGER DEFAULT 5'
    );
  }
  if (!columns.has('max_user_question_length')) {
    missing.push(
      'ADD COLUMN IF NOT EXISTS max_user_question_length INTEGER DEFAULT 300000'
    );
  }
  if (!columns.has('image_analysis_model')) {
    missing.push(
      'ADD COLUMN IF NOT EXISTS image_analysis_model VARCHAR(255)'
    );
  }
  if (!columns.has('image_analysis_prompt')) {
    missing.push(
      'ADD COLUMN IF NOT EXISTS image_analysis_prompt VARCHAR(500)'
    );
  }
  if (!columns.has('profile_edit_enabled')) {
    missing.push(
      'ADD COLUMN IF NOT EXISTS profile_edit_enabled BOOLEAN DEFAULT false'
    );
  }
  if (!columns.has('manual_preset_base_url')) {
    missing.push(
      "ADD COLUMN IF NOT EXISTS manual_preset_base_url VARCHAR(500) DEFAULT 'https://api.openai.com'"
    );
  }
  if (!columns.has('manual_preset_api_base')) {
    missing.push(
      "ADD COLUMN IF NOT EXISTS manual_preset_api_base VARCHAR(500) DEFAULT 'https://api.openai.com'"
    );
  }
  if (!columns.has('board_enabled')) {
    missing.push('ADD COLUMN IF NOT EXISTS board_enabled BOOLEAN DEFAULT true');
  }
  if (!columns.has('support_contacts')) {
    missing.push(
      "ADD COLUMN IF NOT EXISTS support_contacts JSONB DEFAULT '[]'::jsonb"
    );
  }
  if (!columns.has('support_contacts_enabled')) {
    missing.push(
      'ADD COLUMN IF NOT EXISTS support_contacts_enabled BOOLEAN DEFAULT true'
    );
  }
  if (!columns.has('login_type')) {
    missing.push(
      "ADD COLUMN IF NOT EXISTS login_type VARCHAR(20) DEFAULT 'local'"
    );
  }
  if (!columns.has('api_config_example')) {
    missing.push(
      'ADD COLUMN IF NOT EXISTS api_config_example TEXT'
    );
  }
  if (!columns.has('api_curl_example')) {
    missing.push(
      'ADD COLUMN IF NOT EXISTS api_curl_example TEXT'
    );
  }

  if (missing.length > 0) {
    await query(`ALTER TABLE settings ${missing.join(', ')}`);
  }
}

// 설정 조회 (일반 사용자도 읽기 가능)
export async function GET(request) {
  try {
    // 설정 읽기는 모든 사용자에게 허용

    // 설정 조회
    let settingsResult = await query(
      'SELECT * FROM settings WHERE config_type = $1 LIMIT 1',
      ['general']
    );
    let settings = settingsResult.rows[0] || null;

    // snake_case를 camelCase로 변환
    if (settings) {
      settings = {
        configType: settings.config_type,
        tooltipEnabled: settings.tooltip_enabled,
        tooltipMessage: settings.tooltip_message,
        chatWidgetEnabled: settings.chat_widget_enabled,
        profileEditEnabled: settings.profile_edit_enabled,
        manualPresetBaseUrl: settings.manual_preset_base_url,
        manualPresetApiBase: settings.manual_preset_api_base,
        boardEnabled: settings.board_enabled,
        supportContacts: settings.support_contacts,
        supportContactsEnabled: settings.support_contacts_enabled,
        siteTitle: settings.site_title,
        siteDescription: settings.site_description,
        faviconUrl: settings.favicon_url,
        roomNameGenerationModel: settings.room_name_generation_model,
        maxImagesPerMessage: settings.max_images_per_message,
        maxUserQuestionLength: settings.max_user_question_length,
        imageAnalysisModel: settings.image_analysis_model,
        imageAnalysisPrompt: settings.image_analysis_prompt,
        ollamaEndpoints: settings.ollama_endpoints,
        endpointType: settings.endpoint_type,
        openaiCompatBase: settings.openai_compat_base,
        openaiCompatApiKey: settings.openai_compat_api_key,
        customEndpoints: settings.custom_endpoints,
        loginType: settings.login_type,
        apiConfigExample: settings.api_config_example,
        apiCurlExample: settings.api_curl_example,
        createdAt: settings.created_at,
        updatedAt: settings.updated_at,
      };
    }

    // 기본 설정이 없으면 생성
    if (!settings) {
      const defaultSettings = {
        configType: 'general',
        tooltipEnabled: true,
        tooltipMessage: '더 고성능의 모델도 사용할 수 있어요',
        chatWidgetEnabled: false,
        profileEditEnabled: false,
        manualPresetBaseUrl: 'https://api.openai.com',
        manualPresetApiBase: 'https://api.openai.com',
        boardEnabled: true,
        supportContacts: [],
        supportContactsEnabled: true,
        siteTitle: DEFAULT_SITE_TITLE,
        siteDescription: DEFAULT_SITE_DESCRIPTION,
        faviconUrl: null,
        roomNameGenerationModel: 'gemma3:4b',
        maxUserQuestionLength: 300000,
        // 모델 모델서버(콤마 구분 문자열)
        ollamaEndpoints: 'http://localhost:11434',
        // LLM 모델서버 타입: 'ollama' | 'openai-compatible'
        endpointType: 'ollama',
        // OpenAI 호환형 모델서버 설정 (apiKey는 저장하되 조회 응답에서는 제외)
        openaiCompatBase: process.env.OPENAI_COMPAT_BASE || '',
        openaiCompatApiKey: process.env.OPENAI_COMPAT_API_KEY || '',
        // 커스텀 모델서버 설정 배열 [{name,url,provider}]
        customEndpoints: [],
        // 로그인 타입 ('local' | 'sso')
        loginType: 'local',
        // API 키 페이지 설정 예시
        apiConfigExample: `name: Local Agent
version: 1.0.0
schema: v1
models:
  - title: "My Chat Model"
    provider: "openai"
    model: "gemma3:4b"
    apiKey: "YOUR_API_KEY"
    baseUrl: "http://localhost:3000/v1"`,
        apiCurlExample: `curl -X POST http://localhost:3000/v1/chat/completions ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_API_KEY" ^
  -d "{\\\"model\\\": \\\"gemma3:4b\\\", \\\"messages\\\": [{\\\"role\\\": \\\"user\\\", \\\"content\\\": \\\"Hello!\\\"}], \\\"stream\\\": true}"`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await query(
        `INSERT INTO settings (
          config_type, tooltip_enabled, tooltip_message,
          chat_widget_enabled, profile_edit_enabled, board_enabled, manual_preset_base_url, manual_preset_api_base, site_title, site_description, favicon_url,
          room_name_generation_model, max_user_question_length, ollama_endpoints,
          endpoint_type, openai_compat_base, openai_compat_api_key, custom_endpoints, support_contacts,
          support_contacts_enabled,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
        [
          'general',
          defaultSettings.tooltipEnabled,
          defaultSettings.tooltipMessage,
          defaultSettings.chatWidgetEnabled,
          defaultSettings.profileEditEnabled,
          defaultSettings.boardEnabled,
          defaultSettings.manualPresetBaseUrl,
          defaultSettings.manualPresetApiBase,
          defaultSettings.siteTitle,
          defaultSettings.siteDescription,
          defaultSettings.faviconUrl,
          defaultSettings.roomNameGenerationModel,
          defaultSettings.maxUserQuestionLength,
          defaultSettings.ollamaEndpoints,
          defaultSettings.endpointType,
          defaultSettings.openaiCompatBase,
          defaultSettings.openaiCompatApiKey,
          JSON.stringify(defaultSettings.customEndpoints),
          JSON.stringify(defaultSettings.supportContacts || []),
          defaultSettings.supportContactsEnabled,
          defaultSettings.createdAt,
          defaultSettings.updatedAt,
        ]
      );

      settings = defaultSettings;
    }

    // customEndpoints 응답 구성 (없으면 ollamaEndpoints로부터 유추)
    let customEndpoints =
      Array.isArray(settings.customEndpoints) &&
      settings.customEndpoints.length > 0
        ? settings.customEndpoints
        : (settings.ollamaEndpoints || '')
            .split(',')
            .map((e) => e.trim())
            .filter(Boolean)
            .map((entry) => {
              const m = entry.match(/^(.*?)\s*[|=｜＝]\s*(https?:\/\/.+)$/i);
              if (m) {
                return {
                  name: m[1].trim(),
                  url: m[2].trim(),
                  provider: 'ollama',
                };
              }
              return { name: '', url: entry, provider: 'ollama' };
            });

    return NextResponse.json(
      {
        tooltipEnabled:
          settings.tooltipEnabled !== undefined ? settings.tooltipEnabled : true,
        tooltipMessage:
          settings.tooltipMessage || '더 고성능의 모델도 사용할 수 있어요',
        chatWidgetEnabled:
          settings.chatWidgetEnabled !== undefined
            ? settings.chatWidgetEnabled
            : false,
        profileEditEnabled:
          settings.profileEditEnabled !== undefined
            ? settings.profileEditEnabled
            : false,
        manualPresetBaseUrl:
          settings.manualPresetBaseUrl || 'https://api.openai.com',
        manualPresetApiBase:
          settings.manualPresetApiBase || 'https://api.openai.com',
        boardEnabled:
          settings.boardEnabled !== undefined ? settings.boardEnabled : true,
        supportContacts: Array.isArray(settings.supportContacts)
          ? settings.supportContacts
          : [],
        supportContactsEnabled:
          settings.supportContactsEnabled !== undefined
            ? settings.supportContactsEnabled
            : true,
        siteTitle: settings.siteTitle || DEFAULT_SITE_TITLE,
        siteDescription: settings.siteDescription || DEFAULT_SITE_DESCRIPTION,
        faviconUrl: settings.faviconUrl || null,
        roomNameGenerationModel:
          settings.roomNameGenerationModel || 'gemma3:4b',
        maxImagesPerMessage: settings.maxImagesPerMessage || 5,
        maxUserQuestionLength: settings.maxUserQuestionLength || 300000,
        imageAnalysisModel: settings.imageAnalysisModel || null,
        imageAnalysisPrompt:
          settings.imageAnalysisPrompt || '이 이미지를 설명해줘.',
        // DB 저장값 우선, 없으면 기본값
        ollamaEndpoints: settings.ollamaEndpoints || 'http://localhost:11434',
        // 모델서버 타입 및 OpenAI 호환 설정(민감정보 제외)
        endpointType:
          settings.endpointType === 'openai-compatible'
            ? 'openai-compatible'
            : 'ollama',
        openaiCompatBase: settings.openaiCompatBase || '',
        openaiCompatApiKeySet: !!settings.openaiCompatApiKey,
        customEndpoints,
        // 로그인 타입 설정
        loginType: settings.loginType || 'local',
        // API 키 페이지 예시 설정
        apiConfigExample: settings.apiConfigExample || '',
        apiCurlExample: settings.apiCurlExample || '',
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error('설정 조회 실패:', error);
    return createServerError(error, '설정을 불러오는데 실패했습니다.');
  }
}

// 설정 업데이트
export async function PUT(request) {
  try {
    // 관리자 권한 확인
    const adminCheck = verifyAdminWithResult(request);
    if (!adminCheck.valid) {
      return createAuthError(adminCheck.error);
    }

    await ensureSettingsColumns();

    const {
      tooltipEnabled,
      tooltipMessage,
      chatWidgetEnabled,
      profileEditEnabled,
      manualPresetBaseUrl,
      manualPresetApiBase,
      boardEnabled,
      supportContacts,
      supportContactsEnabled,
      siteTitle,
      siteDescription,
      faviconUrl,
      roomNameGenerationModel,
      maxImagesPerMessage,
      maxUserQuestionLength,
      imageAnalysisModel,
      imageAnalysisPrompt,
      ollamaEndpoints,
      endpointType,
      openaiCompatBase,
      openaiCompatApiKey,
      customEndpoints,
      loginType,
      apiConfigExample,
      apiCurlExample,
    } = await request.json();

    // 입력값 검증
    const updateData = {};


    if (tooltipEnabled !== undefined) {
      if (typeof tooltipEnabled !== 'boolean') {
        return createValidationError('툴팁 활성화는 boolean 값이어야 합니다.');
      }
      updateData.tooltipEnabled = tooltipEnabled;
    }

    if (tooltipMessage !== undefined) {
      if (typeof tooltipMessage !== 'string' || tooltipMessage.length > 100) {
        return createValidationError(
          '툴팁 메시지는 100자 이하의 문자열이어야 합니다.'
        );
      }
      updateData.tooltipMessage = tooltipMessage;
    }

    if (chatWidgetEnabled !== undefined) {
      if (typeof chatWidgetEnabled !== 'boolean') {
        return createValidationError(
          '채팅 위젯 활성화는 boolean 값이어야 합니다.'
        );
      }
      updateData.chatWidgetEnabled = chatWidgetEnabled;
    }

    if (profileEditEnabled !== undefined) {
      if (typeof profileEditEnabled !== 'boolean') {
        return createValidationError(
          '프로필 수정 메뉴 활성화는 boolean 값이어야 합니다.'
        );
      }
      updateData.profileEditEnabled = profileEditEnabled;
    }

    if (manualPresetBaseUrl !== undefined) {
      if (
        manualPresetBaseUrl !== null &&
        typeof manualPresetBaseUrl !== 'string'
      ) {
        return createValidationError(
          '프리셋 baseUrl은 문자열 또는 null이어야 합니다.'
        );
      }
      updateData.manualPresetBaseUrl = manualPresetBaseUrl;
    }

    if (manualPresetApiBase !== undefined) {
      if (
        manualPresetApiBase !== null &&
        typeof manualPresetApiBase !== 'string'
      ) {
        return createValidationError(
          '프리셋 apiBase는 문자열 또는 null이어야 합니다.'
        );
      }
      updateData.manualPresetApiBase = manualPresetApiBase;
    }

    if (boardEnabled !== undefined) {
      if (typeof boardEnabled !== 'boolean') {
        return createValidationError(
          '자유게시판 활성화는 boolean 값이어야 합니다.'
        );
      }
      updateData.boardEnabled = boardEnabled;
    }

    if (supportContacts !== undefined) {
      if (!Array.isArray(supportContacts)) {
        return createValidationError('담당자 목록은 배열이어야 합니다.');
      }
      const normalized = supportContacts
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const department =
            typeof item.department === 'string'
              ? item.department.trim().slice(0, 100)
              : '';
          const name =
            typeof item.name === 'string'
              ? item.name.trim().slice(0, 50)
              : '';
          const phone =
            typeof item.phone === 'string'
              ? item.phone.trim().slice(0, 30)
              : '';
          if (!department && !name && !phone) return null;
          return { department, name, phone };
        })
        .filter(Boolean);
      updateData.supportContacts = normalized;
    }

    if (supportContactsEnabled !== undefined) {
      if (typeof supportContactsEnabled !== 'boolean') {
        return createValidationError(
          '담당자 표시 여부는 boolean 값이어야 합니다.'
        );
      }
      updateData.supportContactsEnabled = supportContactsEnabled;
    }


    if (siteTitle !== undefined) {
      if (typeof siteTitle !== 'string' || siteTitle.length > 50) {
        return createValidationError(
          '사이트 제목은 50자 이하의 문자열이어야 합니다.'
        );
      }
      updateData.siteTitle = siteTitle;
    }

    if (siteDescription !== undefined) {
      if (typeof siteDescription !== 'string' || siteDescription.length > 200) {
        return createValidationError(
          '사이트 설명은 200자 이하의 문자열이어야 합니다.'
        );
      }
      updateData.siteDescription = siteDescription;
    }

    if (faviconUrl !== undefined) {
      if (
        faviconUrl !== null &&
        (typeof faviconUrl !== 'string' || faviconUrl.length > 500)
      ) {
        return createValidationError(
          '파비콘 URL은 500자 이하의 문자열이어야 합니다.'
        );
      }
      updateData.faviconUrl = faviconUrl;
    }

    if (roomNameGenerationModel !== undefined) {
      if (typeof roomNameGenerationModel !== 'string') {
        return createValidationError(
          '대화방명 생성 모델은 문자열이어야 합니다.'
        );
      }
      updateData.roomNameGenerationModel = roomNameGenerationModel;
    }

    if (maxImagesPerMessage !== undefined) {
      if (
        typeof maxImagesPerMessage !== 'number' ||
        maxImagesPerMessage < 1 ||
        maxImagesPerMessage > 20
      ) {
        return createValidationError(
          '메시지당 최대 이미지 개수는 1~20 사이의 숫자여야 합니다.'
        );
      }
      updateData.maxImagesPerMessage = maxImagesPerMessage;
    }

    if (maxUserQuestionLength !== undefined) {
      if (
        typeof maxUserQuestionLength !== 'number' ||
        maxUserQuestionLength < 1000 ||
        maxUserQuestionLength > 1000000
      ) {
        return createValidationError(
          '질문 길이 제한은 1,000~1,000,000 사이의 숫자여야 합니다.'
        );
      }
      updateData.maxUserQuestionLength = maxUserQuestionLength;
    }

    if (imageAnalysisModel !== undefined) {
      if (
        imageAnalysisModel !== null &&
        typeof imageAnalysisModel !== 'string'
      ) {
        return createValidationError(
          '이미지 분석 모델은 문자열 또는 null이어야 합니다.'
        );
      }
      updateData.imageAnalysisModel = imageAnalysisModel;
    }

    if (imageAnalysisPrompt !== undefined) {
      if (
        imageAnalysisPrompt !== null &&
        typeof imageAnalysisPrompt !== 'string'
      ) {
        return createValidationError(
          '이미지 분석 프롬프트는 문자열 또는 null이어야 합니다.'
        );
      }
      updateData.imageAnalysisPrompt = imageAnalysisPrompt;
    }

    if (ollamaEndpoints !== undefined) {
      if (typeof ollamaEndpoints !== 'string' || ollamaEndpoints.length < 7) {
        return createValidationError(
          '모델 모델서버는 문자열(콤마 구분)이어야 합니다.'
        );
      }
      updateData.ollamaEndpoints = ollamaEndpoints
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
        .join(',');
    }

    // 모델서버 타입 검증 및 저장
    if (endpointType !== undefined) {
      if (!['ollama', 'openai-compatible'].includes(endpointType)) {
        return createValidationError(
          "endpointType은 'ollama' 또는 'openai-compatible' 이어야 합니다."
        );
      }
      updateData.endpointType = endpointType;
    }

    // OpenAI 호환 설정 검증 및 저장
    if (openaiCompatBase !== undefined) {
      if (typeof openaiCompatBase !== 'string') {
        return createValidationError('openaiCompatBase는 문자열이어야 합니다.');
      }
      updateData.openaiCompatBase = openaiCompatBase.trim();
    }

    if (openaiCompatApiKey !== undefined) {
      if (
        openaiCompatApiKey !== null &&
        typeof openaiCompatApiKey !== 'string'
      ) {
        return createValidationError(
          'openaiCompatApiKey는 문자열 또는 null이어야 합니다.'
        );
      }
      // null을 보내면 키를 삭제
      updateData.openaiCompatApiKey = openaiCompatApiKey
        ? openaiCompatApiKey.trim()
        : '';
    }

    // 커스텀 모델서버 유효성 검증 및 동기화
    if (customEndpoints !== undefined) {
      if (!Array.isArray(customEndpoints)) {
        return createValidationError('customEndpoints는 배열이어야 합니다.');
      }
      const sanitized = [];
      const seenNames = new Set(); // 이름 중복 체크용
      for (const item of customEndpoints) {
        if (!item || typeof item !== 'object') continue;
        const name =
          typeof item.name === 'string' ? item.name.trim().slice(0, 50) : '';
        const url = typeof item.url === 'string' ? item.url.trim() : '';
        const provider =
          item.provider === 'openai-compatible'
            ? 'openai-compatible'
            : item.provider === 'gemini'
            ? 'gemini'
            : 'ollama';
        const apiKey =
          typeof item.apiKey === 'string' ? item.apiKey.trim() : '';
        // Gemini provider일 때는 API key 필수
        if (provider === 'gemini' && !apiKey) {
          return createValidationError(
            'Gemini provider는 API key가 필요합니다.'
          );
        }
        if (!url) continue;
        if (!name) {
          return createValidationError('모델서버 이름은 필수입니다.');
        }
        // 이름 중복 체크 (대소문자 구분 없이)
        const normalizedName = name.toLowerCase();
        if (seenNames.has(normalizedName)) {
          return createValidationError(`중복된 모델서버 이름입니다: ${name}`);
        }
        seenNames.add(normalizedName);
        try {
          const u = new URL(url);
          if (!/^https?:$/.test(u.protocol)) {
            return createValidationError(`잘못된 URL 프로토콜: ${url}`);
          }
          if (!u.host) {
            return createValidationError(`잘못된 URL 형식: ${url}`);
          }
        } catch (error) {
          console.warn('[Catch] 에러 발생:', error.message);
          return createValidationError(`유효한 URL이 아닙니다: ${url}`);
        }
        const isActive =
          item.isActive !== undefined ? Boolean(item.isActive) : true; // 기본값은 활성화
        sanitized.push({ name, url, provider, apiKey, isActive });
      }
      updateData.customEndpoints = sanitized;
      // 호환성 유지를 위해 ollama 전용 목록도 동기화
      const ollamaOnly = sanitized
        .filter((e) => e.provider === 'ollama')
        .map((e) => (e.name ? `${e.name}|${e.url}` : e.url))
        .join(',');
      updateData.ollamaEndpoints = ollamaOnly;
    }

    // 로그인 타입 검증 및 저장
    if (loginType !== undefined) {
      if (!['local', 'sso'].includes(loginType)) {
        return createValidationError(
          "loginType은 'local' 또는 'sso' 이어야 합니다."
        );
      }
      updateData.loginType = loginType;
    }

    // API 키 페이지 config 예시
    if (apiConfigExample !== undefined) {
      if (apiConfigExample !== null && typeof apiConfigExample !== 'string') {
        return createValidationError(
          'API config 예시는 문자열 또는 null이어야 합니다.'
        );
      }
      updateData.apiConfigExample = apiConfigExample || '';
    }

    // API 키 페이지 curl 예시
    if (apiCurlExample !== undefined) {
      if (apiCurlExample !== null && typeof apiCurlExample !== 'string') {
        return createValidationError(
          'API curl 예시는 문자열 또는 null이어야 합니다.'
        );
      }
      updateData.apiCurlExample = apiCurlExample || '';
    }

    // PostgreSQL 업데이트 쿼리 구성
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    // 각 필드를 snake_case로 변환하여 SET 절 구성
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'updatedAt') continue; // updated_at은 별도 처리

      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

      if (key === 'customEndpoints' || key === 'supportContacts') {
        // JSONB 필드는 JSON.stringify
        setClauses.push(`${snakeKey} = $${paramIndex}`);
        params.push(JSON.stringify(value));
      } else {
        setClauses.push(`${snakeKey} = $${paramIndex}`);
        params.push(value);
      }
      paramIndex++;
    }

    if (setClauses.length === 0) {
      // 업데이트할 필드가 없는 경우
      return NextResponse.json({
        success: true,
        message: '설정이 업데이트되었습니다.',
      });
    }

    // updated_at 추가
    setClauses.push('updated_at = CURRENT_TIMESTAMP');

    // room_name_generation_model 컬럼이 없으면 추가 (기존 DB 호환)
    try {
      await query(
        `ALTER TABLE settings 
         ADD COLUMN IF NOT EXISTS room_name_generation_model VARCHAR(255)`
      );
    } catch (alterError) {
      // 컬럼이 이미 존재하거나 다른 이유로 실패한 경우 무시
      console.warn(
        '[Settings] 컬럼 추가 시도 실패 (무시):',
        alterError.message
      );
    }

    // 기존 레코드 확인
    const existingResult = await query(
      'SELECT id FROM settings WHERE config_type = $1',
      ['general']
    );

    if (existingResult.rows.length > 0) {
      // UPDATE 쿼리
      await query(
        `UPDATE settings SET ${setClauses.join(', ')} WHERE config_type = $${
          params.length + 1
        }`,
        [...params, 'general']
      );
    } else {
      // INSERT 쿼리
      const insertColumns = [
        'config_type',
        ...Object.keys(updateData)
          .filter((k) => k !== 'updatedAt')
          .map((k) => k.replace(/([A-Z])/g, '_$1').toLowerCase()),
        'updated_at',
      ];
      const insertValues = ['general', ...params, 'CURRENT_TIMESTAMP'];
      const insertPlaceholders = insertValues
        .map((_, i) => `$${i + 1}`)
        .join(', ');

      await query(
        `INSERT INTO settings (${insertColumns.join(
          ', '
        )}) VALUES (${insertPlaceholders})`,
        insertValues
      );
    }

    return NextResponse.json({
      success: true,
      message: '설정이 업데이트되었습니다.',
      ...updateData,
    });
  } catch (error) {
    console.error('설정 업데이트 실패:', error);
    return createServerError(
      error,
      `설정 업데이트에 실패했습니다: ${error.message || '알 수 없는 오류'}`
    );
  }
}
