import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS agent_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_id VARCHAR(50) NOT NULL UNIQUE,
        is_visible BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    const result = await query(
      `SELECT agent_id, is_visible FROM agent_settings`
    );

    const visibilityMap = {};
    for (const row of result.rows) {
      visibilityMap[row.agent_id] = row.is_visible;
    }

    return NextResponse.json({ visibilityMap });
  } catch (error) {
    console.error('[GET /api/agents/list] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent visibility.' },
      { status: 500 }
    );
  }
}
