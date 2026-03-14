import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { createServerError } from '@/lib/errorHandler';

export async function GET(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const userId = authResult.user?.id || authResult.user?.sub || authResult.user?.userId;
    const result = await query(
      `SELECT default_model_id FROM user_settings WHERE user_id = $1 LIMIT 1`,
      [userId]
    ).catch(() => ({ rows: [] }));

    return NextResponse.json({
      defaultModelId: result.rows[0]?.default_model_id || '',
    });
  } catch (error) {
    console.error('[GET /api/user/settings] error:', error);
    return createServerError(error);
  }
}

export async function POST(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const userId = authResult.user?.id || authResult.user?.sub || authResult.user?.userId;
    const body = await request.json();
    const defaultModelId = String(body?.defaultModelId || '').trim();

    await query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        default_model_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    await query(`
      INSERT INTO user_settings (user_id, default_model_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET default_model_id = $2, updated_at = CURRENT_TIMESTAMP
    `, [userId, defaultModelId || null]);

    return NextResponse.json({
      message: 'Default model has been set.',
      defaultModelId,
    });
  } catch (error) {
    console.error('[POST /api/user/settings] error:', error);
    return createServerError(error);
  }
}
