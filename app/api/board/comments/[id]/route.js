import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import {
  createAuthError,
  createValidationError,
  createServerError,
} from '@/lib/errorHandler';

async function isBoardEnabled() {
  const result = await query(
    'SELECT board_enabled FROM settings WHERE config_type = $1 LIMIT 1',
    ['general']
  );
  return result.rows[0]?.board_enabled !== false;
}

export async function DELETE(request, { params }) {
  try {
    const auth = verifyTokenWithResult(request);
    if (!auth.valid) {
      return createAuthError(auth.error);
    }

    if (!(await isBoardEnabled())) {
      return NextResponse.json(
        { error: '자유게시판이 비활성화되어 있습니다.' },
        { status: 403 }
      );
    }

    const commentId = Number(params.id);
    if (!Number.isFinite(commentId)) {
      return NextResponse.json(
        { error: '유효하지 않은 댓글 ID입니다.' },
        { status: 400 }
      );
    }

    const commentResult = await query(
      'SELECT user_id FROM board_comments WHERE id = $1',
      [commentId]
    );
    if (commentResult.rows.length === 0) {
      return NextResponse.json(
        { error: '댓글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const userId = auth.user?.sub || auth.user?.id;
    const isAdmin = auth.user?.role === 'admin';
    if (!isAdmin && commentResult.rows[0].user_id !== userId) {
      return NextResponse.json(
        { error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    await query('DELETE FROM board_comments WHERE id = $1', [commentId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('댓글 삭제 실패:', error);
    return createServerError(error, '댓글 삭제에 실패했습니다.');
  }
}

export async function PUT(request, { params }) {
  try {
    const auth = verifyTokenWithResult(request);
    if (!auth.valid) {
      return createAuthError(auth.error);
    }

    if (!(await isBoardEnabled())) {
      return NextResponse.json(
        { error: '자유게시판이 비활성화되어 있습니다.' },
        { status: 403 }
      );
    }

    const commentId = Number(params.id);
    if (!Number.isFinite(commentId)) {
      return createValidationError('유효하지 않은 댓글 ID입니다.');
    }

    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content || content.length > 2000) {
      return createValidationError('댓글은 1~2,000자 사이여야 합니다.');
    }

    const commentResult = await query(
      'SELECT user_id FROM board_comments WHERE id = $1',
      [commentId]
    );
    if (commentResult.rows.length === 0) {
      return NextResponse.json(
        { error: '댓글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const userId = auth.user?.sub || auth.user?.id;
    const isAdmin = auth.user?.role === 'admin';
    if (!isAdmin && commentResult.rows[0].user_id !== userId) {
      return NextResponse.json(
        { error: '수정 권한이 없습니다.' },
        { status: 403 }
      );
    }

    await query(
      `
      UPDATE board_comments
      SET content = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [content, commentId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('댓글 수정 실패:', error);
    return createServerError(error, '댓글 수정에 실패했습니다.');
  }
}
