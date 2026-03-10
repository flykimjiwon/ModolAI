import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyAdminWithResult } from '@/lib/auth';
import { createServerError } from '@/lib/errorHandler';

// 에이전트 목록 정의
const AGENTS = [
  { id: '1', name: 'AI 가상회의', description: '인원수, 페르소나, 주제, 대화 개수를 설정하면 AI가 토론 결과를 제공합니다' },
  { id: '2', name: '코드 컨버터', description: 'A언어에서 B언어로 코드를 변환해 드립니다' },
  { id: '3', name: 'Text to SQL', description: '엑셀 업로드 후 자연어로 질문하면 데이터를 조회해 드립니다' },
  { id: '4', name: '텍스트 재작성 도구', description: '목적(메일, 쪽지, 보고서)과 톤(정중한, 공손한)에 맞게 텍스트를 재작성해 드립니다' },
  { id: '5', name: '에러 해결 도우미', description: '코드와 에러 메시지를 입력하면 원인 파악을 도와드립니다' },
  { id: '6', name: 'Solgit 프로젝트 리뷰어', description: 'Solgit 프로젝트를 지정하면 코드 파일들에 대한 LLM 리뷰를 제공합니다' },
  { id: '7', name: 'PPT 에이전트', description: '주제와 포맷을 입력하면 AI가 프레젠테이션을 생성해 드립니다' },
];

// GET: 에이전트 목록 및 권한 조회
export async function GET(request) {
  try {
    const authResult = await verifyAdminWithResult(request);
    if (!authResult.valid) {
      const status = authResult.error?.includes('관리자') ? 403 : 401;
      return NextResponse.json({ error: authResult.error }, { status });
    }

    // 모든 권한 설정 조회
    const permissionsResult = await query(`
      SELECT
        ap.*,
        u.email as created_by_email,
        u.name as created_by_name
      FROM agent_permissions ap
      LEFT JOIN users u ON ap.created_by = u.id
      ORDER BY ap.agent_id, ap.permission_type
    `);

    // 사용자 목록 조회 (권한 설정용)
    const usersResult = await query(`
      SELECT id, email, name, department, cell, role
      FROM users
      ORDER BY name, email
    `);

    // 부서 목록 조회
    const departmentsResult = await query(`
      SELECT DISTINCT department
      FROM users
      WHERE department IS NOT NULL AND department != ''
      ORDER BY department
    `);

    // 에이전트별 권한 정리
    const agentsWithPermissions = AGENTS.map(agent => {
      const agentPermissions = permissionsResult.rows.filter(p => p.agent_id === agent.id);
      return {
        ...agent,
        permissions: agentPermissions,
      };
    });

    return NextResponse.json({
      agents: agentsWithPermissions,
      users: usersResult.rows,
      departments: departmentsResult.rows.map(d => d.department),
    });
  } catch (error) {
    console.error('[GET /api/admin/agents] error:', error);
    return createServerError(error);
  }
}

// POST: 에이전트 권한 설정
export async function POST(request) {
  try {
    const authResult = await verifyAdminWithResult(request);
    if (!authResult.valid) {
      const status = authResult.error?.includes('관리자') ? 403 : 401;
      return NextResponse.json({ error: authResult.error }, { status });
    }

    const body = await request.json();
    const { agentId, permissionType, permissionValue, isAllowed } = body;

    if (!agentId || !permissionType) {
      return NextResponse.json({ error: 'agentId와 permissionType은 필수입니다' }, { status: 400 });
    }

    // 유효한 에이전트 ID 확인
    if (!AGENTS.find(a => a.id === agentId)) {
      return NextResponse.json({ error: '유효하지 않은 에이전트 ID입니다' }, { status: 400 });
    }

    // 유효한 권한 타입 확인
    const validTypes = ['all', 'role', 'department', 'user'];
    if (!validTypes.includes(permissionType)) {
      return NextResponse.json({ error: '유효하지 않은 권한 타입입니다' }, { status: 400 });
    }

    // 권한 타입에 따른 값 검증
    if (permissionType !== 'all' && !permissionValue) {
      return NextResponse.json({ error: `${permissionType} 타입은 값이 필요합니다` }, { status: 400 });
    }

    // UPSERT (있으면 업데이트, 없으면 삽입)
    const result = await query(`
      INSERT INTO agent_permissions (agent_id, permission_type, permission_value, is_allowed, created_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (agent_id, permission_type, permission_value)
      DO UPDATE SET is_allowed = $4, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [agentId, permissionType, permissionValue || null, isAllowed !== false, authResult.user.id]);

    return NextResponse.json({
      message: '권한이 설정되었습니다',
      permission: result.rows[0]
    });
  } catch (error) {
    console.error('[POST /api/admin/agents] error:', error);
    return createServerError(error);
  }
}

// DELETE: 에이전트 권한 삭제
export async function DELETE(request) {
  try {
    const authResult = await verifyAdminWithResult(request);
    if (!authResult.valid) {
      const status = authResult.error?.includes('관리자') ? 403 : 401;
      return NextResponse.json({ error: authResult.error }, { status });
    }

    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get('id');

    if (!permissionId) {
      return NextResponse.json({ error: '권한 ID가 필요합니다' }, { status: 400 });
    }

    await query('DELETE FROM agent_permissions WHERE id = $1', [permissionId]);

    return NextResponse.json({ message: '권한이 삭제되었습니다' });
  } catch (error) {
    console.error('[DELETE /api/admin/agents] error:', error);
    return createServerError(error);
  }
}
