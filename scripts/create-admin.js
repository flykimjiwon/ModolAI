/**
 * 관리자 계정 생성 스크립트
 * 사용법:
 *   node scripts/create-admin.js
 *   node scripts/create-admin.js <email> <password>
 *   node scripts/create-admin.js --interactive
 */

// dotenv로 환경변수 로드 (Docker 환경에서는 선택적)
try {
  require('dotenv').config({ path: '.env.development' });
} catch (e) {
  console.warn('[create-admin] .env.development 로드 실패:', e?.message);
}

const { Pool } = require('pg');
const bcryptjs = require('bcryptjs');
const readline = require('readline');

// PostgreSQL 연결 풀 생성 함수
function getPostgresPool() {
  const connectionString = process.env.POSTGRES_URI || process.env.DATABASE_URL;
  if (!connectionString) {
    const errorMsg =
      '❌ POSTGRES_URI 또는 DATABASE_URL 환경 변수가 설정되지 않았습니다.\n' +
      '   .env.development 파일에 다음을 추가하세요:\n' +
      '   POSTGRES_URI=postgresql://사용자명:비밀번호@호스트:포트/데이터베이스명\n' +
      '   또는\n' +
      '   DATABASE_URL=postgresql://사용자명:비밀번호@호스트:포트/데이터베이스명';
    throw new Error(errorMsg);
  }

  // 연결 문자열을 직접 사용 (create-postgres-schema.js와 동일한 방식)
  // 비밀번호가 없는 경우 PostgreSQL이 trust 인증을 사용하도록 설정되어 있어야 합니다
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  console.log('✅ PostgreSQL 연결 풀 생성 완료');
  return pool;
}

// 사용자 입력을 받는 함수
function getUserInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// 비밀번호 입력 (숨김 처리)
function getPasswordInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });

    // 입력 숨김 처리 (Linux/Mac)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
  });
}

// 이메일 형식 검증
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 비밀번호 길이 검증
function validatePassword(password) {
  if (password.length < 6) {
    return '비밀번호는 최소 6자리 이상이어야 합니다.';
  }
  return null;
}

