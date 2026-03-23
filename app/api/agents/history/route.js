import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';

const MAX_HISTORY_ITEMS = 50;

let tableChecked = false;
async function ensureTable() {
  if (tableChecked) return;
  await query(`CREATE TABLE IF NOT EXISTS agent_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id VARCHAR(50) NOT NULL,
    entry_id VARCHAR(100) NOT NULL,
    title VARCHAR(500),
    input_data JSONB,
    output_data JSONB,
    output_text TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, agent_id, entry_id)
  )`).catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_agent_history_user_agent ON agent_history(user_id, agent_id)').catch(() => {});
  tableChecked = true;
}

export async function GET(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const userId = authResult.user?.sub || authResult.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unable to verify user.' }, { status: 401 });
  }

  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const limit = Math.min(Math.max(1, Number(searchParams.get('limit')) || 20), MAX_HISTORY_ITEMS);

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required.' }, { status: 400 });
    }

    const result = await query(
      `SELECT id, agent_id, entry_id, title, input_data, output_data, output_text, metadata, created_at, updated_at
       FROM agent_history
       WHERE user_id = $1 AND agent_id = $2
       ORDER BY updated_at DESC
       LIMIT $3`,
      [userId, agentId, limit]
    );

    return NextResponse.json({ items: result.rows });
  } catch (error) {
    console.error('[agents/history:GET] error:', error);
    return NextResponse.json({ error: 'Failed to retrieve history.' }, { status: 500 });
  }
}

export async function POST(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const userId = authResult.user?.sub || authResult.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unable to verify user.' }, { status: 401 });
  }

  try {
    await ensureTable();
    const body = await request.json();
    const {
      agentId,
      entryId,
      title,
      inputData,
      outputData,
      outputText,
      metadata,
      maxItems = 20,
    } = body;

    if (!agentId || !entryId) {
      return NextResponse.json({ error: 'agentId and entryId are required.' }, { status: 400 });
    }

    // Upsert
    const upsertResult = await query(
      `INSERT INTO agent_history (user_id, agent_id, entry_id, title, input_data, output_data, output_text, metadata, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, agent_id, entry_id)
       DO UPDATE SET
         title = EXCLUDED.title,
         input_data = EXCLUDED.input_data,
         output_data = EXCLUDED.output_data,
         output_text = EXCLUDED.output_text,
         metadata = EXCLUDED.metadata,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, entry_id, title, created_at, updated_at`,
      [
        userId,
        agentId,
        entryId,
        title || null,
        inputData ? JSON.stringify(inputData) : null,
        outputData ? JSON.stringify(outputData) : null,
        outputText || null,
        metadata ? JSON.stringify(metadata) : '{}',
      ]
    );

    // Auto-delete excess entries
    const effectiveMax = Math.min(Math.max(1, Number(maxItems) || 20), MAX_HISTORY_ITEMS);
    await query(
      `DELETE FROM agent_history
       WHERE id IN (
         SELECT id FROM agent_history
         WHERE user_id = $1 AND agent_id = $2
         ORDER BY updated_at DESC
         OFFSET $3
       )`,
      [userId, agentId, effectiveMax]
    );

    return NextResponse.json({
      success: true,
      item: upsertResult.rows[0],
    });
  } catch (error) {
    console.error('[agents/history:POST] error:', error);
    return NextResponse.json({ error: 'Failed to save history.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const userId = authResult.user?.sub || authResult.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unable to verify user.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required.' }, { status: 400 });
    }

    // Ownership verification + delete
    const result = await query(
      `DELETE FROM agent_history WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'History not found or no permission.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('[agents/history:DELETE] error:', error);
    return NextResponse.json({ error: 'Failed to delete history.' }, { status: 500 });
  }
}
