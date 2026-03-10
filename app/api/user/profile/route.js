import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/postgres';
import bcryptjs from 'bcryptjs';
import { isValidUUID } from '@/lib/utils';
import {
  createAuthError,
  createValidationError,
  createNotFoundError,
  createServerError,
} from '@/lib/errorHandler';

export async function GET(request) {
  try {
    // 토큰 검증
    const payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // UUID 검증
    if (!isValidUUID(payload.sub)) {
      return createValidationError('유효하지 않은 사용자 ID입니다.');
    }

    // 사용자 정보 조회 (비밀번호는 제외)
    const result = await query(
      'SELECT id, name, email, department, cell, role, created_at FROM users WHERE id = $1 LIMIT 1',
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return createNotFoundError('사용자를 찾을 수 없습니다.');
    }

    const user = result.rows[0];

    return NextResponse.json({
      success: true,
      user: {
        _id: user.id.toString(),
        name: user.name,
        email: user.email,
        department: user.department,
        cell: user.cell,
        role: user.role,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('사용자 정보 조회 실패:', error);
    return createServerError(error, '사용자 정보 조회 실패');
  }
}

export async function PATCH(request) {
  try {
    // 토큰 검증
    const payload = verifyToken(request);
    if (!payload) {
      return createAuthError('인증이 필요합니다.');
    }

    const body = await request.json();
    const { name, department, cell, currentPassword, newPassword } = body;

    // 입력값 검증
    if (!name || !department || !cell) {
      return createValidationError('모든 필드를 입력해주세요.');
    }

    // 유효한 부서 확인
    const validDepartments = [
      '디지털서비스개발부',
      '글로벌서비스개발부',
      '금융서비스개발부',
      '정보서비스개발부',
      'Tech혁신Unit',
      '기타부서',
    ];

    if (!validDepartments.includes(department)) {
      return createValidationError('유효하지 않은 부서입니다.');
    }

    // UUID 검증
    if (!isValidUUID(payload.sub)) {
      return createValidationError('유효하지 않은 사용자 ID입니다.');
    }

    // 현재 사용자 조회
    const userResult = await query(
      'SELECT id, password_hash FROM users WHERE id = $1 LIMIT 1',
      [payload.sub]
    );

    if (userResult.rows.length === 0) {
      return createNotFoundError('사용자를 찾을 수 없습니다.');
    }

    const user = userResult.rows[0];

    // 업데이트할 데이터 준비
    const updateFields = [];
    const updateParams = [];
    let paramIndex = 1;

    updateFields.push(`name = $${paramIndex++}`);
    updateParams.push(name);

    updateFields.push(`department = $${paramIndex++}`);
    updateParams.push(department);

    updateFields.push(`cell = $${paramIndex++}`);
    updateParams.push(cell);

    updateFields.push(`updated_at = $${paramIndex++}`);
    updateParams.push(new Date());

    // 비밀번호 변경 요청이 있는 경우
    if (currentPassword && newPassword) {
      // passwordHash 필드 확인
      const passwordHash = user.password_hash;

      if (!passwordHash) {
        return createServerError(
          null,
          '사용자 비밀번호 정보를 찾을 수 없습니다.'
        );
      }

      // 현재 비밀번호 확인
      const isCurrentPasswordValid = await bcryptjs.compare(
        currentPassword,
        passwordHash
      );
      if (!isCurrentPasswordValid) {
        return createValidationError('현재 비밀번호가 일치하지 않습니다.');
      }

      // 새 비밀번호 검증
      if (newPassword.length < 6) {
        return createValidationError(
          '새 비밀번호는 최소 6자 이상이어야 합니다.'
        );
      }

      // 새 비밀번호 해시화
      const newPasswordHash = await bcryptjs.hash(newPassword, 12);
      updateFields.push(`password_hash = $${paramIndex++}`);
      updateParams.push(newPasswordHash);
    }

    // 사용자 정보 업데이트
    updateParams.push(payload.sub);
    const updateResult = await query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
      updateParams
    );

    // PostgreSQL에서는 값이 변경되지 않았을 때도 rowCount가 0일 수 있음
    // 따라서 업데이트가 실행되었는지만 확인
    if (updateResult.rowCount === 0) {
      return createNotFoundError('사용자를 찾을 수 없습니다.');
    }

    // 정규화 후: messages 테이블에는 사용자 정보가 없으므로 업데이트 불필요
    // 사용자 정보는 user_id로 JOIN하여 조회됨

    return NextResponse.json({
      success: true,
      message: '프로필이 성공적으로 업데이트되었습니다.',
    });
  } catch (error) {
    console.error('프로필 업데이트 실패:', error);
    console.error('에러 스택:', error.stack);
    return createServerError(error, '프로필 업데이트 실패');
  }
}
