import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/postgres';
import { isValidUUID } from '@/lib/utils';

// 메시지 피드백 저장/업데이트
export async function POST(request, { params }) {
  try {
    const payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { messageId } = await params;
    const body = await request.json();
    const { feedback } = body;

    // 피드백 값 검증
    if (feedback !== null && feedback !== 'like' && feedback !== 'dislike') {
      return NextResponse.json(
        { error: '유효하지 않은 피드백 값입니다.' },
        { status: 400 }
      );
    }

    // messageId 검증
    if (!messageId || !isValidUUID(messageId)) {
      return NextResponse.json(
        { error: '유효하지 않은 메시지 ID입니다.' },
        { status: 400 }
      );
    }

    // 메시지 조회 및 소유자 확인
    const messageResult = await query(
      'SELECT id, room_id, user_id, text, role, created_at FROM chat_history WHERE id = $1',
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      return NextResponse.json(
        { error: '메시지를 Not found.' },
        { status: 404 }
      );
    }

    const message = messageResult.rows[0];

    // 메시지 소유자 확인 (user_id로 확인)
    if (message.user_id !== payload.sub) {
      return NextResponse.json(
        { error: '이 메시지에 대한 Unauthorized.' },
        { status: 403 }
      );
    }

    // 피드백 업데이트 (null이면 NULL로 설정)
    if (feedback === null) {
      // 피드백 제거
      await query(
        'UPDATE chat_history SET feedback = NULL WHERE id = $1',
        [messageId]
      );

      // messages 테이블에도 동기화
      await query(
        `UPDATE messages 
         SET feedback = NULL 
         WHERE room_id = $1 AND text = $2 AND role = $3 AND created_at = $4`,
        [message.room_id, message.text, message.role, message.created_at]
      );
    } else {
      // 피드백 설정
      await query(
        'UPDATE chat_history SET feedback = $1 WHERE id = $2',
        [feedback, messageId]
      );

      // messages 테이블에도 동기화
      await query(
        `UPDATE messages 
         SET feedback = $1 
         WHERE room_id = $2 AND text = $3 AND role = $4 AND created_at = $5`,
        [feedback, message.room_id, message.text, message.role, message.created_at]
      );
    }

    return NextResponse.json({
      success: true,
      feedback: feedback,
    });
  } catch (error) {
    console.error('피드백 저장 실패:', error);
    return NextResponse.json(
      { error: '피드백 저장에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

