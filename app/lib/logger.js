// 브라우저 환경 체크 (최상위에서 먼저 확인)
const isBrowser = typeof window !== 'undefined';

// 서버 사이드에서만 winston import
let winston = null;
let path = null;
let fileURLToPath = null;

if (!isBrowser) {
  // 동적 import를 사용하여 서버 환경에서만 winston 로드
  winston = require('winston');
  path = require('path');
  const url = require('url');
  fileURLToPath = url.fileURLToPath;
}

// 로그 레벨 정의
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 로그 컬러 정의
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// 환경 변수에서 로그 레벨 가져오기
const getLogLevel = () => {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'development') {
    return process.env.LOG_LEVEL || 'debug';
  }
  return process.env.LOG_LEVEL || 'info';
};

// Winston logger 생성 (서버 사이드 전용)
const createWinstonLogger = () => {
  if (isBrowser || !winston || !path) {
    return null;
  }

  // ES 모듈에서 __dirname 대체
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // 로그 포맷 정의
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  );

  // 콘솔 출력 포맷 (개발 환경용)
  const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      let msg = `${timestamp} [${level}]: ${message}`;

      // 메타데이터가 있으면 추가
      if (Object.keys(metadata).length > 0) {
        // stack trace가 있으면 별도로 표시
        if (metadata.stack) {
          msg += `\n${metadata.stack}`;
          delete metadata.stack;
        }

        // 나머지 메타데이터 표시
        const remainingMetadata = { ...metadata };
        delete remainingMetadata.timestamp;
        delete remainingMetadata.level;
        delete remainingMetadata.message;

        if (Object.keys(remainingMetadata).length > 0) {
          msg += `\n${JSON.stringify(remainingMetadata, null, 2)}`;
        }
      }

      return msg;
    })
  );

  const transports = [];

  // 파일 전송 (프로덕션 환경)
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.ENABLE_FILE_LOGGING === 'true'
  ) {
    // 로그 디렉토리 (프로젝트 루트 기준)
    const logDir = path.join(__dirname, '../../logs');

    // 에러 로그
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );

    // 결합 로그
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: logFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );
  }

  // 콘솔 전송 (개발 환경 또는 명시적 활성화)
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_CONSOLE_LOGGING === 'true'
  ) {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
      })
    );
  }

  // Winston logger 인스턴스 생성
  const winstonLogger = winston.createLogger({
    level: getLogLevel(),
    levels: LOG_LEVELS,
    transports,
    exitOnError: false,
  });

  // 색상 추가
  winston.addColors(LOG_COLORS);

  return winstonLogger;
};

// 클라이언트 사이드용 간단한 로거
const createBrowserLogger = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    error: (...args) => {
      if (isDevelopment) {
        console.error('[ERROR]', ...args);
      }
    },
    warn: (...args) => {
      if (isDevelopment) {
        console.warn('[WARN]', ...args);
      }
    },
    info: (...args) => {
      if (isDevelopment) {
        console.info('[INFO]', ...args);
      }
    },
    http: (...args) => {
      if (isDevelopment) {
        console.log('[HTTP]', ...args);
      }
    },
    debug: (...args) => {
      if (isDevelopment) {
        console.debug('[DEBUG]', ...args);
      }
    },
    log: (...args) => {
      if (isDevelopment) {
        console.log('[LOG]', ...args);
      }
    },
    getInstance: () => null,
  };
};

// Logger 인스턴스 생성
let winstonLogger = null;

if (!isBrowser) {
  winstonLogger = createWinstonLogger();
}

// 안전한 logger 메서드 래퍼 (winston logger 종료 후 호출 방지)
const safeLogMethod = (methodName) => {
  return (message, ...meta) => {
    if (!winstonLogger) return;
    try {
      const method = winstonLogger[methodName];
      if (method && typeof method === 'function') {
        method.call(winstonLogger, message, ...meta);
      }
    } catch (error) {
      // logger가 이미 종료된 경우 무시 (write after end 에러 방지)
      if (error.code !== 'ERR_STREAM_WRITE_AFTER_END') {
        // 다른 종류의 에러는 console에 출력
        if (typeof console !== 'undefined' && console.error) {
          console.error(`Logger ${methodName} 호출 실패:`, error.message);
        }
      }
    }
  };
};

// 편의 함수들과 함께 export
export const logger = isBrowser
  ? createBrowserLogger()
  : {
      // 기본 로깅 메서드 (안전하게 래핑)
      error: safeLogMethod('error'),
      warn: safeLogMethod('warn'),
      info: safeLogMethod('info'),
      http: safeLogMethod('http'),
      debug: safeLogMethod('debug'),

      // 기존 호환성을 위한 log 메서드 (info와 동일)
      log: safeLogMethod('info'),

      // Winston 인스턴스 직접 접근 (고급 사용)
      getInstance: () => winstonLogger,
    };

// 서버 사이드에서만 초기화 메시지 출력
if (!isBrowser && winstonLogger) {
  logger.info('Logger initialized', {
    level: getLogLevel(),
    environment: process.env.NODE_ENV || 'development',
    fileLogging:
      process.env.NODE_ENV === 'production' ||
      process.env.ENABLE_FILE_LOGGING === 'true',
    consoleLogging:
      process.env.NODE_ENV !== 'production' ||
      process.env.ENABLE_CONSOLE_LOGGING === 'true',
  });
}

// 프로세스 종료 시 로그 스트림 정리 (서버 사이드만)
if (!isBrowser && winstonLogger) {
  let isShuttingDown = false;
  
  const gracefulShutdown = () => {
    // 이미 종료 중이면 무시
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    
    // winstonLogger를 직접 사용하여 end() 전에 로그 기록
    try {
      winstonLogger.info('Logger shutting down...');
      // end() 호출 시 모든 로그가 flush될 때까지 대기
      winstonLogger.end(() => {
        // 종료 완료 후 추가 작업이 필요한 경우 여기서 처리
      });
    } catch (error) {
      // 이미 종료된 경우 에러 무시
      // console.error는 사용 가능한 경우에만 사용
      if (typeof console !== 'undefined' && console.error) {
        console.error('Logger shutdown error:', error);
      }
    }
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

export default logger;
