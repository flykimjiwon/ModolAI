/**
 * 통합 데이터베이스 초기화 스크립트
 *
 * 이 스크립트는 다음을 수행합니다:
 * 1. PostgreSQL 연결 대기 (Docker 환경 대응)
 * 2. 스키마 생성 (테이블이 없는 경우)
 * 3. 기본 데이터 생성 (설정, 공지사항, RAG 설정)
 * 4. 기본 관리자 계정 생성 (admin@modol.ai, 필요한 경우)
 *
 * 사용법:
 *   node scripts/create-postgres-schema.js
 */

// stdout/stderr 버퍼링 비활성화 (Docker 환경에서 즉시 출력)
if (process.stdout.isTTY === false) {
  process.stdout._handle?.setBlocking?.(true);
  process.stderr._handle?.setBlocking?.(true);
}

// Docker 환경에서는 .env.development 파일이 없을 수 있으므로 선택적으로 로드
try {
  require('dotenv').config({ path: '.env.development' });
} catch (e) {
  console.warn('[create-postgres-schema] .env.development 로드 실패:', e?.message);
}

const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');
const {
  createPool,
  waitForDatabase,
  tableExists: dbUtilsTableExists,
  userExists,
  maskConnectionString,
} = require('./db-utils');

const POSTGRES_URI = process.env.POSTGRES_URI || process.env.DATABASE_URL;

// 환경 변수가 필수입니다
if (!POSTGRES_URI) {
  console.error(
    '❌ POSTGRES_URI 또는 DATABASE_URL Environment variable not set.'
  );
  console.error('');
  console.error('💡 환경 변수를 설정하세요:');
  console.error(
    '   POSTGRES_URI=postgresql://사용자명:비밀번호@호스트:포트/데이터베이스명'
  );
  console.error('   또는');
  console.error(
    '   DATABASE_URL=postgresql://사용자명:비밀번호@호스트:포트/데이터베이스명'
  );
  process.exit(1);
}

// db-utils의 createPool을 사용하여 연결 풀 생성
let pool = null;

/**
 * 테이블 존재 여부 확인
 */
async function tableExists(client, tableName) {
  const result = await client.query(
    `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )
  `,
    [tableName]
  );
  return result.rows[0].exists;
}

/**
 * Node.js 스크립트 실행 헬퍼
 */
function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      env: process.env,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(`스크립트 실행 실패: ${scriptPath} (exit code: ${code})`)
        );
      } else {
        resolve();
      }
    });

    child.on('error', (error) => {
      reject(new Error(`스크립트 실행 오류: ${scriptPath} - ${error.message}`));
    });
  });
}

/**
 * 테이블 생성 (존재 여부 확인 후)
 */
async function createTableIfNotExists(
  client,
  tableName,
  createQuery,
  description
) {
  try {
    console.log(`  🔍 ${description} 확인 중...`);
    const exists = await tableExists(client, tableName);
    if (exists) {
      console.log(`  ⏭️  ${description} (이미 존재)`);
      return false;
    } else {
      console.log(`  🔨 ${description} 생성 중...`);
      await client.query(createQuery);
      console.log(`  ✅ ${description} 생성 완료`);
      return true;
    }
  } catch (error) {
    console.error(`  ❌ ${description} 생성 실패:`, error.message);
    if (error.code) {
      console.error(`     오류 코드: ${error.code}`);
    }
    throw error;
  }
}

/**
 * PostgreSQL 스키마 생성
 */
