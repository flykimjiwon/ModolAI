import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyToken } from '@/lib/auth';

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

// 공지사항 목록 조회
export async function GET(request) {
  try {
    await ensureNoticeColumns();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const showPopup = searchParams.get('showPopup'); // 팝업용 공지사항만 조회
    const popupTarget = searchParams.get('popupTarget') || 'main';

    const skip = (page - 1) * limit;

    // 쿼리 조건 구성
    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (showPopup === 'true') {
      if (popupTarget === 'login') {
        whereClause = 'WHERE is_popup_login = $1 AND is_active = $2';
      } else if (popupTarget === 'any') {
        whereClause =
          'WHERE (is_popup = $1 OR is_popup_login = $2) AND is_active = $3';
        params.push(true, true, true);
        paramIndex = 4;
      } else {
        whereClause = 'WHERE is_popup = $1 AND is_active = $2';
      }
      if (popupTarget !== 'any') {
        params.push(true, true);
        paramIndex = 3;
      }
    }
    // 일반 목록 조회시에는 활성화 여부와 관계없이 모든 공지사항 표시 (관리자가 비활성화된 것도 관리할 수 있도록)

    // 공지사항 조회 (최신순)
    const noticesResult = await query(
      `SELECT id, title, content, is_popup, is_popup_login, is_active, author_id, author_name,
              created_at, updated_at, popup_width, popup_height, views
       FROM notices
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, skip]
    );

    // 전체 개수 조회
    const countResult = await query(
      `SELECT COUNT(*) as total FROM notices ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);

    // 데이터 변환 (snake_case를 camelCase로)
    const notices = noticesResult.rows.map(row => ({
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
    }));

    if (showPopup === 'true' && notices.length > 0) {
      const noticeIds = notices.map((notice) => notice.id);
      await query(
        `UPDATE notices
         SET views = COALESCE(views, 0) + 1
         WHERE id = ANY($1::uuid[])`,
        [noticeIds]
      );
      notices.forEach((notice) => {
        notice.views = (notice.views ?? 0) + 1;
      });
    }

    return NextResponse.json({
      notices,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error('공지사항 조회 실패:', error);
    return NextResponse.json(
      { error: '공지사항을 불러오는데 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

// 공지사항 작성 (관리자만)
export async function POST(request) {
  try {
    await ensureNoticeColumns();
    // 토큰 검증
    const payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (payload.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin privileges required.' },
        { status: 403 }
      );
    }

    const {
      title,
      content,
      isPopup = false,
      isPopupLogin = false,
      isActive = true,
      popupWidth = null,
      popupHeight = null,
    } = await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 사용자 정보 조회
    const userResult = await query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [payload.email]
    );

    const userId = userResult.rows.length > 0 ? userResult.rows[0].id : null;
    const authorName = userResult.rows.length > 0 
      ? (userResult.rows[0].name || userResult.rows[0].email)
      : (payload.name || payload.email);

    // 공지사항 삽입
    const result = await query(
      `INSERT INTO notices (title, content, is_popup, is_popup_login, is_active, author_id, author_name, popup_width, popup_height, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [title, content, isPopup, isPopupLogin, isActive, userId, authorName, popupWidth, popupHeight]
    );

    return NextResponse.json(
      {
        success: true,
        noticeId: result.rows[0].id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('공지사항 작성 실패:', error);
    return NextResponse.json(
      { error: '공지사항 작성에 실패했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
