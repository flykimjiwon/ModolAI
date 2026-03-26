import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import {
  verifyAdminWithResult,
  verifyAdminOrManagerWithResult,
} from '@/lib/auth';
import { createServerError } from '@/lib/errorHandler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function ensureMenusTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS site_menus (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      parent_id UUID REFERENCES site_menus(id) ON DELETE CASCADE,
      depth INTEGER DEFAULT 1,
      label VARCHAR(100) NOT NULL,
      description VARCHAR(500),
      link VARCHAR(500),
      link_target VARCHAR(10) DEFAULT '_self',
      display_order INTEGER DEFAULT 0,
      is_visible BOOLEAN DEFAULT true,
      icon VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function seedDefaultMenus() {
  const countResult = await query('SELECT COUNT(*) FROM site_menus');
  if (parseInt(countResult.rows[0].count) > 0) return;

  // Insert 1뎁스 menus first
  await query(
    `INSERT INTO site_menus (depth, label, link, display_order, is_visible)
     VALUES (1, '채팅', '/', 1, true)`
  );
  await query(
    `INSERT INTO site_menus (depth, label, link, display_order, is_visible)
     VALUES (1, 'AICR', '/aicr', 2, true)`
  );
  const busiSupport = await query(
    `INSERT INTO site_menus (depth, label, link, display_order, is_visible)
     VALUES (1, '업무 지원', NULL, 3, true) RETURNING id`
  );
  const devTools = await query(
    `INSERT INTO site_menus (depth, label, link, display_order, is_visible)
     VALUES (1, '개발 도구', NULL, 4, true) RETURNING id`
  );
  await query(
    `INSERT INTO site_menus (depth, label, link, display_order, is_visible)
     VALUES (1, '부서 에이전트', NULL, 5, false) RETURNING id`
  );
  await query(
    `INSERT INTO site_menus (depth, label, link, display_order, is_visible)
     VALUES (1, '실험실', NULL, 6, false) RETURNING id`
  );

  const busiId = busiSupport.rows[0].id;
  const devId = devTools.rows[0].id;

  // 업무 지원 children — parameterized queries (Rule 6)
  await query(
    `INSERT INTO site_menus (parent_id, depth, label, link, display_order, is_visible) VALUES
    ($1, 2, 'AI 가상회의', '/agent/1', 1, true),
    ($1, 2, '텍스트 재작성', '/agent/4', 2, true),
    ($1, 2, '지식노트 (실험실)', '/agent/8', 3, true),
    ($1, 2, '글쓰기 평가 (실험실)', '/agent/9', 4, true),
    ($1, 2, '슬라이드 메이커 (실험실)', '/agent/7', 5, true)`,
    [busiId]
  );

  // 개발 도구 children — parameterized queries (Rule 6)
  await query(
    `INSERT INTO site_menus (parent_id, depth, label, link, display_order, is_visible) VALUES
    ($1, 2, '코드 컨버터', '/agent/2', 1, true),
    ($1, 2, 'Text to SQL', '/agent/3', 2, true),
    ($1, 2, '에러 해결 도우미', '/agent/5', 3, true),
    ($1, 2, 'GitSop 리뷰어', '/agent/6', 4, true)`,
    [devId]
  );
}

// GET: 전체 메뉴 목록 (관리자/매니저용, 숨김 포함)
export async function GET(request) {
  try {
    const authResult = await verifyAdminOrManagerWithResult(request);
    if (!authResult.valid) {
      const status = authResult.error?.includes('관리자') ? 403 : 401;
      return NextResponse.json({ error: authResult.error }, { status });
    }

    await ensureMenusTable();
    await seedDefaultMenus();

    const result = await query(`
      SELECT * FROM site_menus
      ORDER BY depth ASC, display_order ASC, created_at ASC
    `);

    return NextResponse.json({ menus: result.rows });
  } catch (error) {
    return createServerError(error);
  }
}

// POST: 메뉴 생성
export async function POST(request) {
  try {
    const authResult = await verifyAdminWithResult(request);
    if (!authResult.valid) {
      const status = authResult.error?.includes('관리자') ? 403 : 401;
      return NextResponse.json({ error: authResult.error }, { status });
    }

    await ensureMenusTable();

    const body = await request.json();
    const {
      label,
      description,
      link,
      linkTarget = '_self',
      parentId,
      displayOrder = 0,
      isVisible = true,
      icon,
    } = body;

    if (!label || label.trim() === '') {
      return NextResponse.json({ error: '메뉴 이름은 필수입니다.' }, { status: 400 });
    }

    // depth 계산
    let depth = 1;
    if (parentId) {
      const parentResult = await query('SELECT depth FROM site_menus WHERE id = $1', [parentId]);
      if (parentResult.rows.length === 0) {
        return NextResponse.json({ error: '상위 메뉴를 찾을 수 없습니다.' }, { status: 404 });
      }
      depth = parentResult.rows[0].depth + 1;
    }

    const result = await query(
      `INSERT INTO site_menus
        (parent_id, depth, label, description, link, link_target, display_order, is_visible, icon)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        parentId || null,
        depth,
        label.trim(),
        description || null,
        link || null,
        linkTarget,
        displayOrder,
        isVisible,
        icon || null,
      ]
    );

    return NextResponse.json({ menu: result.rows[0] }, { status: 201 });
  } catch (error) {
    return createServerError(error);
  }
}

// PUT: 메뉴 수정
export async function PUT(request) {
  try {
    const authResult = await verifyAdminWithResult(request);
    if (!authResult.valid) {
      const status = authResult.error?.includes('관리자') ? 403 : 401;
      return NextResponse.json({ error: authResult.error }, { status });
    }

    await ensureMenusTable();

    const body = await request.json();
    const {
      id,
      label,
      description,
      link,
      linkTarget = '_self',
      parentId,
      displayOrder = 0,
      isVisible = true,
      icon,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'id는 필수입니다.' }, { status: 400 });
    }
    if (!label || label.trim() === '') {
      return NextResponse.json({ error: '메뉴 이름은 필수입니다.' }, { status: 400 });
    }

    // depth 계산
    let depth = 1;
    if (parentId) {
      const parentResult = await query('SELECT depth FROM site_menus WHERE id = $1', [parentId]);
      if (parentResult.rows.length === 0) {
        return NextResponse.json({ error: '상위 메뉴를 찾을 수 없습니다.' }, { status: 404 });
      }
      depth = parentResult.rows[0].depth + 1;
    }

    const result = await query(
      `UPDATE site_menus
       SET parent_id = $1, depth = $2, label = $3, description = $4, link = $5,
           link_target = $6, display_order = $7, is_visible = $8, icon = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        parentId || null,
        depth,
        label.trim(),
        description || null,
        link || null,
        linkTarget,
        displayOrder,
        isVisible,
        icon || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: '메뉴를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ menu: result.rows[0] });
  } catch (error) {
    return createServerError(error);
  }
}

// DELETE: 메뉴 삭제
export async function DELETE(request) {
  try {
    const authResult = await verifyAdminWithResult(request);
    if (!authResult.valid) {
      const status = authResult.error?.includes('관리자') ? 403 : 401;
      return NextResponse.json({ error: authResult.error }, { status });
    }

    await ensureMenusTable();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id는 필수입니다.' }, { status: 400 });
    }

    const result = await query('DELETE FROM site_menus WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: '메뉴를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return createServerError(error);
  }
}