async function createSchema() {
  const client = await pool.connect();

  try {
    console.log('🔗 데이터베이스 클라이언트 연결 완료');

    // 트랜잭션 시작 - 모든 스키마 작업을 원자적으로 실행
    console.log('🔄 트랜잭션 시작...');
    await client.query('BEGIN');
    console.log('✅ 트랜잭션 시작 완료');

    // UUID 확장 활성화
    console.log('📦 UUID 확장 활성화 중...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('✅ UUID 확장 활성화 완료');

    console.log('\n📋 테이블 생성 시작...\n');

    // 1. users 테이블
    await createTableIfNotExists(
      client,
      'users',
      `
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        department VARCHAR(255),
        cell VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '1. users 테이블'
    );

    // 2. chat_rooms 테이블
    await createTableIfNotExists(
      client,
      'chat_rooms',
      `
      CREATE TABLE chat_rooms (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255),
        message_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '2. chat_rooms 테이블'
    );

    // 3. chat_history 테이블
    await createTableIfNotExists(
      client,
      'chat_history',
      `
      CREATE TABLE chat_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant')),
        text TEXT,
        model VARCHAR(255),
        file_references JSONB,
        feedback VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '3. chat_history 테이블'
    );

    // 4. messages 테이블 (관리자 로깅용)
    // 정규화: email, name, department, cell 제거 (users 테이블에서 JOIN으로 조회)
    await createTableIfNotExists(
      client,
      'messages',
      `
      CREATE TABLE messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant')),
        user_role VARCHAR(50) DEFAULT 'user' CHECK (user_role IN ('user', 'admin')),
        model VARCHAR(255),
        text TEXT,
        room_id UUID,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        client_ip VARCHAR(45),
        feedback VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '4. messages 테이블 (관리자 로깅용)'
    );

    // 5. chat_files 테이블
    await createTableIfNotExists(
      client,
      'chat_files',
      `
      CREATE TABLE chat_files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        file_name VARCHAR(255) NOT NULL,
        saved_file_name VARCHAR(255) NOT NULL,
        file_size BIGINT,
        mime_type VARCHAR(255),
        status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error', 'failed')),
        extracted_text TEXT,
        extraction_method VARCHAR(255),
        processed_at TIMESTAMP,
        pdf_metadata JSONB,
        ocr_results JSONB,
        ocr_summary TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '5. chat_files 테이블'
    );

    // chat_files 테이블에 누락된 컬럼들 추가 (기존 테이블이 있는 경우)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_files' AND column_name='extraction_method') THEN
          ALTER TABLE chat_files ADD COLUMN extraction_method VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_files' AND column_name='processed_at') THEN
          ALTER TABLE chat_files ADD COLUMN processed_at TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_files' AND column_name='pdf_metadata') THEN
          ALTER TABLE chat_files ADD COLUMN pdf_metadata JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_files' AND column_name='ocr_results') THEN
          ALTER TABLE chat_files ADD COLUMN ocr_results JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_files' AND column_name='ocr_summary') THEN
          ALTER TABLE chat_files ADD COLUMN ocr_summary TEXT;
        END IF;
        -- status 컬럼에 'failed' 값 추가 (기존 CHECK 제약 조건 수정)
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='chat_files' AND constraint_name LIKE 'chat_files_status_check%') THEN
          ALTER TABLE chat_files DROP CONSTRAINT IF EXISTS chat_files_status_check;
          ALTER TABLE chat_files ADD CONSTRAINT chat_files_status_check CHECK (status IN ('processing', 'completed', 'error', 'failed'));
        END IF;
      END $$;
    `);

    // 6. uploaded_files 테이블
    await createTableIfNotExists(
      client,
      'uploaded_files',
      `
      CREATE TABLE uploaded_files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        file_name VARCHAR(255) NOT NULL,
        saved_file_name VARCHAR(255) NOT NULL,
        file_size BIGINT,
        mime_type VARCHAR(255),
        status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error')),
        extracted_text TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '6. uploaded_files 테이블'
    );

    // 7. settings 테이블
    await createTableIfNotExists(
      client,
      'settings',
      `
      CREATE TABLE settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        config_type VARCHAR(50) DEFAULT 'general',
        multiturn_count INTEGER DEFAULT 10,
        tooltip_enabled BOOLEAN DEFAULT true,
        tooltip_message TEXT,
        chat_widget_enabled BOOLEAN DEFAULT false,
        site_title VARCHAR(255),
        site_description TEXT,
        favicon_url VARCHAR(255),
        file_parsing_model VARCHAR(255),
        file_parsing_enabled BOOLEAN DEFAULT true,
        room_name_generation_model VARCHAR(255),
        max_file_size BIGINT,
        max_files_per_room INTEGER,
        max_total_size_per_room BIGINT,
        supported_image_formats JSONB,
        supported_document_formats JSONB,
        ollama_endpoints TEXT,
        endpoint_type VARCHAR(50),
        custom_endpoints JSONB,
        openai_compat_base VARCHAR(255),
        openai_compat_api_key TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '7. settings 테이블'
    );

    // 7-1. settings 테이블에 room_name_generation_model 컬럼 추가 (기존 DB 호환)
    await client.query(`
      ALTER TABLE settings 
      ADD COLUMN IF NOT EXISTS room_name_generation_model VARCHAR(255)
    `);

    // 8. admin_settings 테이블
    await createTableIfNotExists(
      client,
      'admin_settings',
      `
      CREATE TABLE admin_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        config_type VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        settings JSONB
      )
    `,
      '8. admin_settings 테이블'
    );

    // 9. model_config 테이블
    await createTableIfNotExists(
      client,
      'model_config',
      `
      CREATE TABLE model_config (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        config_type VARCHAR(50) DEFAULT 'model',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        config JSONB
      )
    `,
      '9. model_config 테이블'
    );

    // 9-1. model_categories 테이블 (모델 카테고리)
    await createTableIfNotExists(
      client,
      'model_categories',
      `
      CREATE TABLE model_categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_key VARCHAR(50) UNIQUE NOT NULL,
        label VARCHAR(255) NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '9-1. model_categories 테이블 (모델 카테고리)'
    );

    // 9-2. models 테이블 (모델 정보)
    await createTableIfNotExists(
      client,
      'models',
      `
      CREATE TABLE models (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_id UUID REFERENCES model_categories(id) ON DELETE CASCADE,
        model_name VARCHAR(255) NOT NULL,
        label VARCHAR(255) NOT NULL,
        tooltip TEXT,
        is_default BOOLEAN DEFAULT false,
        admin_only BOOLEAN DEFAULT false,
        system_prompt TEXT[],
        endpoint VARCHAR(500),
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '9-2. models 테이블 (모델 정보)'
    );

    // models 테이블에 endpoint 컬럼 추가 (기존 테이블이 있는 경우)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='models' AND column_name='endpoint') THEN
          ALTER TABLE models ADD COLUMN endpoint VARCHAR(500);
        END IF;
      END $$;
    `);

    // 10. prompt_config 테이블
    await createTableIfNotExists(
      client,
      'prompt_config',
      `
      CREATE TABLE prompt_config (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        config_type VARCHAR(50) DEFAULT 'prompt',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        config JSONB
      )
    `,
      '10. prompt_config 테이블'
    );

    // 11. model_logs 테이블
    await createTableIfNotExists(
      client,
      'model_logs',
      `
      CREATE TABLE model_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        instance_id VARCHAR(255),
        instance_type VARCHAR(255),
        type VARCHAR(255),
        level VARCHAR(50),
        category VARCHAR(255),
        method VARCHAR(50),
        endpoint VARCHAR(255),
        model VARCHAR(255),
        message TEXT,
        error TEXT,
        metadata JSONB,
        provider VARCHAR(255),
        client_ip VARCHAR(45),
        user_agent TEXT,
        response_time INTEGER,
        status_code INTEGER,
        is_stream BOOLEAN,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        total_tokens INTEGER,
        has_files BOOLEAN,
        file_count INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '11. model_logs 테이블'
    );

    // 12. model_server 테이블
    await createTableIfNotExists(
      client,
      'model_server',
      `
      CREATE TABLE model_server (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        endpoint VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      )
    `,
      '12. model_server 테이블'
    );

    // name UNIQUE 제약 조건 추가 (기존 테이블에 대해) - DO 블록으로 안전하게 처리
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'model_server_name_unique' 
          AND conrelid = 'model_server'::regclass
        ) THEN
          ALTER TABLE model_server ADD CONSTRAINT model_server_name_unique UNIQUE (name);
        END IF;
      END $$;
    `);

    // 13. model_server_error_history 테이블 (모델 Server error 이력)
    await createTableIfNotExists(
      client,
      'model_server_error_history',
      `
      CREATE TABLE model_server_error_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        endpoint_url VARCHAR(500) NOT NULL,
        endpoint_name VARCHAR(255),
        provider VARCHAR(50) NOT NULL,
        error_message TEXT NOT NULL,
        error_type VARCHAR(100),
        response_time INTEGER,
        status VARCHAR(50) DEFAULT 'unhealthy',
        checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      )
    `,
      '13. model_server_error_history 테이블 (모델 Server error 이력)'
    );

    // 인덱스는 아래 배치 처리로 이동

    // 14. model_server_status 테이블
    await createTableIfNotExists(
      client,
      'model_server_status',
      `
      CREATE TABLE model_server_status (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        instance_id VARCHAR(255) UNIQUE NOT NULL,
        instance_type VARCHAR(255),
        hostname VARCHAR(255),
        port INTEGER,
        pid INTEGER,
        node_version VARCHAR(50),
        environment VARCHAR(50),
        last_heartbeat TIMESTAMP,
        uptime BIGINT,
        memory_usage JSONB,
        cpu_usage JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '14. model_server_status 테이블'
    );

    // 14-1. external_api_prompts 테이블 (프롬프트/메시지 전체 데이터 저장)
    await createTableIfNotExists(
      client,
      'external_api_prompts',
      `
      CREATE TABLE external_api_prompts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        prompt TEXT,
        messages JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '14-1. external_api_prompts 테이블 (프롬프트/메시지 전체 데이터 저장)'
    );

    // 14-2. external_api_logs 테이블
    // 정규화: user_email, user_name, user_role, user_department, user_cell 제거 (users 테이블에서 JOIN으로 조회)
    await createTableIfNotExists(
      client,
      'external_api_logs',
      `
      CREATE TABLE external_api_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        api_type VARCHAR(50),
        endpoint VARCHAR(255),
        model VARCHAR(255),
        provider VARCHAR(255),
        prompt_id UUID REFERENCES external_api_prompts(id) ON DELETE SET NULL,
        prompt TEXT,
        messages JSONB,
        response_token_count INTEGER DEFAULT 0,
        prompt_token_count INTEGER DEFAULT 0,
        total_token_count INTEGER DEFAULT 0,
        response_time INTEGER,
        first_response_time INTEGER,
        final_response_time INTEGER,
        status_code INTEGER,
        is_stream BOOLEAN DEFAULT false,
        error TEXT,
        retry_count INTEGER DEFAULT 1,
        client_ip VARCHAR(45),
        user_agent TEXT,
        x_forwarded_for VARCHAR(255),
        x_real_ip VARCHAR(45),
        x_forwarded_proto VARCHAR(50),
        x_forwarded_host VARCHAR(255),
        client_tool VARCHAR(255),
        client_tool_version VARCHAR(255),
        operating_system VARCHAR(255),
        architecture VARCHAR(255),
        accept_language VARCHAR(255),
        accept_encoding VARCHAR(255),
        accept_charset VARCHAR(255),
        referer VARCHAR(255),
        origin VARCHAR(255),
        "authorization" TEXT,
        content_type VARCHAR(255),
        x_requested_with VARCHAR(255),
        x_client_name VARCHAR(255),
        x_client_version VARCHAR(255),
        x_user_name VARCHAR(255),
        x_workspace VARCHAR(255),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        token_hash VARCHAR(255),
        token_name VARCHAR(255),
        request_time TIMESTAMP,
        timezone VARCHAR(50),
        session_hash VARCHAR(50),
        fingerprint_hash VARCHAR(50),
        user_identifier VARCHAR(50),
        conversation_id VARCHAR(50),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        source VARCHAR(50) DEFAULT 'external_api'
      )
    `,
      '14-2. external_api_logs 테이블'
    );

    // external_api_logs 테이블에 누락된 컬럼들 추가 (기존 테이블이 있는 경우) - 통합
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='external_api_logs' AND column_name='request_headers') THEN
          ALTER TABLE external_api_logs ADD COLUMN request_headers JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='external_api_logs' AND column_name='request_body') THEN
          ALTER TABLE external_api_logs ADD COLUMN request_body JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='external_api_logs' AND column_name='response_headers') THEN
          ALTER TABLE external_api_logs ADD COLUMN response_headers JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='external_api_logs' AND column_name='response_body') THEN
          ALTER TABLE external_api_logs ADD COLUMN response_body JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='external_api_logs' AND column_name='prompt_id') THEN
          ALTER TABLE external_api_logs ADD COLUMN prompt_id UUID REFERENCES external_api_prompts(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='external_api_logs' AND column_name='conversation_id') THEN
          ALTER TABLE external_api_logs ADD COLUMN conversation_id VARCHAR(50);
        END IF;
      END $$;
    `);

    // 15. api_tokens 테이블
    await createTableIfNotExists(
      client,
      'api_tokens',
      `
      CREATE TABLE api_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        encrypted_token TEXT,
        name VARCHAR(255),
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '15. api_tokens 테이블'
    );

    // api_tokens 테이블에 누락된 필드 추가 (기존 테이블이 있는 경우)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_tokens' AND column_name='encrypted_token') THEN
          ALTER TABLE api_tokens ADD COLUMN encrypted_token TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_tokens' AND column_name='expires_at') THEN
          ALTER TABLE api_tokens ADD COLUMN expires_at TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_tokens' AND column_name='is_active') THEN
          ALTER TABLE api_tokens ADD COLUMN is_active BOOLEAN DEFAULT true;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_tokens' AND column_name='created_by') THEN
          ALTER TABLE api_tokens ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_tokens' AND column_name='updated_at') THEN
          ALTER TABLE api_tokens ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        END IF;
      END $$;
    `);

    // 16. notices 테이블
    await createTableIfNotExists(
      client,
      'notices',
      `
      CREATE TABLE notices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        content TEXT,
        is_popup BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        author_id UUID REFERENCES users(id) ON DELETE SET NULL,
        author_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '16. notices 테이블'
    );

    // 17. user_chats 테이블
    await createTableIfNotExists(
      client,
      'user_chats',
      `
      CREATE TABLE user_chats (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '17. user_chats 테이블'
    );

    // 18. qa_logs 테이블
    await createTableIfNotExists(
      client,
      'qa_logs',
      `
      CREATE TABLE qa_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        log_data JSONB
      )
    `,
      '18. qa_logs 테이블'
    );

    // 19. rag_documents 테이블
    await createTableIfNotExists(
      client,
      'rag_documents',
      `
      CREATE TABLE rag_documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL CHECK (category IN ('text', 'pdf', 'word', 'excel', 'powerpoint', 'image', 'other')),
        subcategory VARCHAR(255),
        tags TEXT[],
        status VARCHAR(50) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'indexed', 'vectorizing', 'vectorized', 'error')),
        processing_started_at TIMESTAMP,
        processing_completed_at TIMESTAMP,
        vectorization_started_at TIMESTAMP,
        vectorization_completed_at TIMESTAMP,
        vectorization_progress INTEGER DEFAULT 0 CHECK (vectorization_progress >= 0 AND vectorization_progress <= 100),
        error_message TEXT,
        extracted_text TEXT,
        text_length INTEGER,
        chunk_count INTEGER DEFAULT 0,
        vectors JSONB,
        embedding_model VARCHAR(255),
        description TEXT,
        priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
        uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        search_count INTEGER DEFAULT 0,
        last_searched_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '19. rag_documents 테이블'
    );

    // 20. rag_models 테이블
    await createTableIfNotExists(
      client,
      'rag_models',
      `
      CREATE TABLE rag_models (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        description TEXT,
        base_model VARCHAR(255) NOT NULL,
        embedding_model VARCHAR(255) NOT NULL,
        rag_settings JSONB,
        generation_params JSONB,
        selected_documents UUID[],
        document_filters JSONB,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
        is_default BOOLEAN DEFAULT false,
        usage_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `,
      '20. rag_models 테이블'
    );

    // 21. rag_settings 테이블
    await createTableIfNotExists(
      client,
      'rag_settings',
      `
      CREATE TABLE rag_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        chunk_size INTEGER DEFAULT 1024 CHECK (chunk_size >= 128 AND chunk_size <= 4096),
        chunk_overlap INTEGER DEFAULT 20 CHECK (chunk_overlap >= 0 AND chunk_overlap <= 512),
        embedding_model VARCHAR(255) NOT NULL DEFAULT 'nomic-embed-text',
        embedding_dimensions INTEGER DEFAULT 768,
        similarity_top_k INTEGER DEFAULT 3 CHECK (similarity_top_k >= 1 AND similarity_top_k <= 10),
        similarity_threshold DECIMAL(3,2) DEFAULT 0.7 CHECK (similarity_threshold >= 0.1 AND similarity_threshold <= 1.0),
        vector_db_path VARCHAR(255) DEFAULT './data/lancedb',
        table_name VARCHAR(255) DEFAULT 'documents',
        response_mode VARCHAR(50) DEFAULT 'compact' CHECK (response_mode IN ('compact', 'refine', 'tree_summarize', 'simple_summarize')),
        max_tokens INTEGER DEFAULT 2048 CHECK (max_tokens >= 256 AND max_tokens <= 8192),
        temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0.0 AND temperature <= 2.0),
        system_prompt TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `,
      '21. rag_settings 테이블'
    );

    // 22. direct_messages 테이블 (쪽지)
    await createTableIfNotExists(
      client,
      'direct_messages',
      `
      CREATE TABLE direct_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
        recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        deleted_by_recipient BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
      '22. direct_messages 테이블 (쪽지)'
    );

    // 23. agent_permissions 테이블 (에이전트 접근 권한)
    await createTableIfNotExists(
      client,
      'agent_permissions',
      `
      CREATE TABLE agent_permissions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_id VARCHAR(50) NOT NULL,
        permission_type VARCHAR(50) NOT NULL CHECK (permission_type IN ('all', 'role', 'department', 'user')),
        permission_value VARCHAR(255),
        is_allowed BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agent_id, permission_type, permission_value)
      )
    `,
      '23. agent_permissions 테이블 (에이전트 접근 권한)'
    );

    // model_logs 테이블에 누락된 컬럼들 추가 (기존 테이블이 있는 경우) - 통합
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='type') THEN
          ALTER TABLE model_logs ADD COLUMN type VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='user_id') THEN
          ALTER TABLE model_logs ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='method') THEN
          ALTER TABLE model_logs ADD COLUMN method VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='endpoint') THEN
          ALTER TABLE model_logs ADD COLUMN endpoint VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='model') THEN
          ALTER TABLE model_logs ADD COLUMN model VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='error') THEN
          ALTER TABLE model_logs ADD COLUMN error TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='provider') THEN
          ALTER TABLE model_logs ADD COLUMN provider VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='client_ip') THEN
          ALTER TABLE model_logs ADD COLUMN client_ip VARCHAR(45);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='user_agent') THEN
          ALTER TABLE model_logs ADD COLUMN user_agent TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='response_time') THEN
          ALTER TABLE model_logs ADD COLUMN response_time INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='status_code') THEN
          ALTER TABLE model_logs ADD COLUMN status_code INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='is_stream') THEN
          ALTER TABLE model_logs ADD COLUMN is_stream BOOLEAN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='prompt_tokens') THEN
          ALTER TABLE model_logs ADD COLUMN prompt_tokens INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='completion_tokens') THEN
          ALTER TABLE model_logs ADD COLUMN completion_tokens INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='total_tokens') THEN
          ALTER TABLE model_logs ADD COLUMN total_tokens INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='has_files') THEN
          ALTER TABLE model_logs ADD COLUMN has_files BOOLEAN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='model_logs' AND column_name='file_count') THEN
          ALTER TABLE model_logs ADD COLUMN file_count INTEGER;
        END IF;
      END $$;
    `);

    console.log('\n📊 인덱스 생성 중...\n');

    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
      'CREATE INDEX IF NOT EXISTS idx_chat_rooms_user_id ON chat_rooms(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_chat_history_room_id ON chat_history(room_id)',
      'CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_chat_files_room_id ON chat_files(room_id)',
      'CREATE INDEX IF NOT EXISTS idx_model_server_error_history_endpoint ON model_server_error_history(endpoint_url, checked_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_model_server_error_history_provider ON model_server_error_history(provider, checked_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_external_api_logs_timestamp ON external_api_logs(timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_external_api_logs_user_id ON external_api_logs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_external_api_logs_conversation_id ON external_api_logs(conversation_id)',
      'CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash ON api_tokens(token_hash)',
      'CREATE INDEX IF NOT EXISTS idx_notices_is_active ON notices(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON rag_documents(status)',
      'CREATE INDEX IF NOT EXISTS idx_rag_documents_category ON rag_documents(category)',
      'CREATE INDEX IF NOT EXISTS idx_rag_documents_uploaded_by ON rag_documents(uploaded_by)',
      'CREATE INDEX IF NOT EXISTS idx_rag_documents_uploaded_at ON rag_documents(uploaded_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_rag_models_status ON rag_models(status)',
      'CREATE INDEX IF NOT EXISTS idx_rag_models_is_default ON rag_models(is_default)',
      'CREATE INDEX IF NOT EXISTS idx_model_server_status_instance_id ON model_server_status(instance_id)',
      'CREATE INDEX IF NOT EXISTS idx_models_category_id ON models(category_id)',
      'CREATE INDEX IF NOT EXISTS idx_models_model_name ON models(model_name)',
      'CREATE INDEX IF NOT EXISTS idx_models_is_default ON models(is_default)',
      'CREATE INDEX IF NOT EXISTS idx_model_categories_display_order ON model_categories(display_order)',
      'CREATE INDEX IF NOT EXISTS idx_model_logs_user_id ON model_logs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages(recipient_id)',
      'CREATE INDEX IF NOT EXISTS idx_dm_unread ON direct_messages(recipient_id, is_read)',
      'CREATE INDEX IF NOT EXISTS idx_dm_created ON direct_messages(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_dm_deleted ON direct_messages(recipient_id, deleted_by_recipient)',
      'CREATE INDEX IF NOT EXISTS idx_agent_permissions_agent_id ON agent_permissions(agent_id)',
      'CREATE INDEX IF NOT EXISTS idx_agent_permissions_type ON agent_permissions(permission_type)',
    ];

    // 인덱스를 순차 실행 (트랜잭션 내에서 안전하게 처리)
    console.log('\n📊 인덱스 생성 중...\n');
    for (let i = 0; i < indexQueries.length; i++) {
      const query = indexQueries[i];
      try {
        await client.query(query);
        if ((i + 1) % 5 === 0 || i === indexQueries.length - 1) {
          console.log(
            `  ✅ 인덱스 생성 진행 중... (${i + 1}/${indexQueries.length})`
          );
        }
      } catch (error) {
        console.error(
          `  ❌ 인덱스 생성 실패 (${i + 1}/${indexQueries.length}):`,
          error.message
        );
        throw error;
      }
    }
    console.log('✅ 모든 인덱스 생성 완료\n');

    // 트랜잭션 커밋
    console.log('💾 트랜잭션 커밋 중...');
    await client.query('COMMIT');
    console.log('✅ 트랜잭션 커밋 완료');
    console.log('✅ 스키마 생성 완료');
  } catch (error) {
    // 오류 발생 시 롤백
    console.error('\n❌ 오류 발생! 트랜잭션 롤백 중...');
    try {
      await client.query('ROLLBACK');
      console.error('✅ 트랜잭션 롤백 완료');
    } catch (rollbackError) {
      console.error('⚠️  롤백 중 오류:', rollbackError.message);
    }
    console.error('❌ 스키마 생성 실패:', error.message);
    if (error.code) {
      console.error(`   오류 코드: ${error.code}`);
    }
    if (error.stack && process.env.DEBUG) {
      console.error('\n상세 오류 스택:');
      console.error(error.stack);
    }
    throw error;
  } finally {
    console.log('🔌 데이터베이스 클라이언트 연결 해제 중...');
    client.release();
    console.log('✅ 데이터베이스 클라이언트 연결 해제 완료');
  }
}

/**
 * 기본 데이터 생성
 */
async function setupDefaultData() {
  const client = await pool.connect();

  try {
    // 기본 설정 생성
    const settingsResult = await client.query(
      'SELECT COUNT(*) FROM settings WHERE config_type = $1',
      ['general']
    );

    if (parseInt(settingsResult.rows[0].count) === 0) {
      console.log('기본 설정 생성 중...');
      await client.query(
        `INSERT INTO settings (config_type, multiturn_count, tooltip_enabled, tooltip_message)
         VALUES ($1, $2, $3, $4)`,
        ['general', 10, true, '더 고성능의 모델도 사용할 수 있어요']
      );
      console.log('✅ 기본 설정 생성 완료');
    }

    // 공지사항 생성
    const adminResult = await client.query(
      'SELECT id, name FROM users WHERE role = $1 LIMIT 1',
      ['admin']
    );

    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      const noticeResult = await client.query('SELECT COUNT(*) FROM notices');

      if (parseInt(noticeResult.rows[0].count) === 0) {
        console.log('공지사항 생성 중...');
        await client.query(
          `INSERT INTO notices (title, content, is_popup, is_active, author_id, author_name)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            '환영합니다!',
            '시스템이 성공적으로 설치되었습니다.',
            true,
            true,
            admin.id,
            admin.name,
          ]
        );
        console.log('✅ 공지사항 생성 완료');
      }
    }

    // RAG 설정 생성
    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      const ragSettingsResult = await client.query(
        'SELECT COUNT(*) FROM rag_settings'
      );

      if (parseInt(ragSettingsResult.rows[0].count) === 0) {
        console.log('RAG 설정 생성 중...');
        await client.query(
          `INSERT INTO rag_settings (updated_by)
           VALUES ($1)`,
          [admin.id]
        );
        console.log('✅ RAG 설정 생성 완료');
      }
    }
  } catch (error) {
    console.error('❌ error 기본 데이터 생성 실패:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 메인 초기화 함수
 */
async function initializeDatabase() {
  const startTime = Date.now();

  try {
    console.log('═══════════════════════════════════════════════════');
    console.log('🚀 데이터베이스 초기화 시작');
    console.log('═══════════════════════════════════════════════════\n');

    // 1. 환경 변수 검증
    console.log('📊 PostgreSQL 연결 정보:', maskConnectionString(POSTGRES_URI));
    console.log('');

    // 2. PostgreSQL 연결 풀 생성
    console.log('🔌 PostgreSQL 연결 풀 생성 중...');
    pool = createPool();
    console.log('✅ 연결 풀 생성 완료\n');

    // 3. PostgreSQL 연결 대기 (Docker 환경 대응)
    await waitForDatabase(pool);
    console.log('');

    // 4. 스키마 존재 여부 확인
    console.log('🔍 데이터베이스 스키마 확인 중...');
    const client = await pool.connect();
    const hasSchema = await dbUtilsTableExists(client, 'users');
    client.release();

    // 5. 스키마 생성 (필요한 경우)
    if (!hasSchema) {
      console.log('📋 데이터베이스 스키마가 없습니다. 생성을 시작합니다...\n');
      try {
        await createSchema();
        console.log('\n✅ 스키마 생성 완료\n');
      } catch (schemaError) {
        console.error('\n❌ 스키마 생성 중 오류 발생');
        console.error('오류 메시지:', schemaError.message);
        if (schemaError.code) {
          console.error('오류 코드:', schemaError.code);
        }
        throw schemaError;
      }
    } else {
      console.log('✅ 데이터베이스 스키마가 Already exists.\n');
    }

    // 6. 기본 데이터 생성
    console.log('🔍 기본 데이터 확인 중...');
    await setupDefaultData();
    console.log('');

    // 7. 관리자 계정 확인
    console.log('🔍 관리자 계정 확인 중...');
    const client2 = await pool.connect();
     const hasAdmin = await userExists(client2, 'admin@modol.ai');
    client2.release();

    // 8. 관리자 계정 생성 (필요한 경우)
    if (!hasAdmin) {
      console.log('👤 기본 관리자 계정이 없습니다. 생성을 시작합니다...\n');
      const adminScriptPath = path.join(__dirname, 'create-admin.js');

      try {
        await runScript(adminScriptPath);
        console.log('\n✅ 관리자 계정 생성 완료\n');
      } catch (error) {
        throw new Error(`관리자 계정 생성 실패: ${error.message}`);
      }
    } else {
       console.log(
         '✅ 기본 관리자 계정(admin@modol.ai)이 Already exists.\n'
       );
    }

    // 9. 초기화 완료
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ 데이터베이스 초기화 완료!');
    console.log(`⏱️  소요 시간: ${duration}초`);
    console.log('═══════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 데이터베이스 초기화 실패');
    console.error('═══════════════════════════════════════════════════');
    console.error(`오류: ${error.message}`);

    if (error.stack && process.env.DEBUG) {
      console.error('\n상세 오류 (DEBUG 모드):');
      console.error(error.stack);
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('');
      console.error('💡 PostgreSQL이 실행 중인지 확인하세요:');
      console.error('   1. PostgreSQL 설치 확인: psql --version');
      console.error(
        '   2. PostgreSQL 실행 확인: brew services list (macOS) 또는 systemctl status postgresql (Linux)'
      );
      console.error(
        '   3. PostgreSQL 시작: brew services start postgresql (macOS)'
      );
      console.error('   4. 데이터베이스 생성: createdb modol');
      console.error('');
      console.error('   또는 Docker를 사용하는 경우:');
      console.error(
        '   docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=modol -p 5432:5432 postgres:15'
      );
    }

    console.error('═══════════════════════════════════════════════════\n');
    process.exit(1);
  } finally {
    // 연결 정리
    if (pool) {
      try {
        await pool.end();
        console.log('🔌 PostgreSQL 연결 종료\n');
      } catch (error) {
        console.error('⚠️  연결 종료 중 오류:', error.message);
      }
    }
  }
}

// 스크립트가 직접 실행된 경우에만 실행
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
