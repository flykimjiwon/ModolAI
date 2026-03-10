import { query } from './postgres';
import { logger } from './logger';

/**
 * 질문과 답변(Q&A) 내용을 별도의 'qa_logs' 테이블에 기록합니다.
 * @param {object} logData - 기록할 데이터 객체
 */
export async function logQARequest(logData) {
  try {
    await query(
      `INSERT INTO qa_logs (timestamp, log_data)
       VALUES (CURRENT_TIMESTAMP, $1)`,
      [JSON.stringify(logData)]
    );
    logger.debug('[QA Logger] Q&A 로깅 완료', {
      logDataSize: JSON.stringify(logData).length,
    });
  } catch (error) {
    logger.error('[QA Logger] Q&A 로깅 실패', {
      error: error.message,
      stack: error.stack,
    });
  }
}
