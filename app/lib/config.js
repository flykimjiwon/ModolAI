export const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in the environment variables. Please check your .env file.');
}

/**
 * 모델 서버 호출 타임아웃 설정 (밀리초)
 * 환경변수로 설정 가능, 기본값: 스트리밍 15분, 일반 10분
 */
export const MODEL_SERVER_TIMEOUT_STREAM = parseInt(
  process.env.MODEL_SERVER_TIMEOUT_STREAM || '900000',
  10
); // 기본값: 15분 (900초)

export const MODEL_SERVER_TIMEOUT_NORMAL = parseInt(
  process.env.MODEL_SERVER_TIMEOUT_NORMAL || '600000',
  10
); // 기본값: 10분 (600초)

/**
 * 모델 서버 재시도 전 대기 시간 (밀리초)
 * 환경변수로 설정 가능, 기본값: 1초
 */
export const MODEL_SERVER_RETRY_DELAY = parseInt(
  process.env.MODEL_SERVER_RETRY_DELAY || '1000',
  10
); // 기본값: 1초
