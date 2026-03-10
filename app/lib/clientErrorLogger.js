/**
 * 클라이언트 에러 로깅 유틸리티
 *
 * 관리자 대시보드에서 확인 가능한 에러 로그를 전송합니다.
 * /admin/models 하단의 "오류 로그" 섹션에서 확인 가능
 */

let isLoggerReady = false;
const pendingLogs = [];

// 로거 초기화 (토큰이 준비되면 대기 중인 로그 전송)
export function initializeLogger() {
  if (isLoggerReady) return;

  const token = localStorage.getItem('token');
  if (token) {
    isLoggerReady = true;

    // 대기 중인 로그 전송
    while (pendingLogs.length > 0) {
      const log = pendingLogs.shift();
      sendLogImmediately(log);
    }
  }
}

// 즉시 로그 전송 (내부 함수)
async function sendLogImmediately(payload) {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    await fetch('/api/logs/client-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // 로깅 실패 시 콘솔에만 기록 (무한 루프 방지)
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[ClientErrorLogger] 로그 전송 실패:', error.message);
    }
  }
}

/**
 * 관리자 로그 전송
 * @param {Object} options
 * @param {string} options.level - 로그 레벨 (error, warn, info)
 * @param {string} options.message - 에러 메시지
 * @param {string} [options.stack] - 스택 트레이스
 * @param {Object} [options.context] - 추가 컨텍스트 정보
 * @param {boolean} [options.silent] - true면 콘솔 출력 안 함
 */
export async function logToAdmin({
  level = 'error',
  message,
  stack = null,
  context = null,
  silent = false,
} = {}) {
  if (!message) return;

  // 콘솔 출력 (silent가 false일 때만)
  if (!silent && typeof console !== 'undefined') {
    const consoleMethod = console[level] || console.log;
    consoleMethod(`[AdminLog] ${message}`, context || '');
  }

  const payload = {
    level,
    message,
    stack,
    context: {
      ...(context || {}),
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
    },
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };

  // 토큰이 준비되지 않았으면 큐에 저장
  if (!isLoggerReady) {
    const token = localStorage.getItem('token');
    if (!token) {
      pendingLogs.push(payload);
      return;
    }
    isLoggerReady = true;
  }

  // 즉시 전송
  await sendLogImmediately(payload);
}

/**
 * 에러 레벨 로그 전송 (단축 함수)
 */
export function logError(message, context = null, silent = false) {
  return logToAdmin({ level: 'error', message, context, silent });
}

/**
 * 경고 레벨 로그 전송 (단축 함수)
 */
export function logWarn(message, context = null, silent = false) {
  return logToAdmin({ level: 'warn', message, context, silent });
}

/**
 * 정보 레벨 로그 전송 (단축 함수)
 */
export function logInfo(message, context = null, silent = true) {
  return logToAdmin({ level: 'info', message, context, silent });
}

/**
 * 에러 객체를 관리자 로그로 전송
 */
export function logErrorObject(error, additionalContext = null) {
  if (!error) return;

  const message = error.message || String(error);
  const stack = error.stack || null;
  const context = {
    ...(additionalContext || {}),
    errorName: error.name || 'Error',
    errorCode: error.code || null,
  };

  return logToAdmin({
    level: 'error',
    message,
    stack,
    context,
  });
}

// 브라우저 환경에서만 자동 초기화
if (typeof window !== 'undefined') {
  // 페이지 로드 후 자동 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLogger);
  } else {
    initializeLogger();
  }

  // storage 이벤트 감지 (다른 탭에서 로그인 시)
  window.addEventListener('storage', (e) => {
    if (e.key === 'token' && e.newValue) {
      initializeLogger();
    }
  });
}
