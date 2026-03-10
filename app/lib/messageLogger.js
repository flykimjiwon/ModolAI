import { query, transaction } from './postgres';
import { logger } from './logger';

/**
 * 메시지를 개인 대화저장용(chatHistory)과 관리자 로깅용(messages) 양쪽에 저장
 * @param {Object} messageData - 저장할 메시지 데이터
 * @param {string} messageData.roomId - 채팅방 ID
 * @param {string} messageData.userId - 사용자 ID
 * @param {string} messageData.role - 'user' 또는 'assistant'
 * @param {string} messageData.text - 메시지 내용
 * @param {string} messageData.model - AI 모델명 (선택사항)
 * @param {string} messageData.userRole - 사용자 역할 (선택사항)
 * @param {string} messageData.clientIP - 클라이언트 IP (선택사항)
 * 
 * 참고: 정규화로 인해 email, name, department, cell은 더 이상 저장하지 않습니다.
 * 필요 시 users 테이블과 JOIN하여 조회합니다.
 */
export async function saveMessageDual(messageData) {
  const currentTime = new Date();

  const {
    roomId,
    userId,
    role,
    text,
    model = null,
    userRole = 'user',
    clientIP = null,
  } = messageData;

  // text가 객체나 배열인 경우 JSON 문자열로 변환
  let textToSave = text;
  if (text !== null && text !== undefined) {
    if (typeof text === 'object') {
      try {
        textToSave = JSON.stringify(text, null, 2);
      } catch (e) {
        logger.warn('[messageLogger] text 객체 직렬화 실패, 문자열로 변환', {
          error: e.message,
        });
        textToSave = String(text);
      }
    } else {
      textToSave = String(text);
    }
  } else {
    textToSave = '';
  }

  try {
    return await transaction(async (client) => {
      // 1. 개인 대화저장용 (chat_history)
      const chatHistoryResult = await client.query(
        `INSERT INTO chat_history (room_id, user_id, role, text, model, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [roomId, userId || null, role, textToSave, model, currentTime]
      );

      // 2. 관리자 로깅용 (messages)
      // 정규화: email, name, department, cell 제거 (users 테이블에서 JOIN으로 조회)
      const messagesResult = await client.query(
        `INSERT INTO messages (role, user_role, model, text, room_id, user_id, client_ip, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          role,
          userRole,
          model,
          textToSave,
          roomId,
          userId || null,
          clientIP,
          currentTime,
        ]
      );

      return {
        success: true,
        chatHistoryId: chatHistoryResult.rows[0].id,
        messagesId: messagesResult.rows[0].id,
      };
    });
  } catch (error) {
    logger.error('이중 메시지 저장 실패', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * 간단한 메시지 로깅 (RAG 시스템용)
 * @param {string} role - 'user' 또는 'assistant'
 * @param {string} text - 메시지 내용
 * @param {string} userId - 사용자 ID
 * @param {string} clientIP - 클라이언트 IP
 * @param {string} roomId - 채팅방 ID
 * @param {string} model - AI 모델명
 * @param {Object} metadata - 추가 메타데이터
 */
export async function logMessage(
  role,
  text,
  userId,
  clientIP,
  roomId,
  model,
  metadata = {}
) {
  // 사용자 정보는 기본값으로 설정 (실제로는 JWT에서 가져와야 함)
  return await saveMessageDual({
    roomId,
    userId,
    role,
    text,
    model,
    email: 'system@internal.com', // 기본값
    name: 'System User', // 기본값
    department: 'System', // 기본값
    cell: 'N/A', // 기본값
    userRole: 'user',
    clientIP,
    ...metadata,
  });
}

/**
 * 채팅방 메시지 카운트 업데이트
 * @param {string} roomId - 채팅방 ID
 */
export async function updateRoomMessageCount(roomId) {
  try {
    await query(
      `UPDATE chat_rooms 
       SET updated_at = CURRENT_TIMESTAMP, message_count = message_count + 1 
       WHERE id = $1`,
      [roomId]
    );
  } catch (error) {
    logger.error('채팅방 메시지 카운트 업데이트 실패', {
      error: error.message,
      roomId,
    });
    // 이 오류는 메시지 저장에 영향을 주지 않도록 throw 하지 않음
  }
}
