import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { query, transaction } from '@/lib/postgres';
import { isValidUUID } from '@/lib/utils';

export async function PATCH(request, { params }) {
  // 관리자 권한 확인
  const authResult = verifyAdmin(request);
  if (!authResult.success) {
    return authResult;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, role, name, department, cell } = body;

    if (action === 'update_profile') {
      // 프로필 업데이트 처리
      if (!name || !department || !cell) {
        return NextResponse.json(
          { error: '모든 필드를 입력해주세요.' },
          { status: 400 }
        );
      }

      // 유효한 부서 확인
      // 유효한 부서 확인 로직 제거 (자유 입력 허용)
      /*
      const validDepartments = [ '디지털서비스개발부', ... ];
      if (!validDepartments.includes(department)) { ... } 
      */

      // UUID 검증
      if (!isValidUUID(id)) {
        return NextResponse.json(
          { error: '유효하지 않은 사용자 ID입니다.' },
          { status: 400 }
        );
      }

      // 사용자 존재 여부 확인
      const userResult = await query('SELECT id FROM users WHERE id = $1', [id]);
      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // 사용자 정보 업데이트 (cell 변수에 직급(Position)이 들어오므로 employee_position_name 컬럼에 저장)
      const updateResult = await query(
        'UPDATE users SET name = $1, department = $2, employee_position_name = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [name, department, cell, id]
      );

      if (updateResult.rowCount === 0) {
        return NextResponse.json(
          { error: '사용자 정보 업데이트에 실패했습니다.' },
          { status: 500 }
        );
      }

      // 메시지 테이블의 사용자 정보도 업데이트 (비정규화된 데이터 동기화)
      // 실패해도 사용자 정보 업데이트는 성공으로 처리
      try {
        await query(
          'UPDATE messages SET name = $1, department = $2, cell = $3 WHERE user_id = $4',
          [name, department, cell, id]
        );
      } catch (msgError) {
        console.warn('메시지 테이블 동기화 실패 (무시됨):', msgError.message);
      }

      return NextResponse.json({
        success: true,
        message: '사용자 정보가 성공적으로 업데이트되었습니다.',
      });
    }

    // 역할 변경 처리 (기존 로직)
    if (!role || !['user', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: '유효하지 않은 역할입니다.' },
        { status: 400 }
      );
    }

    // UUID 검증
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: '유효하지 않은 사용자 ID입니다.' },
        { status: 400 }
      );
    }

    // 사용자 존재 여부 확인
    const userResult = await query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 자기 자신의 관리자 권한을 해제하려는 경우 방지
    if (authResult.user.sub === id && role === 'user') {
      return NextResponse.json(
        { error: '자신의 관리자 권한은 해제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 역할 업데이트
    const updateResult = await query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [role, id]
    );

    if (updateResult.rowCount === 0) {
      return NextResponse.json(
        { error: '사용자 정보 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '사용자 역할이 성공적으로 변경되었습니다.',
    });
  } catch (error) {
    console.error('사용자 역할 변경 실패:', error);
    return NextResponse.json(
      { error: '사용자 역할 변경 실패', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  // 관리자 권한 확인
  const authResult = verifyAdmin(request);
  if (!authResult.success) {
    return authResult;
  }

  try {
    const { id } = await params;

    // UUID 검증
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: '유효하지 않은 사용자 ID입니다.' },
        { status: 400 }
      );
    }

    // 사용자 존재 여부 확인
    const userResult = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 자기 자신을 삭제하려는 경우 방지
    if (authResult.user.sub === id) {
      return NextResponse.json(
        { error: '자기 자신은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // PostgreSQL 트랜잭션으로 사용자와 관련 데이터 삭제
    await transaction(async (client) => {
      // 1. 사용자 관련 메시지 삭제 (messages 테이블)
      await client.query('DELETE FROM messages WHERE user_id = $1', [id]);

      // 2. 사용자 관련 채팅방 삭제 (CASCADE로 chat_history도 자동 삭제)
      await client.query('DELETE FROM chat_rooms WHERE user_id = $1', [id]);

      // 3. 사용자 관련 채팅 파일 삭제
      await client.query('DELETE FROM chat_files WHERE user_id = $1', [id]);

      // 4. 사용자 삭제 (CASCADE로 외래키 관련 데이터도 자동 삭제)
      const deleteResult = await client.query('DELETE FROM users WHERE id = $1', [id]);

      if (deleteResult.rowCount === 0) {
        throw new Error('사용자 삭제에 실패했습니다.');
      }
    });

    return NextResponse.json({
      success: true,
      message: '사용자가 성공적으로 삭제되었습니다.',
    });
  } catch (error) {
    console.error('사용자 삭제 실패:', error);
    return NextResponse.json(
      { error: '사용자 삭제 실패', details: error.message },
      { status: 500 }
    );
  }
}
