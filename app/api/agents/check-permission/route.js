import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { createServerError } from '@/lib/errorHandler';

// GET: Check user permission for a specific agent
export async function GET(request) {
  try {
    const authResult = await verifyTokenWithResult(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    const user = authResult.user;
    const userId = user?.id || user?.sub || user?.userId;

    // Retrieve all permission settings for this agent
    const permissionsResult = await query(`
      SELECT * FROM agent_permissions
      WHERE agent_id = $1
    `, [agentId]);

    const permissions = permissionsResult.rows;

    // No restrictions = allow all users by default
    if (permissions.length === 0) {
      return NextResponse.json({ allowed: true, reason: 'no_restrictions' });
    }

    // Permission check logic
    // 1. Check all allow/block
    const allPermission = permissions.find(p => p.permission_type === 'all');
    if (allPermission) {
      return NextResponse.json({
        allowed: allPermission.is_allowed,
        reason: allPermission.is_allowed ? 'all_allowed' : 'all_blocked'
      });
    }

    // 2. Check individual user permission (highest priority)
    const userPermission = permissions.find(
      (p) => p.permission_type === 'user' && p.permission_value === userId
    );
    if (userPermission) {
      return NextResponse.json({
        allowed: userPermission.is_allowed,
        reason: userPermission.is_allowed ? 'user_allowed' : 'user_blocked'
      });
    }

    // 3. Check role permission
    const rolePermission = permissions.find(
      (p) => p.permission_type === 'role' && p.permission_value === user.role
    );
    if (rolePermission) {
      return NextResponse.json({
        allowed: rolePermission.is_allowed,
        reason: rolePermission.is_allowed ? 'role_allowed' : 'role_blocked'
      });
    }

    // 4. Check department permission
    const deptPermission = permissions.find(
      (p) => p.permission_type === 'department' && p.permission_value === user.department
    );
    if (deptPermission) {
      return NextResponse.json({
        allowed: deptPermission.is_allowed,
        reason: deptPermission.is_allowed ? 'department_allowed' : 'department_blocked'
      });
    }

    // Rules exist but none apply to this user = block
    // (only explicitly allowed targets can access)
    return NextResponse.json({
      allowed: false,
      reason: 'not_in_allowed_list'
    });
  } catch (error) {
    console.error('[GET /api/agents/check-permission] error:', error);
    return createServerError(error);
  }
}

// POST: Check user permission for all agents
export async function POST(request) {
  try {
    const authResult = await verifyTokenWithResult(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const user = authResult.user;
    const userId = user?.id || user?.sub || user?.userId;

    // Retrieve all agent permission settings
    const permissionsResult = await query(`
      SELECT * FROM agent_permissions
      ORDER BY agent_id
    `);

    const permissions = permissionsResult.rows;

    // Group by agent ID
    const agentIds = ['7'];
    const result = {};

    for (const agentId of agentIds) {
      const agentPermissions = permissions.filter(p => p.agent_id === agentId);

      // No restrictions = allow
      if (agentPermissions.length === 0) {
        result[agentId] = { allowed: true, reason: 'no_restrictions' };
        continue;
      }

      // All allow/block
      const allPermission = agentPermissions.find(p => p.permission_type === 'all');
      if (allPermission) {
        result[agentId] = {
          allowed: allPermission.is_allowed,
          reason: allPermission.is_allowed ? 'all_allowed' : 'all_blocked'
        };
        continue;
      }

      // Individual user permission
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

      // Role permission
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

      // Department permission
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

      // No matching rules = block
      result[agentId] = { allowed: false, reason: 'not_in_allowed_list' };
    }

    return NextResponse.json({ permissions: result });
  } catch (error) {
    console.error('[POST /api/agents/check-permission] error:', error);
    return createServerError(error);
  }
}
