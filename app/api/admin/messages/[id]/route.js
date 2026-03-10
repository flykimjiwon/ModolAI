import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { query } from '@/lib/postgres';
import { isValidUUID } from '@/lib/utils';

export async function DELETE(request, { params }) {
  // 관리자 권한 확인
  const authResult = verifyAdmin(request);
  if (!authResult.success) {
    return authResult;
  }

  try {
    const { id } = await params;

    // UUID 검증
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: '유효하지 않은 메시지 ID입니다.' },
        { status: 400 }
      );
    }

    // 메시지 존재 여부 확인
    const checkResult = await query(
      'SELECT id FROM messages WHERE id = $1 LIMIT 1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: '메시지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 메시지 삭제
    const result = await query(
      'DELETE FROM messages WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: '메시지 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '메시지가 성공적으로 삭제되었습니다.',
    });
  } catch (error) {
    console.error('메시지 삭제 실패:', error);
    return NextResponse.json(
      { error: '메시지 삭제 실패', details: error.message },
      { status: 500 }
    );
  }
}
