import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyAdmin } from '@/lib/adminAuth';

// 디버그용 데이터베이스 상태 확인
export async function GET(request) {
  try {
    // 관리자 권한 확인
    const adminCheck = verifyAdmin(request);
    if (!adminCheck.success) {
      return adminCheck;
    }

    // modelConfig 테이블 확인
    const modelConfigResult = await query(
      `SELECT * FROM model_config WHERE config_type = $1 LIMIT 1`,
      ['models']
    );
    const modelConfig = modelConfigResult.rows[0] || null;
    
    // config JSONB 필드 처리
    if (modelConfig && modelConfig.config) {
      modelConfig.categories = modelConfig.config.categories;
    }

    // promptConfig 테이블 확인
    const promptConfigResult = await query(
      `SELECT * FROM prompt_config WHERE config_type = $1 LIMIT 1`,
      ['prompts']
    );
    const promptConfig = promptConfigResult.rows[0] || null;
    
    // config JSONB 필드 처리
    if (promptConfig && promptConfig.config) {
      promptConfig.prompts = promptConfig.config.prompts;
    }

    // 최근 메시지 몇 개 확인
    const messagesResult = await query(
      `SELECT id, model, role, text, created_at FROM messages 
       ORDER BY created_at DESC LIMIT 3`
    );
    
    const recentMessages = messagesResult.rows.map((row) => ({
      id: row.id,
      model: row.model,
      role: row.role,
      textPreview: row.text?.substring(0, 100) + '...',
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      modelConfig: modelConfig || null,
      promptConfig: promptConfig || null,
      recentMessages,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('디버그 API 실패:', error);
    return NextResponse.json(
      {
        error: '디버그 정보를 불러오는데 실패했습니다.',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
