import pg from 'pg';
const { Pool } = pg;

// PostgreSQL 연결 풀 (싱글톤)
let pool = null;

/**
 * 빌드 시점인지 확인하는 함수
 */
function isBuildTime() {
  // 1. 명시적인 환경 변수 체크
  if (process.env.SKIP_DB_CONNECTION === 'true') {
    return true;
  }

  // 2. Next.js 빌드 단계 체크
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return true;
  }

  // 3. Next.js 빌드 중인지 체크 (process.argv에 'build'가 포함되어 있는지)
  if (
    typeof process !== 'undefined' &&
    process.argv &&
    (process.argv.some(
      (arg) => arg.includes('next') && arg.includes('build')
    ) ||
      process.argv.some((arg) => arg === 'build'))
  ) {
    return true;
  }

  // 4. 빌드 디렉토리가 생성 중인지 체크 (.next 디렉토리 생성 중)
  // 이 방법은 신뢰할 수 없으므로 주석 처리
  // try {
  //   if (typeof require !== 'undefined') {
  //     const fs = require('fs');
  //     const path = require('path');
  //     const nextDir = path.join(process.cwd(), '.next');
  //     if (fs.existsSync(nextDir)) {
  //       const buildManifest = path.join(nextDir, 'build-manifest.json');
  //       if (!fs.existsSync(buildManifest)) {
  //         return true; // 빌드 중
  //       }
  //     }
  //   }
  // } catch (e) {
  //   // 파일 시스템 접근 불가 시 무시
  // }

  return false;
}

/**
 * PostgreSQL 연결 풀 가져오기
 */
export function getPostgresPool() {
  // 빌드 시점에는 데이터베이스 연결을 시도하지 않음
  if (isBuildTime()) {
    if (process.env.SKIP_DB_CONNECTION !== 'true') {
      // SKIP_DB_CONNECTION이 명시적으로 설정되지 않은 경우에만 경고 출력
      // (이미 설정된 경우 중복 경고 방지)
      console.warn('⚠️ 빌드 시점이므로 PostgreSQL 연결을 생성하지 않습니다.');
    }
    return null;
  }

  if (!pool) {
    const connectionString =
      process.env.POSTGRES_URI || process.env.DATABASE_URL;

    if (!connectionString) {
      const errorMsg =
        '❌ error POSTGRES_URI 또는 DATABASE_URL이 환경 변수에 정의되지 않았습니다.\n' +
        '   .env.local 파일에 다음을 추가하세요:\n' +
        '   POSTGRES_URI=postgresql://사용자명:비밀번호@호스트:포트/데이터베이스명\n' +
        '   또는\n' +
        '   DATABASE_URL=postgresql://사용자명:비밀번호@호스트:포트/데이터베이스명';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // 연결 문자열을 직접 사용 (create-postgres-schema.js와 동일한 방식)
    // 비밀번호가 없는 경우 PostgreSQL이 trust 인증을 사용하도록 설정되어 있어야 합니다
    // SCRAM 인증을 요구하는 경우 비밀번호가 필요합니다
    pool = new Pool({
      connectionString,
      max: 20, // 최대 연결 수
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // 연결 타임아웃 증가 (2초 -> 10초)
    });

    // 연결 후 시간대 설정
    pool.on('connect', async (client) => {
      try {
        await client.query("SET timezone = 'Asia/Seoul'");
      } catch (error) {
        console.warn('⚠️ PostgreSQL 시간대 설정 실패:', error.message);
      }
    });

    // 연결 오류 처리
    pool.on('error', (err) => {
      console.error('❌ error PostgreSQL 연결 풀 오류:', err.message);
      console.error('   오류 코드:', err.code);
      console.error('   오류 상세:', err);

      // SCRAM 인증 오류인 경우 더 명확한 메시지 제공
      if (err.message && err.message.includes('SCRAM-SERVER-FIRST-MESSAGE')) {
        console.error(
          '💡 PostgreSQL이 SCRAM 인증을 요구하는 경우 비밀번호가 필요합니다.'
        );
        console.error('   해결 방법:');
        console.error(
          "   1. PostgreSQL 사용자에 비밀번호 설정: ALTER USER 사용자명 WITH PASSWORD '비밀번호';"
        );
        console.error('   2. .env.local 파일의 POSTGRES_URI에 비밀번호 추가:');
        console.error(
          '      POSTGRES_URI=postgresql://사용자명:비밀번호@호스트:포트/데이터베이스명'
        );
      }

      // 연결 거부 오류
      if (err.code === 'ECONNREFUSED') {
        console.error('💡 PostgreSQL 서버에 연결할 수 없습니다.');
        console.error('   확인 사항:');
        console.error('   1. PostgreSQL이 실행 중인지 확인');
        console.error('   2. 연결 문자열의 호스트와 포트가 올바른지 확인');
        console.error('   3. 방화벽 설정 확인');
      }

      // 호스트를 찾을 수 없는 오류
      if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
        console.error('💡 PostgreSQL 호스트를 Not found.');
        console.error('   확인 사항:');
        console.error('   1. 호스트 이름이 올바른지 확인');
        console.error(
          '   2. Docker를 사용하는 경우 컨테이너 이름이 올바른지 확인'
        );
      }
    });

    console.log('✅ PostgreSQL 연결 풀 생성 완료');
    console.log(
      `   연결 문자열: ${connectionString.replace(/:[^:@]+@/, ':****@')}`
    );
  }

  return pool;
}

