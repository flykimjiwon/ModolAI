import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';

const MAX_PERSONAS_PER_USER = 20;

let tableChecked = false;
async function ensureTable() {
  if (tableChecked) return;
  await query(`
    CREATE TABLE IF NOT EXISTS user_meeting_personas (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(100) NOT NULL,
      instructions TEXT DEFAULT '',
      model_id VARCHAR(255) DEFAULT '',
      emoji VARCHAR(10) DEFAULT '👤',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_user_meeting_personas_user ON user_meeting_personas(user_id)`);
  tableChecked = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: Return all personas for authenticated user
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  const userId = authResult.user?.sub || authResult.user?.id || '';
  if (!userId) {
    return NextResponse.json({ error: 'Unable to verify user information' }, { status: 401 });
  }

  try {
    await ensureTable();
    const result = await query(
      `SELECT id, name, role, instructions, model_id, emoji, created_at, updated_at
       FROM user_meeting_personas
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );
    return NextResponse.json({ personas: result.rows });
  } catch (error) {
    console.error('[webapp-virtual-meeting/personas:GET] error:', error);
    return NextResponse.json({ error: 'Failed to load personas' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: Create a new custom persona
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  const userId = authResult.user?.sub || authResult.user?.id || '';
  if (!userId) {
    return NextResponse.json({ error: 'Unable to verify user information' }, { status: 401 });
  }

  try {
    await ensureTable();
    const body = await request.json();
    const { name, role, instructions = '', modelId, model_id: modelIdAlt, emoji = '👤' } = body;
    const model_id = modelId || modelIdAlt || '';

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Persona name is required' }, { status: 400 });
    }
    if (!role || typeof role !== 'string' || !role.trim()) {
      return NextResponse.json({ error: 'Persona role is required' }, { status: 400 });
    }

    const countResult = await query(
      `SELECT COUNT(*) AS cnt FROM user_meeting_personas WHERE user_id = $1`,
      [userId]
    );
    const currentCount = parseInt(countResult.rows[0]?.cnt || '0', 10);
    if (currentCount >= MAX_PERSONAS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PERSONAS_PER_USER} personas allowed per user` },
        { status: 400 }
      );
    }

    const insertResult = await query(
      `INSERT INTO user_meeting_personas (user_id, name, role, instructions, model_id, emoji)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, role, instructions, model_id, emoji, created_at, updated_at`,
      [userId, name.trim(), role.trim(), instructions, model_id, emoji]
    );

    return NextResponse.json({ persona: insertResult.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('[webapp-virtual-meeting/personas:POST] error:', error);
    return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT: Update custom persona (owner only)
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  const userId = authResult.user?.sub || authResult.user?.id || '';
  if (!userId) {
    return NextResponse.json({ error: 'Unable to verify user information' }, { status: 401 });
  }

  try {
    await ensureTable();
    const body = await request.json();
    const { id, name, role, instructions = '', modelId, model_id: modelIdAlt, emoji = '👤' } = body;
    const model_id = modelId || modelIdAlt || '';

    if (!id) {
      return NextResponse.json({ error: 'Persona ID is required' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Persona name is required' }, { status: 400 });
    }
    if (!role || typeof role !== 'string' || !role.trim()) {
      return NextResponse.json({ error: 'Persona role is required' }, { status: 400 });
    }

    const result = await query(
      `UPDATE user_meeting_personas
       SET name = $1, role = $2, instructions = $3, model_id = $4, emoji = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND user_id = $7
       RETURNING id, name, role, instructions, model_id, emoji, created_at, updated_at`,
      [name.trim(), role.trim(), instructions, model_id, emoji, id, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Persona not found or permission denied' }, { status: 404 });
    }

    return NextResponse.json({ persona: result.rows[0] });
  } catch (error) {
    console.error('[webapp-virtual-meeting/personas:PUT] error:', error);
    return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE: Delete persona (owner only)
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  const userId = authResult.user?.sub || authResult.user?.id || '';
  if (!userId) {
    return NextResponse.json({ error: 'Unable to verify user information' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Persona ID is required' }, { status: 400 });
    }

    await ensureTable();
    const result = await query(
      `DELETE FROM user_meeting_personas WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Persona not found or permission denied' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Persona deleted', id: result.rows[0].id });
  } catch (error) {
    console.error('[webapp-virtual-meeting/personas:DELETE] error:', error);
    return NextResponse.json({ error: 'Failed to delete persona' }, { status: 500 });
  }
}
