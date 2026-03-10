import { NextResponse } from 'next/server';
import { verifyTokenWithResult } from '@/lib/auth';
import { query } from '@/lib/postgres';
import { createAuthError, createServerError } from '@/lib/errorHandler';

// 쪽지 읽음 처리
export async function PATCH(request, { params }) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return createAuthError(authResult.error);
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '쪽지 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 수신자인 경우에만 읽음 처리
    const result = await query(
      `UPDATE direct_messages
       SET is_read = true, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND recipient_id = $2 AND is_read = false
       RETURNING id, is_read, read_at`,
      [id, authResult.user.sub]
    );

    if (result.rowCount === 0) {
      // 이미 읽은 경우 또는 권한이 없는 경우
      const existingResult = await query(
        'SELECT id, is_read FROM direct_messages WHERE id = $1 AND recipient_id = $2',
        [id, authResult.user.sub]
      );

      if (existingResult.rowCount === 0) {
        return NextResponse.json(
          { success: false, error: '쪽지를 찾을 수 없거나 권한이 없습니다.' },
          { status: 404 }
        );
      }

      // 이미 읽은 경우
      return NextResponse.json({
        success: true,
        message: '이미 읽은 쪽지입니다.',
        alreadyRead: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: '읽음 처리되었습니다.',
      readAt: result.rows[0].read_at,
    });
  } catch (error) {
    console.error('쪽지 읽음 처리 실패:', error);
    return createServerError(error, '쪽지 읽음 처리 실패');
  }
}

// 사용자가 받은 쪽지 삭제 (soft delete)
export async function DELETE(request, { params }) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return createAuthError(authResult.error);
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '쪽지 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 수신자인 경우에만 삭제 처리 (soft delete)
    const result = await query(
      `UPDATE direct_messages
       SET deleted_by_recipient = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND recipient_id = $2
       RETURNING id`,
      [id, authResult.user.sub]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '쪽지를 찾을 수 없거나 삭제 권한이 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '쪽지가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('쪽지 삭제 실패:', error);
    return createServerError(error, '쪽지 삭제 실패');
  }
}
