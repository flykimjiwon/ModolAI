import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/postgres';
import { isValidUUID } from '@/lib/utils';

// 채팅방 정보 수정
export async function PATCH(request, { params }) {
  try {
    const payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: '채팅방 이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (name.trim().length > 50) {
      return NextResponse.json(
        { error: '채팅방 이름은 50자 이하로 입력해주세요.' },
        { status: 400 }
      );
    }

    // 사용자 ID 조회 (이메일 기반)
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [payload.email]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 }
      );
    }

    const userId = userResult.rows[0].id;

    // 채팅방 조회 및 소유자 확인
    const roomResult = await query(
      `SELECT cr.id, cr.user_id, cr.name, u.email 
       FROM chat_rooms cr
       JOIN users u ON cr.user_id = u.id
       WHERE cr.id = $1`,
      [id]
    );

    // 채팅방이 존재하지 않는 경우
    if (roomResult.rows.length === 0) {
      return NextResponse.json(
        { error: '채팅방을 Not found.' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];

    // 채팅방 소유자 확인 (이메일 기반)
    if (room.email !== payload.email) {
      return NextResponse.json(
        {
          error: '채팅방에 접근할 Unauthorized.',
          shouldLogout: true,
          message: 'Authentication expired. Please log in again.',
        },
        { status: 403 }
      );
    }

    // 채팅방 이름 수정
    const updateResult = await query(
      `UPDATE chat_rooms 
       SET name = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND user_id = $3
       RETURNING id`,
      [name.trim(), id, userId]
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { error: '채팅방 수정에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '채팅방 이름이 Updated.',
    });
  } catch (error) {
    console.error('채팅방 수정 실패:', error);
    return NextResponse.json(
      { error: '채팅방 수정 실패', details: error.message },
      { status: 500 }
    );
  }
}

// 채팅방 삭제
export async function DELETE(request, { params }) {
  let id = 'unknown';
  let payload = null;

  try {
    payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const paramsData = await params;
    id = paramsData.id;

    console.log('DELETE 요청 - Room ID:', id, 'User ID:', payload.sub);

    // ID 검사 및 UUID 유효성 검사
    if (!id) {
      console.error('ID가 비어있음');
      return NextResponse.json(
        { error: '방 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!isValidUUID(id)) {
      console.error('잘못된 UUID 형식:', id);
      return NextResponse.json(
        { error: `잘못된 방 ID 형식: ${id}` },
        { status: 400 }
      );
    }

    // 사용자 ID 조회 (이메일 기반)
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [payload.email]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 }
      );
    }

    const userId = userResult.rows[0].id;

    // 채팅방 조회 및 소유자 확인
    const roomResult = await query(
      `SELECT cr.id, cr.user_id, cr.name, u.email 
       FROM chat_rooms cr
       JOIN users u ON cr.user_id = u.id
       WHERE cr.id = $1`,
      [id]
    );

    console.log('찾은 방:', roomResult.rows.length > 0 ? '존재' : '없음');

    // 채팅방이 존재하지 않는 경우
    if (roomResult.rows.length === 0) {
      return NextResponse.json(
        { error: '채팅방을 Not found.' },
        { status: 404 }
      );
    }

    const room = roomResult.rows[0];

    // 채팅방 소유자 확인 (이메일 기반)
    if (room.email !== payload.email) {
      return NextResponse.json(
        {
          error: '채팅방에 접근할 Unauthorized.',
          shouldLogout: true,
          message: 'Authentication expired. Please log in again.',
        },
        { status: 403 }
      );
    }

    // PostgreSQL 트랜잭션으로 순차적 삭제
    try {
      console.log('채팅방 삭제 시작:', id);

      // 채팅 히스토리 삭제 (CASCADE로 자동 삭제되지만 명시적으로 삭제)
      const historyDeleteResult = await query(
        'DELETE FROM chat_history WHERE room_id = $1',
        [id]
      );
      console.log(
        '채팅 히스토리 삭제 완료:',
        historyDeleteResult.rowCount,
        '개'
      );

      // 3. 채팅방 삭제
      console.log('채팅방 삭제 시작:', id);
      const roomDeleteResult = await query(
        'DELETE FROM chat_rooms WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      console.log('채팅방 삭제 완료:', roomDeleteResult.rowCount, '개');

      if (roomDeleteResult.rowCount === 0) {
        console.warn('채팅방이 삭제되지 않음 - 이미 없거나 권한 없음');
      }
    } catch (transactionError) {
      console.error('삭제 과정 중 오류:', transactionError);
      throw transactionError;
    }

    return NextResponse.json({
      success: true,
      message: '채팅방이 Deleted.',
    });
  } catch (error) {
    console.error('채팅방 삭제 실패:', {
      error: error.message,
      stack: error.stack,
      roomId: id,
      userId: payload?.sub || 'unknown',
      type: error.constructor.name,
    });

    // 구체적인 오류 유형별 처리
    if (error.message.includes('UUID') || error.message.includes('invalid input syntax')) {
      return NextResponse.json(
        { error: '잘못된 방 ID 형식입니다.' },
        { status: 400 }
      );
    }

    if (
      error.message.includes('Authentication') ||
      error.message.includes('authorization')
    ) {
      return NextResponse.json({ error: '인증 실패' }, { status: 401 });
    }

    if (
      error.message.includes('PostgreSQL') ||
      error.message.includes('Connection') ||
      error.message.includes('ECONNREFUSED')
    ) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // 일반적인 Server error
    return NextResponse.json(
      {
        error: '채팅방 삭제 중 오류가 발생했습니다.',
        details:
          process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      },
      { status: 500 }
    );
  }
}