/**
 * PostgreSQL 연결 (쿼리 실행용)
 */
export async function getPostgresClient() {
  // 빌드 시점에는 클라이언트 연결하지 않음
  if (isBuildTime()) {
    return null;
  }

  const pool = getPostgresPool();

  if (!pool) {
    console.warn(
      '⚠️ PostgreSQL 연결 풀이 없습니다. 클라이언트를 생성할 수 없습니다.'
    );
    return null;
  }

  try {
    const client = await pool.connect();
    // 연결 후 시간대 설정 (pool.on('connect')가 모든 연결에 적용되지 않을 수 있으므로 명시적으로 설정)
    try {
      await client.query("SET timezone = 'Asia/Seoul'");
    } catch (error) {
      console.warn('⚠️ PostgreSQL 시간대 설정 실패:', error.message);
    }
    return client;
  } catch (error) {
    console.error('❌ error PostgreSQL 클라이언트 연결 실패:', error.message);
    console.error('   오류 코드:', error.code);
    throw error;
  }
}

/**
 * 쿼리 실행 헬퍼 함수
 */
export async function query(text, params) {
  // 빌드 시점에는 쿼리 실행하지 않음
  if (isBuildTime()) {
    return { rows: [], rowCount: 0 };
  }

  const pool = getPostgresPool();

  if (!pool) {
    console.warn(
      '⚠️ PostgreSQL 연결 풀이 없습니다. 쿼리를 실행할 수 없습니다.'
    );
    return { rows: [], rowCount: 0 };
  }

  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // 쿼리 로그 비활성화 (필요시 주석 해제)
    // if (process.env.NODE_ENV === 'development') {
    //   console.log('📊 실행된 쿼리:', { text, duration, rows: res.rowCount });
    // }
    return res;
  } catch (error) {
    console.error('❌ error 쿼리 실행 오류:', {
      text: text.substring(0, 100),
      error: error.message,
      code: error.code,
    });

    // 연결 오류인 경우 추가 정보 제공
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('💡 PostgreSQL 연결 문제가 발생했습니다.');
      console.error(
        '   연결 문자열을 확인하세요:',
        (process.env.POSTGRES_URI || process.env.DATABASE_URL || '').replace(
          /:[^:@]+@/,
          ':****@'
        )
      );
    }

    throw error;
  }
}

/**
 * 트랜잭션 실행 헬퍼 함수
 */
export async function transaction(callback) {
  // 빌드 시점에는 트랜잭션 실행하지 않음
  if (isBuildTime()) {
    return null;
  }

  const client = await getPostgresClient();

  if (!client) {
    console.warn(
      '⚠️ PostgreSQL 클라이언트가 없습니다. 트랜잭션을 실행할 수 없습니다.'
    );
    return null;
  }

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 연결 종료
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🔌 PostgreSQL 연결 풀 종료');
  }
}
