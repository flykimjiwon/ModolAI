import { NextResponse } from 'next/server';
import { verifyAdminWithResult } from '@/lib/auth';
import { query } from '@/lib/postgres';
import { createAuthError, createServerError } from '@/lib/errorHandler';

// 관리자가 보낸 쪽지 삭제
export async function DELETE(request, { params }) {
  const authResult = verifyAdminWithResult(request);
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

    // 관리자가 보낸 쪽지인지 확인 후 삭제
    const result = await query(
      `DELETE FROM direct_messages
       WHERE id = $1 AND sender_id = $2
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
