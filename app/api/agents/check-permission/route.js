import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { createServerError } from '@/lib/errorHandler';

// GET: 사용자의 특정 에이전트 접근 권한 확인
export async function GET(request) {
  try {
    const authResult = await verifyTokenWithResult(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json({ error: 'agentId가 필요합니다' }, { status: 400 });
    }

    const user = authResult.user;
    const userId = user?.id || user?.sub || user?.userId;

    // 해당 에이전트의 모든 권한 설정 조회
    const permissionsResult = await query(`
      SELECT * FROM agent_permissions
      WHERE agent_id = $1
    `, [agentId]);

    const permissions = permissionsResult.rows;

    // 권한 설정이 없으면 기본적으로 모든 사용자 허용
    if (permissions.length === 0) {
      return NextResponse.json({ allowed: true, reason: 'no_restrictions' });
    }

    // 권한 체크 로직
    // 1. 전체 허용/차단 확인
    const allPermission = permissions.find(p => p.permission_type === 'all');
    if (allPermission) {
      return NextResponse.json({
        allowed: allPermission.is_allowed,
        reason: allPermission.is_allowed ? 'all_allowed' : 'all_blocked'
      });
    }

    // 2. 개별 사용자 권한 확인 (가장 높은 우선순위)
    const userPermission = permissions.find(
      (p) => p.permission_type === 'user' && p.permission_value === userId
    );
    if (userPermission) {
      return NextResponse.json({
        allowed: userPermission.is_allowed,
        reason: userPermission.is_allowed ? 'user_allowed' : 'user_blocked'
      });
    }

    // 3. 역할 권한 확인
    const rolePermission = permissions.find(
      (p) => p.permission_type === 'role' && p.permission_value === user.role
    );
    if (rolePermission) {
      return NextResponse.json({
        allowed: rolePermission.is_allowed,
        reason: rolePermission.is_allowed ? 'role_allowed' : 'role_blocked'
      });
    }

    // 4. 부서 권한 확인
    const deptPermission = permissions.find(
      (p) => p.permission_type === 'department' && p.permission_value === user.department
    );
    if (deptPermission) {
      return NextResponse.json({
        allowed: deptPermission.is_allowed,
        reason: deptPermission.is_allowed ? 'department_allowed' : 'department_blocked'
      });
    }

    // 권한 설정이 있지만 해당 사용자에게 적용되는 규칙이 없으면 차단
    // (명시적으로 허용된 대상만 접근 가능)
    return NextResponse.json({
      allowed: false,
      reason: 'not_in_allowed_list'
    });
  } catch (error) {
    console.error('[GET /api/agents/check-permission] error:', error);
    return createServerError(error);
  }
}

// POST: 사용자의 모든 에이전트 접근 권한 확인
export async function POST(request) {
  try {
    const authResult = await verifyTokenWithResult(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const user = authResult.user;
    const userId = user?.id || user?.sub || user?.userId;

    // 모든 에이전트 권한 설정 조회
    const permissionsResult = await query(`
      SELECT * FROM agent_permissions
      ORDER BY agent_id
    `);

    const permissions = permissionsResult.rows;

    // 에이전트 ID별로 그룹화
    const agentIds = ['1', '2', '3', '4', '5', '6', '7'];
    const result = {};

    for (const agentId of agentIds) {
      const agentPermissions = permissions.filter(p => p.agent_id === agentId);

      // 권한 설정이 없으면 허용
      if (agentPermissions.length === 0) {
        result[agentId] = { allowed: true, reason: 'no_restrictions' };
        continue;
      }

      // 전체 허용/차단
      const allPermission = agentPermissions.find(p => p.permission_type === 'all');
      if (allPermission) {
        result[agentId] = {
          allowed: allPermission.is_allowed,
          reason: allPermission.is_allowed ? 'all_allowed' : 'all_blocked'
        };
        continue;
      }

      // 개별 사용자 권한
      const userPermission = agentPermissions.find(
        (p) => p.permission_type === 'user' && p.permission_value === userId
      );
      if (userPermission) {
        result[agentId] = {
          allowed: userPermission.is_allowed,
          reason: userPermission.is_allowed ? 'user_allowed' : 'user_blocked'
        };
        continue;
      }

      // 역할 권한
      const rolePermission = agentPermissions.find(
        (p) => p.permission_type === 'role' && p.permission_value === user.role
      );
      if (rolePermission) {
        result[agentId] = {
          allowed: rolePermission.is_allowed,
          reason: rolePermission.is_allowed ? 'role_allowed' : 'role_blocked'
        };
        continue;
      }

      // 부서 권한
      const deptPermission = agentPermissions.find(
        (p) => p.permission_type === 'department' && p.permission_value === user.department
      );
      if (deptPermission) {
        result[agentId] = {
          allowed: deptPermission.is_allowed,
          reason: deptPermission.is_allowed ? 'department_allowed' : 'department_blocked'
        };
        continue;
      }

      // 적용되는 규칙 없음 → 차단
      result[agentId] = { allowed: false, reason: 'not_in_allowed_list' };
    }

    return NextResponse.json({ permissions: result });
  } catch (error) {
    console.error('[POST /api/agents/check-permission] error:', error);
    return createServerError(error);
  }
}
