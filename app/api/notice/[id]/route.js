import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyToken } from '@/lib/auth';
import { isValidUUID } from '@/lib/utils';

async function ensureNoticeColumns() {
  const result = await query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'notices'
  `);
  const columns = new Set(result.rows.map((row) => row.column_name));
  if (!columns.has('is_popup_login')) {
    await query(
      'ALTER TABLE notices ADD COLUMN IF NOT EXISTS is_popup_login BOOLEAN DEFAULT false'
    );
  }
  if (!columns.has('popup_width')) {
    await query(
      'ALTER TABLE notices ADD COLUMN IF NOT EXISTS popup_width INTEGER DEFAULT NULL'
    );
  }
  if (!columns.has('popup_height')) {
    await query(
      'ALTER TABLE notices ADD COLUMN IF NOT EXISTS popup_height INTEGER DEFAULT NULL'
    );
  }
  if (!columns.has('views')) {
    await query(
      'ALTER TABLE notices ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0'
    );
  }
}

// 공지사항 상세 조회
export async function GET(request, { params }) {
  try {
    await ensureNoticeColumns();
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    // 조회수 증가 및 공지사항 조회
    const noticeResult = await query(
      `UPDATE notices
       SET views = COALESCE(views, 0) + 1
       WHERE id = $1
       RETURNING id, title, content, is_popup, is_popup_login, is_active, author_id, author_name,
                 created_at, updated_at, popup_width, popup_height, views`,
      [id]
    );

    if (noticeResult.rows.length === 0) {
      return NextResponse.json(
        { error: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const row = noticeResult.rows[0];
    const notice = {
      _id: row.id,
      id: row.id,
      title: row.title,
      content: row.content,
      isPopup: row.is_popup,
      isPopupLogin: row.is_popup_login,
      isActive: row.is_active,
      authorId: row.author_id,
      authorName: row.author_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      popupWidth: row.popup_width,
      popupHeight: row.popup_height,
      views: row.views ?? 0,
    };

    return NextResponse.json({ notice });
  } catch (error) {
    console.error('공지사항 상세 조회 실패:', error);
    return NextResponse.json(
      { error: '공지사항을 불러오는데 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

// 공지사항 수정 (관리자만)
export async function PUT(request, { params }) {
  try {
    await ensureNoticeColumns();
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    // 토큰 검증
    const payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (payload.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { title, content, isPopup, isPopupLogin, isActive, popupWidth, popupHeight } =
      await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 공지사항 수정
    const result = await query(
      `UPDATE notices
       SET title = $1, content = $2, is_popup = $3, is_popup_login = $4, is_active = $5,
           popup_width = $6, popup_height = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [title, content, !!isPopup, !!isPopupLogin, !!isActive, popupWidth || null, popupHeight || null, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('공지사항 수정 실패:', error);
    return NextResponse.json(
      { error: '공지사항 수정에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

// 공지사항 삭제 (관리자만)
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    // 토큰 검증
    const payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (payload.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 공지사항 삭제
    const result = await query(
      'DELETE FROM notices WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('공지사항 삭제 실패:', error);
    return NextResponse.json(
      { error: '공지사항 삭제에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
