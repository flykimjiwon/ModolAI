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

export async function POST(request) {
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

    const body = await request.json();
    const postId = Number(body.postId);
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!Number.isFinite(postId)) {
      return createValidationError('유효하지 않은 게시글 ID입니다.');
    }

    if (!content || content.length > 2000) {
      return createValidationError('댓글은 1~2,000자 사이여야 합니다.');
    }

    const postExists = await query(
      'SELECT id FROM board_posts WHERE id = $1',
      [postId]
    );
    if (postExists.rows.length === 0) {
      return NextResponse.json(
        { error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const userId = auth.user?.sub || auth.user?.id;
    if (!userId) {
      return createAuthError('사용자 정보를 확인할 수 없습니다.');
    }

    const result = await query(
      `
      INSERT INTO board_comments (post_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, created_at
      `,
      [postId, userId, content]
    );

    return NextResponse.json({
      success: true,
      id: result.rows[0]?.id,
      createdAt: result.rows[0]?.created_at,
    });
  } catch (error) {
    console.error('댓글 작성 실패:', error);
    return createServerError(error, '댓글 작성에 실패했습니다.');
  }
}
