import { query } from './postgres';
import { logger } from './logger';

/**
 * 외부 API (/api/generate, /api/chat) 요청을 별도 테이블에 로깅합니다.
 * 기존 qaLogs와 구분하여 외부 도구(VSCode Continue 등)의 사용량을 추적합니다.
 * @param {object} logData - 기록할 데이터 객체
 */
export async function logExternalApiRequest(logData) {
  // 로깅 실패가 메인 API에 절대 영향을 주지 않도록 모든 에러를 내부에서 처리
  try {
    // 요청자 식별 정보 수집 (강화된 버전)
    const identificationData = {
      // === 기본 네트워크 정보 ===
      clientIP: logData.clientIP || 'unknown',
      userAgent: logData.userAgent || 'unknown',

      // === 프록시/로드밸런서 정보 ===
      xForwardedFor: logData.xForwardedFor || null,
      xRealIP: logData.xRealIP || null,
      xForwardedProto: logData.xForwardedProto || null,
      xForwardedHost: logData.xForwardedHost || null,

      // === 클라이언트 환경 정보 ===
      clientTool: parseClientTool(logData.userAgent || '', logData.xClientName),
      clientToolVersion: extractToolVersion(logData.userAgent || ''),
      operatingSystem: extractOperatingSystem(logData.userAgent || ''),
      architecture: extractArchitecture(logData.userAgent || ''),

      // === 브라우저/IDE 상세 정보 ===
      acceptLanguage: logData.acceptLanguage || null,
      acceptEncoding: logData.acceptEncoding || null,
      acceptCharset: logData.acceptCharset || null,
      referer: logData.referer || null,
      origin: logData.origin || null,

      // === 보안 헤더 ===
      authorization: logData.authorization || null,
      contentType: logData.contentType || null,

      // === 커스텀 헤더 (개발도구 식별용) ===
      xRequestedWith: logData.xRequestedWith || null,
      xClientName: logData.xClientName || null,
      xClientVersion: logData.xClientVersion || null,
      xUserName: logData.xUserName || null,
      xWorkspace: logData.xWorkspace || null,

      // === 사용자 정보 (API 토큰에서 추출) ===
      // 정규화: userEmail, userName, userRole, userDepartment, userCell 제거 (users 테이블에서 JOIN으로 조회)
      userId: logData.jwtUserId || logData.xUserId || null,
      tokenHash: logData.tokenHash || null,
      tokenName: logData.tokenName || null,

      // === 타이밍 정보 ===
      requestTime: new Date().toISOString(),
      timezone: logData.timezone || null,

      // === 식별자들 ===
      sessionHash: generateSessionHash(logData.clientIP, logData.userAgent),
      fingerprintHash: generateFingerprintHash(logData),
      userIdentifier: generateUserIdentifier(logData),
    };

    // conversationId 생성 (sessionHash, userIdentifier, tokenHash를 미리 계산)
    // 정규화: userEmail 제거, userId 사용
    identificationData.conversationId = generateConversationId(
      logData.roomId,
      logData.messages,
      identificationData.sessionHash,
      identificationData.userIdentifier,
      identificationData.tokenHash,
      identificationData.userId // 웹앱 채팅에서 같은 사용자의 같은 세션을 그룹화하기 위해 userId 사용
    );
    identificationData.roomId = logData.roomId || null; // roomId 저장

    // 프롬프트/메시지 전체 데이터를 별도 테이블에 저장
    let promptId = null;
    if (logData.prompt || logData.messages) {
      try {
        // 프롬프트/메시지 전체 데이터 저장 (길이 제한 없음)
        const promptResult = await query(
          `INSERT INTO external_api_prompts (prompt, messages)
           VALUES ($1, $2)
           RETURNING id`,
          [
            logData.prompt || null,
            logData.messages ? JSON.stringify(logData.messages) : null,
          ]
        );
        promptId = promptResult.rows[0]?.id || null;
      } catch (promptError) {
        logger.error('[External API Logger] 프롬프트 저장 실패 (무시됨)', {
          error: promptError.message,
        });
        // 프롬프트 저장 실패해도 로그는 계속 진행
      }
    }

    // 요청 내용 정리 (미리보기용 축약 버전)
    const resolvedSource =
      logData.sourceType === 'internal'
        ? 'internal'
        : logData.sourceType === 'external'
        ? 'external'
        : logData.tokenHash
        ? 'external'
        : 'internal';

    const processedData = {
      // API 정보
      apiType: logData.apiType, // 'generate' | 'chat'
      endpoint: logData.endpoint,
      model: logData.model, // 실제 모델명
      provider: logData.provider || null,

      // 요청 내용 (미리보기용 축약 버전)
      prompt: truncateText(logData.prompt, 2000), // 최대 2000자
      messages: logData.messages
        ? logData.messages.map((msg) => ({
            role: msg.role,
            content: truncateText(
              typeof msg.content === 'string'
                ? msg.content
                : JSON.stringify(msg.content),
              1000
            ), // 메시지당 최대 1000자
          }))
        : null,

      // 응답 정보 (토큰 길이만)
      responseTokenCount: logData.responseTokenCount || 0,
      promptTokenCount: logData.promptTokenCount || 0,
      totalTokenCount:
        (logData.promptTokenCount || 0) + (logData.responseTokenCount || 0),

      // 성능 정보
      responseTime: logData.responseTime || logData.finalResponseTime || 0,
      firstResponseTime:
        logData.firstResponseTime ??
        logData.responseTime ??
        logData.finalResponseTime ??
        0,
      finalResponseTime:
        logData.finalResponseTime ??
        logData.responseTime ??
        logData.firstResponseTime ??
        0,
      statusCode: logData.statusCode || 0,
      isStream: logData.isStream || false,

      // 오류 정보
      error: logData.error || null,

      // 재시도 정보
      retryCount: logData.retryCount !== undefined ? logData.retryCount : 1, // 기본값: 첫 시도에서 성공

      // HTTP 전체 정보
      requestHeaders: logData.requestHeaders || null,
      requestBody: logData.requestBody || null,
      responseHeaders: logData.responseHeaders || null,
      responseBody: logData.responseBody || null,

      // 식별 정보
      ...identificationData,

      // 메타데이터
      timestamp: new Date(),
      source: resolvedSource,
    };

    // conversation_id 및 room_id Check if columns exist
    let hasConversationIdColumn = false;
    let hasRoomIdColumn = false;
    let hasFirstResponseTimeColumn = false;
    let hasFinalResponseTimeColumn = false;
    try {
      const columnCheck = await query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'external_api_logs' 
         AND column_name IN ('conversation_id', 'room_id', 'first_response_time', 'final_response_time')`
      );
      hasConversationIdColumn = columnCheck.rows.some(row => row.column_name === 'conversation_id');
      hasRoomIdColumn = columnCheck.rows.some(row => row.column_name === 'room_id');
      hasFirstResponseTimeColumn = columnCheck.rows.some(
        (row) => row.column_name === 'first_response_time'
      );
      hasFinalResponseTimeColumn = columnCheck.rows.some(
        (row) => row.column_name === 'final_response_time'
      );
    } catch (error) {
      // 컬럼 확인 실패 시 conversation_id 없이 진행
      logger.warn('[External API Logger] 컬럼 확인 실패', {
        error: error.message,
      });
    }

    // PostgreSQL에 로그 기록
    const columns = [
      'api_type',
      'endpoint',
      'model',
      'provider',
      'prompt_id',
      'prompt',
      'messages',
      'response_token_count',
      'prompt_token_count',
      'total_token_count',
      'response_time',
      'status_code',
      'is_stream',
      'error',
      'retry_count',
      'client_ip',
      'user_agent',
      'x_forwarded_for',
      'x_real_ip',
      'x_forwarded_proto',
      'x_forwarded_host',
      'client_tool',
      'client_tool_version',
      'operating_system',
      'architecture',
      'accept_language',
      'accept_encoding',
      'accept_charset',
      'referer',
      'origin',
      '"authorization"',
      'content_type',
      'x_requested_with',
      'x_client_name',
      'x_client_version',
      'x_user_name',
      'x_workspace',
      'user_id',
      'token_hash',
      'token_name',
      'request_time',
      'timezone',
      'session_hash',
      'fingerprint_hash',
      'user_identifier',
    ];

    const values = [
      processedData.apiType,
      processedData.endpoint,
      processedData.model,
      processedData.provider,
      promptId,
      processedData.prompt,
      processedData.messages ? JSON.stringify(processedData.messages) : null,
      processedData.responseTokenCount,
      processedData.promptTokenCount,
      processedData.totalTokenCount,
      processedData.responseTime,
      processedData.statusCode,
      processedData.isStream,
      processedData.error,
      processedData.retryCount,
      identificationData.clientIP,
      identificationData.userAgent,
      identificationData.xForwardedFor,
      identificationData.xRealIP,
      identificationData.xForwardedProto,
      identificationData.xForwardedHost,
      identificationData.clientTool,
      identificationData.clientToolVersion,
      identificationData.operatingSystem,
      identificationData.architecture,
      identificationData.acceptLanguage,
      identificationData.acceptEncoding,
      identificationData.acceptCharset,
      identificationData.referer,
      identificationData.origin,
      identificationData.authorization,
      identificationData.contentType,
      identificationData.xRequestedWith,
      identificationData.xClientName,
      identificationData.xClientVersion,
      identificationData.xUserName,
      identificationData.xWorkspace,
      identificationData.userId,
      identificationData.tokenHash,
      identificationData.tokenName,
      identificationData.requestTime,
      identificationData.timezone,
      identificationData.sessionHash,
      identificationData.fingerprintHash,
      identificationData.userIdentifier,
    ];

    if (hasFirstResponseTimeColumn) {
      columns.push('first_response_time');
      values.push(processedData.firstResponseTime);
    }

    if (hasFinalResponseTimeColumn) {
      columns.push('final_response_time');
      values.push(processedData.finalResponseTime);
    }

    if (hasConversationIdColumn) {
      columns.push('conversation_id');
      values.push(identificationData.conversationId);
    }

    if (hasRoomIdColumn) {
      columns.push('room_id');
      values.push(identificationData.roomId);
    }

    columns.push('timestamp', 'source', 'request_headers', 'request_body', 'response_headers', 'response_body');
    values.push(
      processedData.timestamp,
      processedData.source,
      processedData.requestHeaders
        ? JSON.stringify(processedData.requestHeaders)
        : null,
      processedData.requestBody ? JSON.stringify(processedData.requestBody) : null,
      processedData.responseHeaders
        ? JSON.stringify(processedData.responseHeaders)
        : null,
      processedData.responseBody ? JSON.stringify(processedData.responseBody) : null
    );

    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    await query(
      `INSERT INTO external_api_logs (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    // 성공 로그 (간단하게)
    logger.info('[External API Logger] 로깅 완료', {
      apiType: logData.apiType,
      model: logData.model,
      statusCode: logData.statusCode,
    });
  } catch (error) {
    // 로깅 실패는 조용히 처리 - 메인 API에 절대 영향 없음
    logger.error('[External API Logger] 로깅 실패 (무시됨)', {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * 툴 버전 추출
 */
function extractToolVersion(userAgent) {
  const ua = userAgent.toLowerCase();

  // Continue 버전
  const continueMatch = ua.match(/continue[\/\s](\d+\.\d+\.\d+)/);
  if (continueMatch) return `Continue ${continueMatch[1]}`;

  // VSCode 버전
  const vscodeMatch = ua.match(/vscode[\/\s](\d+\.\d+\.\d+)/);
  if (vscodeMatch) return `VSCode ${vscodeMatch[1]}`;

  // Cursor 버전
  const cursorMatch = ua.match(/cursor[\/\s](\d+\.\d+\.\d+)/);
  if (cursorMatch) return `Cursor ${cursorMatch[1]}`;

  return 'Unknown Version';
}

/**
 * 운영체제 추출
 */
function extractOperatingSystem(userAgent) {
  const ua = userAgent.toLowerCase();

  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('ubuntu')) return 'Ubuntu';
  if (ua.includes('centos')) return 'CentOS';
  if (ua.includes('fedora')) return 'Fedora';
  if (ua.includes('darwin')) return 'macOS';

  return 'Unknown OS';
}

/**
 * 아키텍처 추출
 */
function extractArchitecture(userAgent) {
  const ua = userAgent.toLowerCase();

  if (ua.includes('x64') || ua.includes('x86_64') || ua.includes('amd64'))
    return 'x64';
  if (ua.includes('arm64') || ua.includes('aarch64')) return 'ARM64';
  if (ua.includes('x86') || ua.includes('i386') || ua.includes('i686'))
    return 'x86';
  if (ua.includes('arm')) return 'ARM';

  return 'Unknown Arch';
}

/**
 * 고급 핑거프린트 해시 생성 (더 정교한 사용자 식별)
 */
function generateFingerprintHash(logData) {
  const crypto = require('crypto');

  const fingerprintData = [
    logData.clientIP || '',
    logData.userAgent || '',
    logData.acceptLanguage || '',
    logData.acceptEncoding || '',
    logData.xForwardedFor || '',
    logData.xClientName || '',
    logData.xUserName || '',
    logData.xWorkspace || '',
  ].join('|');

  return crypto
    .createHash('sha256')
    .update(fingerprintData)
    .digest('hex')
    .substring(0, 16);
}

/**
 * 사용자 식별자 생성 (더 안정적인 추적)
 */
function generateUserIdentifier(logData) {
  const crypto = require('crypto');

  // 가장 안정적인 식별 요소들 조합
  const stableData = [
    logData.clientIP?.split('.').slice(0, 3).join('.') || '', // IP 마지막 옥텟 제외
    extractOperatingSystem(logData.userAgent || ''),
    extractToolVersion(logData.userAgent || ''),
    logData.acceptLanguage?.split(',')[0] || '', // 주 언어만
    logData.xUserName || '',
    logData.xWorkspace || '',
  ]
    .filter(Boolean)
    .join('_');

  if (!stableData) return 'anonymous';

  return crypto
    .createHash('sha256')
    .update(stableData)
    .digest('hex')
    .substring(0, 12);
}

/**
 * User-Agent에서 클라이언트 도구 식별
 */
function parseClientTool(userAgent, clientName) {
  const ua = (userAgent || '').toLowerCase();
  const name = (clientName || '').toLowerCase();

  if (name) {
    if (name.includes('continue') || name.includes('vscode')) {
      return 'VSCode Continue';
    } else if (name.includes('cursor')) {
      return 'Cursor';
    } else if (name.includes('copilot')) {
      return 'GitHub Copilot';
    } else if (name.includes('jetbrains')) {
      return 'JetBrains IDE';
    }
  }

  if (ua.includes('vscode') || ua.includes('continue')) {
    return 'VSCode Continue';
  } else if (ua.includes('cursor')) {
    return 'Cursor';
  } else if (ua.includes('copilot')) {
    return 'GitHub Copilot';
  } else if (ua.includes('jetbrains')) {
    return 'JetBrains IDE';
  } else if (ua.includes('sublime')) {
    return 'Sublime Text';
  } else if (ua.includes('atom')) {
    return 'Atom';
  } else if (ua.includes('vim') || ua.includes('neovim')) {
    return 'Vim/Neovim';
  } else if (ua.includes('emacs')) {
    return 'Emacs';
  } else if (ua.includes('postman')) {
    return 'Postman';
  } else if (ua.includes('insomnia')) {
    return 'Insomnia';
  } else if (ua.includes('curl')) {
    return 'cURL';
  } else if (ua.includes('wget')) {
    return 'wget';
  } else if (ua.includes('python')) {
    return 'Python Script';
  } else if (ua.includes('node')) {
    return 'Node.js Script';
  } else if (ua.includes('chrome')) {
    return 'Chrome Browser';
  } else if (ua.includes('firefox')) {
    return 'Firefox Browser';
  } else if (ua.includes('safari')) {
    return 'Safari Browser';
  }

  return 'Unknown';
}

/**
 * 세션 식별을 위한 해시 생성
 */
function generateSessionHash(ip, userAgent) {
  const crypto = require('crypto');
  const data = `${ip || 'unknown'}_${userAgent || 'unknown'}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 12);
}

/**
 * 대화 세션 식별을 위한 conversationId 생성
 * roomId가 있으면 roomId를 기반으로 생성하여 같은 채팅방의 모든 요청이 같은 ID를 가지도록 함
 * roomId가 없으면 sessionHash, userIdentifier, tokenHash, userEmail을 조합하여 생성
 * 같은 사용자, 같은 세션, 같은 API 토큰에서 온 요청들은 같은 conversationId를 가짐
 * 웹앱 채팅의 경우 userEmail을 포함하여 더 안정적인 그룹화
 */
function generateConversationId(roomId, messages, sessionHash, userIdentifier, tokenHash, userEmail) {
  const crypto = require('crypto');

  // roomId가 있으면 roomId를 기반으로 conversationId 생성 (같은 채팅방의 모든 대화가 같은 ID를 가짐)
  if (roomId) {
    return crypto
      .createHash('sha256')
      .update(String(roomId))
      .digest('hex')
      .substring(0, 16);
  }

  // roomId가 없으면 userEmail + sessionHash + tokenHash를 조합하여 생성
  // 같은 사용자, 같은 세션, 같은 API 토큰에서 온 요청들은 같은 conversationId를 가짐
  // 첫 메시지 내용에 의존하지 않으므로 이어지는 대화도 같은 ID를 가짐
  const parts = [];
  
  // userEmail 추가 (웹앱 채팅에서 같은 사용자의 대화를 그룹화, 가장 안정적)
  if (userEmail) {
    parts.push(userEmail);
  }
  
  // sessionHash 추가 (같은 세션 그룹화)
  if (sessionHash) {
    parts.push(sessionHash);
  }
  
  // tokenHash 추가 (같은 API 토큰 사용자 그룹화)
  if (tokenHash) {
    parts.push(tokenHash);
  }

  if (parts.length > 0) {
    const sessionData = parts.join('_');
    return crypto
      .createHash('sha256')
      .update(sessionData)
      .digest('hex')
      .substring(0, 16);
  }

  // userEmail, sessionHash, tokenHash가 모두 없으면 userIdentifier 사용 (fallback)
  if (userIdentifier) {
    return crypto
      .createHash('sha256')
      .update(String(userIdentifier))
      .digest('hex')
      .substring(0, 16);
  }

  // 모두 없으면 첫 번째 user 메시지 기반 (최종 fallback)
  // 이 경우는 거의 발생하지 않지만, 안전장치로 유지
  if (messages && Array.isArray(messages)) {
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'user') {
        const content = messages[i].content;
        if (content) {
          const contentStr = typeof content === 'string'
            ? content
            : JSON.stringify(content);
          return crypto
            .createHash('sha256')
            .update(contentStr)
            .digest('hex')
            .substring(0, 16);
        }
      }
    }
  }

  return null;
}

/**
 * 텍스트 길이 제한
 */
function truncateText(text, maxLength) {
  if (!text) return null;
  if (typeof text !== 'string') return String(text);

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength) + '... [truncated]';
}

/**
 * 외부 API 사용량 통계 조회
 */
export async function getExternalApiStats(timeRange = '7d') {
  try {
    // 시간 범위 계산
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 기본 통계
    const totalRequestsResult = await query(
      `SELECT COUNT(*) as count FROM external_api_logs WHERE timestamp >= $1`,
      [startDate]
    );
    const totalRequests = parseInt(totalRequestsResult.rows[0].count);

    // API 타입별 통계
    const apiTypeStatsResult = await query(
      `SELECT api_type as _id, COUNT(*) as count, SUM(total_token_count) as total_tokens
       FROM external_api_logs
       WHERE timestamp >= $1
       GROUP BY api_type`,
      [startDate]
    );
    const apiTypeStats = apiTypeStatsResult.rows.map((row) => ({
      _id: row._id,
      count: parseInt(row.count),
      totalTokens: parseInt(row.total_tokens || 0),
    }));

    // 클라이언트 도구별 통계
    const clientToolStatsResult = await query(
      `SELECT client_tool as _id, COUNT(*) as count, SUM(total_token_count) as total_tokens
       FROM external_api_logs
       WHERE timestamp >= $1
       GROUP BY client_tool
       ORDER BY count DESC`,
      [startDate]
    );
    const clientToolStats = clientToolStatsResult.rows.map((row) => ({
      _id: row._id,
      count: parseInt(row.count),
      totalTokens: parseInt(row.total_tokens || 0),
    }));

    // 모델별 통계
    const modelStatsResult = await query(
      `SELECT model as _id, COUNT(*) as count, SUM(total_token_count) as total_tokens
       FROM external_api_logs
       WHERE timestamp >= $1
       GROUP BY model
       ORDER BY count DESC`,
      [startDate]
    );
    const modelStats = modelStatsResult.rows.map((row) => ({
      _id: row._id,
      count: parseInt(row.count),
      totalTokens: parseInt(row.total_tokens || 0),
    }));

    return {
      totalRequests,
      timeRange,
      byApiType: apiTypeStats,
      byClientTool: clientToolStats,
      byModel: modelStats,
      startDate,
      endDate: now,
    };
  } catch (error) {
    logger.error('[External API Stats] 통계 조회 실패', {
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}
