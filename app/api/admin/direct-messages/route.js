import { NextResponse } from 'next/server';
import { verifyAdminWithResult } from '@/lib/auth';
import { query } from '@/lib/postgres';
import { createAuthError, createServerError } from '@/lib/errorHandler';

// 관리자가 보낸 쪽지 목록 조회
export async function GET(request) {
  const authResult = verifyAdminWithResult(request);
  if (!authResult.valid) {
    return createAuthError(authResult.error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const search = searchParams.get('search') || '';
    const recipient = searchParams.get('recipient') || '';
    const isRead = searchParams.get('isRead') || '';
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 100);

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // 관리자가 보낸 쪽지만 조회
    whereConditions.push(`dm.sender_id = $${paramIndex}`);
    params.push(authResult.user.sub);
    paramIndex++;

    if (search) {
      whereConditions.push(`(dm.title ILIKE $${paramIndex} OR dm.content ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (recipient) {
      whereConditions.push(`(r.name ILIKE $${paramIndex} OR r.email ILIKE $${paramIndex})`);
      params.push(`%${recipient}%`);
      paramIndex++;
    }

    if (isRead === 'true') {
      whereConditions.push('dm.is_read = true');
    } else if (isRead === 'false') {
      whereConditions.push('dm.is_read = false');
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // 총 개수 조회
    const countResult = await query(
      `SELECT COUNT(*) as count
       FROM direct_messages dm
       LEFT JOIN users r ON dm.recipient_id = r.id
       ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    // 쪽지 목록 조회
    const offset = (page - 1) * limit;
    const messagesResult = await query(
      `SELECT
        dm.id, dm.title, dm.content, dm.is_read, dm.read_at,
        dm.deleted_by_recipient, dm.created_at, dm.updated_at,
        r.id as recipient_id, r.name as recipient_name,
        r.email as recipient_email, r.department as recipient_department
       FROM direct_messages dm
       LEFT JOIN users r ON dm.recipient_id = r.id
       ${whereClause}
       ORDER BY dm.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const formattedMessages = messagesResult.rows.map((msg) => ({
      _id: msg.id,
      id: msg.id,
      title: msg.title,
      content: msg.content,
      isRead: msg.is_read,
      readAt: msg.read_at,
      deletedByRecipient: msg.deleted_by_recipient,
      createdAt: msg.created_at,
      updatedAt: msg.updated_at,
      recipient: {
        id: msg.recipient_id,
        name: msg.recipient_name,
        email: msg.recipient_email,
        department: msg.recipient_department,
      },
    }));

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
      },
    });
  } catch (error) {
    console.error('쪽지 목록 조회 실패:', error);
    return createServerError(error, '쪽지 목록 조회 실패');
  }
}

// 쪽지 보내기 (단일/다중/부서별/전체)
export async function POST(request) {
  const authResult = verifyAdminWithResult(request);
  if (!authResult.valid) {
    return createAuthError(authResult.error);
  }

  try {
    const body = await request.json();
    const { title, content, recipientType, recipientIds, department } = body;

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: '제목과 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!recipientType || !['single', 'multiple', 'department', 'all'].includes(recipientType)) {
      return NextResponse.json(
        { success: false, error: '유효한 발송 대상 유형이 필요합니다.' },
        { status: 400 }
      );
    }

    let targetUserIds = [];

    if (recipientType === 'single' || recipientType === 'multiple') {
      if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
        return NextResponse.json(
          { success: false, error: '수신자를 선택해주세요.' },
          { status: 400 }
        );
      }
      targetUserIds = recipientIds;
    } else if (recipientType === 'department') {
      if (!department) {
        return NextResponse.json(
          { success: false, error: '부서를 선택해주세요.' },
          { status: 400 }
        );
      }
      const usersResult = await query(
        'SELECT id FROM users WHERE department = $1',
        [department]
      );
      targetUserIds = usersResult.rows.map(row => row.id);
    } else if (recipientType === 'all') {
      const usersResult = await query('SELECT id FROM users');
      targetUserIds = usersResult.rows.map(row => row.id);
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '수신자가 없습니다.' },
        { status: 400 }
      );
    }

    // 쪽지 일괄 생성
    const senderId = authResult.user.sub;
    const values = targetUserIds.map((recipientId, index) => {
      const baseIndex = index * 4;
      return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`;
    }).join(', ');

    const params = targetUserIds.flatMap(recipientId => [
      senderId, recipientId, title, content
    ]);

    await query(
      `INSERT INTO direct_messages (sender_id, recipient_id, title, content)
       VALUES ${values}`,
      params
    );

    return NextResponse.json({
      success: true,
      message: `${targetUserIds.length}명에게 쪽지를 보냈습니다.`,
      count: targetUserIds.length,
    });
  } catch (error) {
    console.error('쪽지 보내기 실패:', error);
    return createServerError(error, '쪽지 보내기 실패');
  }
}
