/**
 * 데이터베이스 유틸리티 함수
 * 데이터베이스 연결 및 헬퍼 함수 제공
 */

// dotenv로 환경변수 로드 (Docker 환경에서는 선택적)
try {
  require('dotenv').config({ path: '.env.development' });
} catch (e) {
  console.info(
    '[db-utils] .env.development 로드 실패, 환경 변수만 사용합니다:',
    e.message
  );
}

const { Pool } = require('pg');

/**
 * PostgreSQL 연결 풀 생성
 */
function createPool() {
  const connectionString = process.env.POSTGRES_URI || process.env.DATABASE_URL;

  if (!connectionString) {
    const errorMsg = [
      '❌ POSTGRES_URI 또는 DATABASE_URL 환경 변수가 설정되지 않았습니다.',
      '',
      '💡 해결 방법:',
      '  1. Docker 환경: docker.env 파일에 POSTGRES_URI 설정',
      '  2. 로컬 환경: .env.development 파일에 POSTGRES_URI 설정',
      '  3. 환경 변수 직접 설정: export POSTGRES_URI="postgresql://..."',
    ].join('\n');
    throw new Error(errorMsg);
  }

  // 연결 문자열 형식 검증
  if (
    !connectionString.startsWith('postgresql://') &&
    !connectionString.startsWith('postgres://')
  ) {
    throw new Error(
      '❌ 잘못된 연결 문자열 형식입니다. postgresql:// 또는 postgres://로 시작해야 합니다.'
    );
  }

  return new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000, // 스키마 생성 시 긴 쿼리를 위해 타임아웃 증가 (5초 -> 30초)
    statement_timeout: 60000, // 쿼리 실행 타임아웃 60초
  });
}

/**
 * PostgreSQL 연결 대기
 * @param {Pool} pool - PostgreSQL 연결 풀
 * @param {number} maxRetries - 최대 재시도 횟수
 * @param {number} retryDelay - 재시도 대기 시간 (ms)
 */
async function waitForDatabase(pool, maxRetries = 30, retryDelay = 2000) {
  console.log('⏳ PostgreSQL 연결 대기 중...');
  console.log(`   최대 대기 시간: ${(maxRetries * retryDelay) / 1000}초`);

  let lastError = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = await pool.connect();

      // 연결 테스트 쿼리 실행
      const result = await client.query(
        'SELECT NOW() as current_time, version() as version'
      );
      const pgVersion = result.rows[0].version.split(' ')[1];

      client.release();

      console.log('✅ PostgreSQL 연결 성공');
      console.log(`   PostgreSQL 버전: ${pgVersion}`);
      console.log(`   연결 시도 횟수: ${i + 1}회`);
      return true;
    } catch (error) {
      lastError = error;
      const remaining = maxRetries - i - 1;

      if (remaining > 0) {
        console.log(
          `⏳ PostgreSQL 연결 대기 중... (${
            i + 1
          }/${maxRetries}) - ${remaining}회 남음`
        );

        // 오류 타입에 따른 메시지
        if (error.code === 'ECONNREFUSED') {
          console.log('   ℹ️  PostgreSQL 서버가 아직 시작되지 않았습니다.');
        } else if (error.code === 'ENOTFOUND') {
          console.log('   ℹ️  호스트를 찾을 수 없습니다. DNS 확인 중...');
        } else if (error.code === '3D000') {
          console.log('   ℹ️  데이터베이스가 존재하지 않습니다.');
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  // 최종 실패
  const errorMsg = [
    '❌ PostgreSQL 연결 실패 (최대 재시도 횟수 초과)',
    '',
    `마지막 오류: ${lastError.message}`,
    `오류 코드: ${lastError.code || 'N/A'}`,
    '',
    '💡 확인 사항:',
    '  1. PostgreSQL 서버가 실행 중인지 확인',
    '  2. 연결 정보가 올바른지 확인 (호스트, 포트, 데이터베이스명)',
    '  3. 방화벽 설정 확인',
    '  4. PostgreSQL 로그 확인',
  ].join('\n');

  throw new Error(errorMsg);
}

/**
 * 테이블 존재 여부 확인
 * @param {PoolClient} client - PostgreSQL 클라이언트
 * @param {string} tableName - 테이블 이름
 */
async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0].exists;
}

/**
 * 사용자 존재 여부 확인
 * @param {PoolClient} client - PostgreSQL 클라이언트
 * @param {string} email - 사용자 이메일
 */
async function userExists(client, email) {
  const result = await client.query(
    'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)',
    [email]
  );
  return result.rows[0].exists;
}

/**
 * 설정 존재 여부 확인
 * @param {PoolClient} client - PostgreSQL 클라이언트
 * @param {string} configType - 설정 타입
 */
async function settingsExist(client, tableName, configType = 'general') {
  const result = await client.query(
    `SELECT EXISTS(SELECT 1 FROM ${tableName} WHERE config_type = $1)`,
    [configType]
  );
  return result.rows[0].exists;
}

/**
 * 연결 문자열 마스킹 (비밀번호 숨김)
 * @param {string} connectionString - PostgreSQL 연결 문자열
 */
function maskConnectionString(connectionString) {
  return connectionString.replace(/:[^:@]+@/, ':****@');
}

module.exports = {
  createPool,
  waitForDatabase,
  tableExists,
  userExists,
  settingsExist,
  maskConnectionString,
};
