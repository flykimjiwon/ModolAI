import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({ connectionString: process.env.POSTGRES_URI });
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * DB 초기화 API
 * 관리자만 접근 가능
 */
export async function POST(req) {
  try {
    // 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token.' }, { status: 401 });
    }

    // 관리자 권한 확인
    if (decoded.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin privileges required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { type, tables } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'type이 필요합니다. (all, partial)' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let deletedTables = [];
      let message = '';

      if (type === 'all') {
        // 전체 DB 초기화 (users 테이블 제외)
        const tablesToDelete = [
          'chat_history',
          'chat_rooms',
          'messages',
          'chat_files',
          'board_comments',
          'board_posts',
          'model_logs',
          'model_server_error_history',
          'model_server_status',
          'external_api_prompts',
          'external_api_logs',
          'api_tokens',
          'notices',
          'user_chats',
          'qa_logs',
          'app_error_logs',
        ];

        for (const table of tablesToDelete) {
          await client.query(`DELETE FROM ${table}`);
          deletedTables.push(table);
        }

        message = '전체 DB가 초기화되었습니다. (users 테이블은 보존됨)';
      } else if (type === 'partial') {
        // 일부 테이블만 초기화
        if (!tables || !Array.isArray(tables) || tables.length === 0) {
          throw new Error('초기화할 테이블을 선택해주세요.');
        }

        // 허용된 테이블만 초기화 (users, settings 등 핵심 테이블 제외)
        const allowedTables = [
          'chat_history',
          'chat_rooms',
          'messages',
          'chat_files',
          'board_comments',
          'board_posts',
          'model_logs',
          'model_server_error_history',
          'model_server_status',
          'external_api_prompts',
          'external_api_logs',
          'api_tokens',
          'notices',
          'user_chats',
          'qa_logs',
          'app_error_logs',
        ];

        for (const table of tables) {
          if (!allowedTables.includes(table)) {
            throw new Error(`허용되지 않은 테이블: ${table}`);
          }
          await client.query(`DELETE FROM ${table}`);
          deletedTables.push(table);
        }

        message = `선택한 테이블이 초기화되었습니다: ${deletedTables.join(', ')}`;
      } else {
        throw new Error('유효하지 않은 type입니다. (all, partial)');
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message,
        deletedTables,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('DB 초기화 실패:', error);
    return NextResponse.json(
      {
        error: error.message || 'DB 초기화 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
