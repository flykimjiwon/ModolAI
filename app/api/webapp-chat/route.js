import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyToken, updateLastActive } from '@/lib/auth';
import { verifyAdmin } from '@/lib/adminAuth';

// soft delete 컬럼 확인 및 추가
let softDeleteColumnsChecked = false;

async function ensureSoftDeleteColumns() {
  if (softDeleteColumnsChecked) return;

  try {
    // is_deleted 컬럼이 있는지 확인
    const checkColumn = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'is_deleted'
    `);

    if (checkColumn.rows.length === 0) {
      console.log('⚠️ messages 테이블에 soft delete 컬럼 추가 중...');
      
      // is_deleted 컬럼 추가
      await query(`
        ALTER TABLE messages 
        ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false
      `);

      // deleted_at 컬럼 추가
      await query(`
        ALTER TABLE messages 
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
      `);

      // deleted_by 컬럼 추가
      await query(`
        ALTER TABLE messages 
        ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL
      `);

      // 인덱스 추가
      await query(`
        CREATE INDEX IF NOT EXISTS idx_messages_is_deleted 
        ON messages(is_deleted) 
        WHERE is_deleted = false
      `);

      console.log('✅ soft delete 컬럼 추가 완료');
    }

    softDeleteColumnsChecked = true;
  } catch (error) {
    console.error('soft delete 컬럼 확인/추가 실패:', error);
    // 에러가 발생해도 계속 진행 (기존 로직 유지)
  }
}

// GET: 채팅 메시지 목록 조회 (페이지네이션 지원)
export async function GET(request) {
  try {
    const userPayload = verifyToken(request);
    if (!userPayload) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }
    updateLastActive(userPayload.sub || userPayload.id);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const before = searchParams.get('before'); // 이전 메시지 로드를 위한 기준점 (ISO 날짜 문자열)
    const since = searchParams.get('since'); // 최신 이후 메시지 로드용 (ISO 날짜 문자열)

    // soft delete 컬럼이 있는지 확인하고 없으면 추가
    await ensureSoftDeleteColumns();

    // 채팅 위젯 메시지만 조회 (room_id가 NULL인 것만)
    // 일반 채팅방(chat_rooms에 연결된) 메시지는 제외
    let sql = '';
    const params = [];
    let paramIndex = 1;

    if (since) {
      const sinceDate = new Date(since);
      if (Number.isNaN(sinceDate.getTime())) {
        return NextResponse.json(
          { error: 'since 파라미터 형식이 올바르지 않습니다.' },
          { status: 400 }
        );
      }

      sql = `
        SELECT
          m.*,
          COALESCE(u.name, '') as user_name,
          COALESCE(u.email, '') as user_email
        FROM messages m
        LEFT JOIN users u ON m.user_id = u.id
        WHERE (m.is_deleted IS NULL OR m.is_deleted = false)
          AND m.room_id IS NULL
          AND m.created_at > $${paramIndex}
        ORDER BY m.created_at ASC
        LIMIT $${paramIndex + 1}
      `;
      params.push(sinceDate, limit);
    } else {
      sql = `
        SELECT
          m.*,
          COALESCE(u.name, '') as user_name,
          COALESCE(u.email, '') as user_email
        FROM messages m
        LEFT JOIN users u ON m.user_id = u.id
        WHERE (m.is_deleted IS NULL OR m.is_deleted = false)
          AND m.room_id IS NULL
      `;
      if (before) {
        sql += ` AND m.created_at < $${paramIndex}`;
        params.push(new Date(before));
        paramIndex++;
      }
      sql += ` ORDER BY m.created_at DESC LIMIT $${paramIndex}`;
      params.push(limit);
    }

    const result = await query(sql, params);

    if (since && result.rows.length === 0) {
      return new NextResponse(null, { status: 204 });
    }

    // 결과를 camelCase로 변환하고 _id 추가
    const messages = result.rows.map((row) => {
      const camelRow = {
        _id: row.id,
        userId: row.user_id,
        email: row.user_email || row.email,
        name: row.user_name || row.name,
        role: row.role,
        text: row.text,
        roomId: row.room_id,
        createdAt: row.created_at,
      };
      return camelRow;
    });

    // DB에서는 최신순으로 가져왔지만, 클라이언트에서는 시간순으로 보여주기 위해 배열을 뒤집음
    const reversedMessages = since ? messages : messages.reverse();

    return NextResponse.json(reversedMessages);
  } catch (error) {
    console.error('[/api/chat GET] 에러:', error);
    return NextResponse.json(
      {
        error: '메시지를 가져오는 중 오류가 발생했습니다.',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// POST: 새 채팅 메시지 저장
export async function POST(request) {
  try {
    // 인증 토큰 검증
    const userPayload = verifyToken(request);
    if (!userPayload) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }
    updateLastActive(userPayload.sub || userPayload.id);

    const { text, roomId } = await request.json();

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json(
        { error: '메시지 내용이 비어있습니다.' },
        { status: 400 }
      );
    }

    // 사용자 정보 조회 (user_role 정보를 위해)
    const userResult = await query(
      'SELECT role as user_role FROM users WHERE email = $1 LIMIT 1',
      [userPayload.email]
    );
    const user = userResult.rows[0] || null;

    // messages 테이블에 직접 저장
    // 채팅 위젯 메시지는 항상 room_id를 NULL로 저장 (일반 채팅방과 구분)
    // 'general' 같은 특수 룸도 NULL로 처리
    // 정규화: email, name, department, cell 제거 (users 테이블에서 JOIN으로 조회)
    const finalRoomId = null;
    
    const insertResult = await query(
      `INSERT INTO messages (user_id, role, user_role, text, room_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userPayload.sub,
        'user',
        user?.user_role || 'user',
        text.trim(),
        finalRoomId,
        new Date(),
      ]
    );

    const row = insertResult.rows[0];
    const newMessage = {
      _id: row.id,
      userId: row.user_id,
      role: row.role,
      userRole: row.user_role,
      text: row.text,
      roomId: row.room_id,
      createdAt: row.created_at,
    };

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error('[/api/chat POST] 에러:', error);
    return NextResponse.json(
      { error: '메시지 저장 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: 채팅 위젯 메시지 이력 미노출 처리 (관리자 전용)
// 실제로 삭제하지 않고 is_deleted를 true로 설정 (soft delete)
export async function DELETE(request) {
  try {
    // 관리자 권한 확인
    const adminCheck = verifyAdmin(request);
    if (!adminCheck.success) {
      return adminCheck;
    }

    // soft delete 컬럼 확인 및 추가
    await ensureSoftDeleteColumns();

    // messages 테이블에서 채팅 위젯 메시지를 soft delete
    // room_id가 NULL인 메시지만 미노출 처리 (채팅 위젯 전용)
    // 일반 채팅방(chat_rooms에 연결된) 메시지는 제외
    const updateResult = await query(
      `UPDATE messages 
       SET is_deleted = true, 
           deleted_at = NOW(), 
           deleted_by = $1
       WHERE (is_deleted IS NULL OR is_deleted = false)
         AND room_id IS NULL
       RETURNING id`,
      [adminCheck.user.id]
    );

    const hiddenCount = updateResult.rowCount || 0;

    return NextResponse.json({
      success: true,
      message: `${hiddenCount}개의 채팅 위젯 메시지가 미노출 처리되었습니다.`,
      hiddenCount,
    });
  } catch (error) {
    console.error('[/api/chat DELETE] 에러:', error);
    return NextResponse.json(
      { error: '메시지 미노출 처리 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
