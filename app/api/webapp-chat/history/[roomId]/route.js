import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/postgres';
import { saveMessageDual, updateRoomMessageCount } from '@/lib/messageLogger';
import { validateMessage } from '@/lib/validation';
import {
  createAuthError,
  createValidationError,
  createSuccessResponse,
  withErrorHandler,
} from '@/lib/errorHandler';

// 특정 채팅방의 히스토리 조회
export async function GET(request, { params }) {
  try {
    const payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { roomId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 50; // 기본 50개
    const offset = parseInt(searchParams.get('offset')) || 0;

    // 채팅방 조회
    const roomResult = await query(
      'SELECT id, user_id, name, message_count FROM chat_rooms WHERE id = $1',
      [roomId]
    );

    // 채팅방이 존재하지 않는 경우
    if (roomResult.rows.length === 0) {
      return NextResponse.json(
        {
          error: '채팅방을 Not found.',
          shouldLogout: false,
        },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];

    // 채팅방 소유자 확인 (이메일 기반 - 더 안전함)
    const ownerResult = await query(
      'SELECT id, email FROM users WHERE id = $1',
      [room.user_id]
    );

    if (ownerResult.rows.length === 0 || ownerResult.rows[0].email !== payload.email) {
      return NextResponse.json(
        {
          error: '채팅방에 접근할 Unauthorized.',
          shouldLogout: true,
          message: 'Authentication expired. Please log in again.',
        },
        { status: 403 }
      );
    }

    // 채팅 히스토리 조회 (오래된 메시지부터)
    // 방제목 생성 관련 메시지는 제외 ([방제목으로 시작하는 메시지)
    const historyResult = await query(
      `SELECT id, room_id, user_id, role, text, model, created_at, feedback
       FROM chat_history
       WHERE room_id = $1
       AND (text IS NULL OR text NOT LIKE '[방제목%')
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [roomId, limit, offset]
    );

    // UUID를 문자열로 변환 및 피드백 정보 포함
    const formattedHistory = historyResult.rows.map((msg) => ({
      _id: msg.id,
      id: msg.id,
      roomId: msg.room_id,
      userId: msg.user_id,
      role: msg.role,
      text: msg.text,
      model: msg.model,
      createdAt: msg.created_at,
      feedback: msg.feedback || null,
    }));

    return NextResponse.json({
      success: true,
      history: formattedHistory,
      roomInfo: {
        id: room.id,
        name: room.name,
        messageCount: room.message_count || 0,
      },
    });
  } catch (error) {
    console.error('채팅 히스토리 조회 실패:', error);
    return NextResponse.json(
      { error: '채팅 히스토리 조회 실패', details: error.message },
      { status: 500 }
    );
  }
}

// 채팅 메시지 저장
export const POST = withErrorHandler(async (request, { params }) => {
  const payload = verifyToken(request);
  if (!payload) {
    return createAuthError();
  }

  const { roomId } = await params;
  const body = await request.json();
  let { role, text, model } = body;

  // text가 객체나 배열인 경우 JSON 문자열로 변환
  if (text !== null && text !== undefined) {
    if (typeof text === 'object') {
      try {
        text = JSON.stringify(text, null, 2);
      } catch (e) {
        console.warn('[history POST] text 객체 직렬화 실패:', e);
        text = String(text);
      }
    } else {
      text = String(text);
    }
  } else {
    text = '';
  }

  // 메시지 검증
  const messageValidation = validateMessage({ role, text, model, roomId });
  if (!messageValidation.valid) {
    return createValidationError(messageValidation.error);
  }

  // 채팅방 조회
  const roomResult = await query(
    'SELECT id, user_id, name FROM chat_rooms WHERE id = $1',
    [roomId]
  );

  // 채팅방이 존재하지 않는 경우
  if (roomResult.rows.length === 0) {
    return NextResponse.json(
      {
        error: '채팅방을 Not found.',
        shouldLogout: false,
      },
      { status: 404 }
    );
  }

  const room = roomResult.rows[0];

  // 채팅방 소유자 확인 (이메일 기반 - 더 안전함)
  const ownerResult = await query(
    'SELECT id, email FROM users WHERE id = $1',
    [room.user_id]
  );

  if (ownerResult.rows.length === 0 || ownerResult.rows[0].email !== payload.email) {
    return NextResponse.json(
      {
        error: '채팅방에 접근할 Unauthorized.',
        shouldLogout: true,
        message: 'Authentication expired. Please log in again.',
      },
      { status: 403 }
    );
  }

  // 사용자 정보 조회 (관리자 로깅용)
  // 정규화: 이제 user_role만 조회 (나머지는 JOIN으로 조회)
  const userResult = await query(
    'SELECT id, role FROM users WHERE id = $1',
    [payload.sub]
  );
  const user = userResult.rows.length > 0 ? userResult.rows[0] : null;

  // 이중 저장 실행 (chatHistory + messages)
  const saveResult = await saveMessageDual({
    roomId: roomId,
    userId: payload.sub,
    role: role,
    text: text,
    model: model || null,
    userRole: user?.role || 'user',
    clientIP:
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      null,
  });

  // 채팅방 메시지 카운트 업데이트
  await updateRoomMessageCount(roomId);

  return createSuccessResponse({
    message: {
      roomId: roomId,
      userId: payload.sub,
      role: role,
      text: text,
      model: model || null,
      createdAt: new Date(),
      _id: saveResult.chatHistoryId,
      id: saveResult.chatHistoryId,
    },
  });
});
