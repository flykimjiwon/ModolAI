import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/postgres';

// 사용자의 채팅방 목록 조회
export async function GET(request) {
  try {
    const payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
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

    // 사용자의 채팅방 목록 조회 (최근 수정일 순)
    const roomsResult = await query(
      `SELECT id, user_id, name, message_count, created_at, updated_at 
       FROM chat_rooms 
       WHERE user_id = $1 
       ORDER BY updated_at DESC`,
      [userId]
    );

    // PostgreSQL 결과를 변환
    const formattedRooms = roomsResult.rows.map((room) => ({
      _id: room.id,
      userId: room.user_id,
      name: room.name,
      messageCount: room.message_count,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
    }));

    return NextResponse.json({
      success: true,
      rooms: formattedRooms,
    });
  } catch (error) {
    console.error('채팅방 목록 조회 실패:', error);
    return NextResponse.json(
      { error: '채팅방 목록 조회 실패', details: error.message },
      { status: 500 }
    );
  }
}

// 새 채팅방 생성
export async function POST(request) {
  try {
    const payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

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

    // 사용자의 채팅방 개수 확인 (최대 20개)
    const roomCountResult = await query(
      'SELECT COUNT(*) as count FROM chat_rooms WHERE user_id = $1',
      [userId]
    );
    const roomCount = parseInt(roomCountResult.rows[0].count);
    
    if (roomCount >= 20) {
      return NextResponse.json(
        { error: '최대 20개의 채팅방만 생성할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 새 채팅방 생성
    const newRoomResult = await query(
      `INSERT INTO chat_rooms (user_id, name, message_count, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, user_id, name, message_count, created_at, updated_at`,
      [userId, name.trim(), 0]
    );

    const newRoom = newRoomResult.rows[0];

    return NextResponse.json({
      success: true,
      room: {
        _id: newRoom.id,
        userId: newRoom.user_id,
        name: newRoom.name,
        messageCount: newRoom.message_count,
        createdAt: newRoom.created_at,
        updatedAt: newRoom.updated_at,
      },
    });
  } catch (error) {
    console.error('채팅방 생성 실패:', error);
    return NextResponse.json(
      { error: '채팅방 생성 실패', details: error.message },
      { status: 500 }
    );
  }
}