async function createAdmin(customEmail = null, customPassword = null) {
  let pool = null;
  let client = null;
  const startTime = Date.now();

  try {
    console.log('🔧 관리자 계정 생성을 시작합니다...');
    console.log('');

    // 환경 변수 확인
    const connectionString =
      process.env.POSTGRES_URI || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        '❌ POSTGRES_URI 또는 DATABASE_URL 환경 변수가 설정되지 않았습니다.\n' +
          '   Docker 환경: docker.env 파일 확인\n' +
          '   로컬 환경: .env.development 파일 확인'
      );
    }

    // 명령행 인수 처리
    const args = process.argv.slice(2);
    let email, password, name, department, cell;

    if (args.length === 1 && args[0] === '--interactive') {
      // 대화형 모드
      console.log('\n📝 대화형 관리자 계정 생성 모드');
      console.log('========================================');

      // 이메일 입력
      do {
        email = await getUserInput('📧 관리자 이메일을 입력하세요: ');
        if (!validateEmail(email)) {
          console.log('❌ error 올바른 이메일 형식이 아닙니다.');
        }
      } while (!validateEmail(email));

      // 비밀번호 입력
      do {
        password = await getUserInput('🔑 비밀번호를 입력하세요 (최소 6자): ');
        const passwordError = validatePassword(password);
        if (passwordError) {
          console.log(`❌ error ${passwordError}`);
        }
      } while (validatePassword(password));

      // 기본 정보 입력
      name =
        (await getUserInput(
          '👤 관리자 이름을 입력하세요 (기본값: 시스템 관리자): '
        )) || '시스템 관리자';
      department =
        (await getUserInput('🏢 부서를 입력하세요 (기본값: tech혁신unit): ')) ||
        'tech혁신unit';
      cell =
        (await getUserInput(
          '📱 Cell/팀을 입력하세요 (기본값: 시스템관리팀): '
        )) || '시스템관리팀';
    } else if (args.length >= 2) {
      // 명령행 인수 모드
      email = args[0];
      password = args[1];
      name = args[2] || '시스템 관리자';
      department = args[3] || 'tech혁신unit';
      cell = args[4] || '시스템관리팀';

      // 검증
      if (!validateEmail(email)) {
        throw new Error('❌ error 올바른 이메일 형식이 아닙니다.');
      }
      const passwordError = validatePassword(password);
      if (passwordError) {
        throw new Error(`❌ error ${passwordError}`);
      }
    } else if (customEmail && customPassword) {
      // 함수 파라미터 모드
      email = customEmail;
      password = customPassword;
      name = '시스템 관리자';
      department = 'tech혁신unit';
      cell = '시스템관리팀';
    } else {
      // 기본값 모드 (기존 동작)
      email = 'admin@shinhan.com';
      password = 'shinhan@1';
      name = '시스템 관리자';
      department = 'tech혁신unit';
      cell = '시스템관리팀';

      console.log('⚠️  기본값으로 관리자 계정을 생성합니다.');
      console.log('📋 사용법:');
      console.log(
        '  node scripts/create-admin.js <email> <password> [name] [department] [cell]'
      );
      console.log('  node scripts/create-admin.js --interactive');
      console.log('');
    }

    // PostgreSQL 연결
    pool = getPostgresPool();
    client = await pool.connect();

    // 관리자 정보 설정
    const adminData = {
      name,
      email,
      password,
      department,
      cell,
      role: 'admin',
    };

    // 기존 관리자 계정 확인
    const existingAdminResult = await client.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [adminData.email]
    );

    if (existingAdminResult.rows.length > 0) {
      const existingAdmin = existingAdminResult.rows[0];
      console.log('⚠️  이미 해당 이메일로 등록된 계정이 있습니다.');
      console.log(`📧 이메일: ${adminData.email}`);
      console.log(`🆔 계정 ID: ${existingAdmin.id}`);
      console.log(`👤 역할: ${existingAdmin.role || 'user'}`);

      // 이미 관리자 권한이 있으면 중복 생성을 방지하고 종료
      if (existingAdmin.role === 'admin') {
        console.log(
          'ℹ️  계정이 이미 관리자 권한을 가지고 있습니다. 중복 생성을 건너뜁니다.'
        );
        return;
      }

      // 일반 사용자 계정을 관리자로 승격
      let updateQuery =
        'UPDATE users SET role = $1, department = $2, cell = $3, updated_at = CURRENT_TIMESTAMP';
      let updateParams = [adminData.role, adminData.department, adminData.cell];

      // 비밀번호가 제공된 경우 해싱하여 업데이트
      if (adminData.password) {
        const hashedPassword = await bcryptjs.hash(adminData.password, 12);
        updateQuery += ', password_hash = $4';
        updateParams.push(hashedPassword);
      }

      updateQuery += ' WHERE email = $' + (updateParams.length + 1);
      updateParams.push(adminData.email);

      const result = await client.query(updateQuery, updateParams);

      if (result.rowCount > 0) {
        console.log('✅ 기존 계정을 관리자로 승격했습니다.');
        if (adminData.password) {
          console.log('✅ 비밀번호도 업데이트되었습니다.');
        }
      } else {
        console.log('ℹ️  계정 정보가 변경되지 않았습니다 (이미 동일한 설정).');
      }
      return;
    }

    // 패스워드 해싱
    const hashedPassword = await bcryptjs.hash(adminData.password, 12);

    // 관리자 계정 생성
    const result = await client.query(
      `INSERT INTO users (name, email, password_hash, department, cell, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        adminData.name,
        adminData.email,
        hashedPassword,
        adminData.department,
        adminData.cell,
        adminData.role,
      ]
    );

    if (result.rows.length > 0) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('✅ 관리자 계정이 성공적으로 생성되었습니다!');
      console.log('');
      console.log('📋 관리자 계정 정보:');
      console.log(`📧 이메일: ${adminData.email}`);
      console.log(`🔑 패스워드: ${adminData.password}`);
      console.log(`👤 이름: ${adminData.name}`);
      console.log(`🏢 부서: ${adminData.department}`);
      console.log(`📱 Cell: ${adminData.cell}`);
      console.log(`⏱️  소요 시간: ${duration}초`);
      console.log('');
      console.log('🚨 보안 주의사항:');
      console.log('1. 반드시 초기 패스워드를 변경하세요');
      console.log('2. 이 정보를 안전한 곳에 보관하세요');
      console.log('3. 운영 환경에서는 더 강력한 패스워드를 사용하세요');
      console.log('');
      console.log('🌐 관리자 페이지 접속:');
      console.log('   - 로컬: http://localhost:3000/admin');
      console.log('   - Docker: http://<SERVER_IP>:3000/admin');
    }
  } catch (error) {
    console.error('\n❌ 관리자 계정 생성 실패');
    console.error('═══════════════════════════════════════════════════');
    console.error(`오류: ${error.message}`);

    if (error.stack && process.env.DEBUG) {
      console.error('\n상세 오류 (DEBUG 모드):');
      console.error(error.stack);
    }

    console.error('═══════════════════════════════════════════════════\n');
    process.exit(1);
  } finally {
    // PostgreSQL 연결 종료
    if (client) {
      try {
        client.release();
      } catch (error) {
        console.error('⚠️  클라이언트 해제 중 오류:', error.message);
      }
    }
    if (pool) {
      try {
        await pool.end();
        console.log('🔌 PostgreSQL 연결 종료');
      } catch (error) {
        console.error('⚠️  연결 종료 중 오류:', error.message);
      }
    }
  }
}

// 스크립트 실행
createAdmin();
