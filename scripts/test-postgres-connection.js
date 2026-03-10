#!/usr/bin/env node

/**
 * PostgreSQL 연결 테스트 스크립트
 *
 * 사용법:
 *   node scripts/test-postgres-connection.js
 */

require('dotenv').config({ path: '.env.development' });
const { Pool } = require('pg');

const POSTGRES_URI = process.env.POSTGRES_URI || process.env.DATABASE_URL;

if (!POSTGRES_URI) {
  console.error(
    '❌ error POSTGRES_URI 또는 DATABASE_URL이 .env.development에 정의되지 않았습니다.'
  );
  console.error('');
  console.error('💡 해결 방법:');
  console.error('   .env.development 파일에 다음을 추가하세요:');
  console.error(
    '   POSTGRES_URI=postgresql://사용자명:비밀번호@호스트:포트/데이터베이스명'
  );
  console.error('');
  console.error('   또는 DATABASE_URL 환경 변수를 사용할 수 있습니다:');
  console.error(
    '   DATABASE_URL=postgresql://사용자명:비밀번호@호스트:포트/데이터베이스명'
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: POSTGRES_URI,
  connectionTimeoutMillis: 10000,
});

async function testConnection() {
  console.log('🔌 PostgreSQL 연결 테스트 시작...');
  console.log(`   연결 문자열: ${POSTGRES_URI.replace(/:[^:@]+@/, ':****@')}`);
  console.log('');

  let client;
  try {
    // 연결 시도
    console.log('📡 연결 시도 중...');
    client = await pool.connect();
    console.log('✅ 연결 성공!');
    console.log('');

    // 간단한 쿼리 테스트
    console.log('📊 쿼리 테스트 중...');
    const result = await client.query(
      'SELECT NOW() as current_time, version() as pg_version'
    );
    console.log('✅ 쿼리 실행 성공!');
    console.log('');
    console.log('📋 PostgreSQL 정보:');
    console.log(`   현재 시간: ${result.rows[0].current_time}`);
    console.log(`   버전: ${result.rows[0].pg_version.split(',')[0]}`);
    console.log('');

    // 데이터베이스 목록 확인
    console.log('📋 데이터베이스 목록:');
    const dbResult = await client.query(
      'SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname'
    );
    dbResult.rows.forEach((row) => {
      const marker = row.datname === 'modol' ? ' ✅' : '';
      console.log(`   - ${row.datname}${marker}`);
    });
    console.log('');

    // modol 데이터베이스에 연결 시도
    if (POSTGRES_URI.includes('/modol')) {
      console.log('📊 modol 데이터베이스 테이블 확인 중...');
      try {
        const tablesResult = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name
        `);

        if (tablesResult.rows.length > 0) {
          console.log(`✅ ${tablesResult.rows.length}개의 테이블 발견:`);
          tablesResult.rows.forEach((row) => {
            console.log(`   - ${row.table_name}`);
          });
        } else {
          console.log('⚠️  테이블이 없습니다. 스키마를 생성해야 합니다.');
          console.log('   실행: npm run setup-postgres');
        }
      } catch (err) {
        console.log('⚠️  테이블 조회 실패:', err.message);
      }
    }

    console.log('');
    console.log('✅ 모든 테스트 통과!');
  } catch (error) {
    console.error('');
    console.error('❌ error 연결 실패:', error.message);
    console.error('   오류 코드:', error.code);
    console.error('');

    // 구체적인 오류 메시지 제공
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 PostgreSQL 서버에 연결할 수 없습니다.');
      console.error('');
      console.error('   확인 사항:');
      console.error('   1. PostgreSQL이 실행 중인지 확인:');
      console.error('      - macOS: brew services list | grep postgresql');
      console.error('      - Linux: systemctl status postgresql');
      console.error('      - Docker: docker ps | grep postgres');
      console.error('');
      console.error('   2. PostgreSQL 시작:');
      console.error('      - macOS: brew services start postgresql@15');
      console.error('      - Linux: sudo systemctl start postgresql');
      console.error('      - Docker: docker compose up -d postgres');
      console.error('');
      console.error('   3. 포트 확인:');
      console.error('      - lsof -i :5432 (macOS/Linux)');
      console.error('      - netstat -an | grep 5432 (Windows)');
    } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      console.error('💡 호스트를 Not found.');
      console.error('');
      console.error('   확인 사항:');
      console.error('   1. 호스트 이름이 올바른지 확인');
      console.error('   2. Docker를 사용하는 경우:');
      console.error('      - 컨테이너 이름이 올바른지 확인');
      console.error('      - 같은 네트워크에 있는지 확인');
      console.error('      - docker compose.yml의 서비스 이름 확인');
    } else if (error.code === '28P01' || error.message.includes('password')) {
      console.error('💡 인증 실패: 사용자명 또는 비밀번호가 잘못되었습니다.');
      console.error('');
      console.error('   확인 사항:');
      console.error('   1. POSTGRES_URI의 사용자명과 비밀번호 확인');
      console.error('   2. PostgreSQL 사용자 확인:');
      console.error('      psql -U postgres -c "\\du"');
    } else if (error.code === '3D000') {
      console.error('💡 데이터베이스가 존재하지 않습니다.');
      console.error('');
      console.error('   해결 방법:');
      console.error('   1. 데이터베이스 생성:');
      console.error('      createdb modol');
      console.error('   2. 또는 스키마 생성 스크립트 실행:');
      console.error('      npm run setup-postgres');
    } else {
      console.error('💡 일반적인 해결 방법:');
      console.error('   1. PostgreSQL이 실행 중인지 확인');
      console.error('   2. 연결 문자열 형식 확인:');
      console.error(
        '      postgresql://사용자명:비밀번호@호스트:포트/데이터베이스명'
      );
      console.error('   3. 방화벽 설정 확인');
      console.error('   4. PostgreSQL 로그 확인');
    }

    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('🔌 연결 종료');
  }
}

testConnection();
