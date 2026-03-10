#!/bin/sh
set -e

# 스크립트 시작 시간 기록
START_TIME=$(date +%s)

echo "═══════════════════════════════════════════════════"
echo "🚀 컨테이너 시작 프로세스 시작"
echo "═══════════════════════════════════════════════════"
echo ""

# 환경 정보 출력
echo "📋 환경 정보:"
echo "   Node.js 버전: $(node --version)"
echo "   작업 디렉토리: $(pwd)"
echo "   사용자: $(whoami)"
echo ""

# 1. POSTGRES_URI 환경 변수 확인
echo "🔍 1단계: 환경 변수 검증"
if [ -z "$POSTGRES_URI" ] && [ -z "$DATABASE_URL" ]; then
  echo "❌ POSTGRES_URI 또는 DATABASE_URL 환경 변수가 설정되지 않았습니다."
  echo ""
  echo "💡 해결 방법:"
  echo "   1. docker.env 파일에 POSTGRES_URI를 설정하세요:"
  echo "      POSTGRES_URI=postgresql://user:password@host:port/database"
  echo ""
  echo "   2. docker compose.yml에서 환경 변수를 확인하세요:"
  echo "      environment:"
  echo "        - POSTGRES_URI=\${POSTGRES_URI}"
  echo ""
  echo "   3. 직접 환경 변수를 전달하세요:"
  echo "      docker run -e POSTGRES_URI=\"...\" ..."
  echo ""
  exit 1
fi

# POSTGRES_URI 또는 DATABASE_URL 사용
export POSTGRES_URI="${POSTGRES_URI:-$DATABASE_URL}"
echo "✅ 환경 변수 검증 완료"
echo "📊 PostgreSQL 연결 정보: $(echo $POSTGRES_URI | sed 's/:[^:@]*@/:****@/')"
echo ""

# 2. 필수 디렉토리 존재 확인
echo "🔍 2단계: 필수 디렉토리 확인"
REQUIRED_DIRS="/app/scripts /app/public/uploads"
for dir in $REQUIRED_DIRS; do
  if [ ! -d "$dir" ]; then
    echo "⚠️  디렉토리가 없습니다: $dir"
    mkdir -p "$dir"
    echo "✅ 디렉토리 생성: $dir"
  else
    echo "✅ 디렉토리 존재: $dir"
  fi
done
echo ""

# 3. 데이터베이스 초기화 스크립트 실행 (테이블이 없으면 자동 생성)
echo "🔍 3단계: 데이터베이스 초기화 확인"

# AUTO_INIT_DB 환경 변수로 자동 초기화 제어 (기본값: true)
# false로 설정하면 자동 초기화를 건너뜁니다
AUTO_INIT_DB="${AUTO_INIT_DB:-true}"

if [ "$AUTO_INIT_DB" = "true" ]; then
  echo "🔧 자동 데이터베이스 초기화가 활성화되었습니다."
  echo "   (테이블이 없으면 자동으로 생성됩니다)"
  
  if [ ! -f "/app/scripts/create-postgres-schema.js" ]; then
    echo "❌ 데이터베이스 초기화 스크립트를 찾을 수 없습니다."
    echo "   예상 경로: /app/scripts/create-postgres-schema.js"
    echo ""
    echo "💡 수동 초기화 방법:"
    echo "   docker exec -e POSTGRES_URI=\"\$POSTGRES_URI\" <container_name> node /app/scripts/create-postgres-schema.js"
    echo ""
    exit 1
  fi

  echo "🔧 데이터베이스 초기화 스크립트 실행 중..."
  echo "   (스크립트가 테이블 존재 여부를 확인하고 필요시 생성합니다)"
  echo ""

  # DEBUG 모드 활성화 (필요시)
  if [ "$DEBUG" = "true" ]; then
    export DEBUG=true
    echo "🐛 DEBUG 모드 활성화"
  fi

  # 데이터베이스 초기화 실행
  # create-postgres-schema.js는 테이블이 이미 존재하면 건너뜁니다
  if ! POSTGRES_URI="$POSTGRES_URI" node /app/scripts/create-postgres-schema.js; then
    echo ""
    echo "❌ 데이터베이스 초기화 실패"
    echo ""
    echo "💡 문제 해결 방법:"
    echo "   1. PostgreSQL이 실행 중인지 확인:"
    echo "      docker compose ps"
    echo ""
    echo "   2. PostgreSQL 로그 확인:"
    echo "      docker compose logs postgres"
    echo ""
    echo "   3. 연결 정보 확인:"
    echo "      호스트, 포트, 사용자명, 비밀번호, 데이터베이스명"
    echo ""
    echo "   4. 방화벽 설정 확인"
    echo ""
    exit 1
  fi
else
  echo "⏭️  자동 데이터베이스 초기화가 비활성화되었습니다."
  echo ""
  echo "💡 수동 초기화 방법:"
  echo "   1. 로컬에서: yarn setup-postgres"
  echo "   2. Docker에서: docker exec <container_name> node /app/scripts/create-postgres-schema.js"
  echo "   3. 또는 docker.env에서 AUTO_INIT_DB=true로 설정 (기본값: true)"
  echo ""
  echo "⚠️  데이터베이스 스키마가 없으면 애플리케이션이 정상적으로 작동하지 않을 수 있습니다."
fi

echo ""

# 4. 초기화 완료 및 애플리케이션 시작
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "═══════════════════════════════════════════════════"
echo "✅ 컨테이너 초기화 완료!"
echo "⏱️  총 소요 시간: ${DURATION}초"
echo "═══════════════════════════════════════════════════"
echo ""

# server.js 파일 존재 확인
if [ ! -f "/app/server.js" ]; then
  echo "❌ server.js 파일을 찾을 수 없습니다."
  echo "   예상 경로: /app/server.js"
  echo ""
  echo "💡 확인 사항:"
  echo "   1. Next.js 빌드가 제대로 완료되었는지 확인"
  echo "   2. standalone 모드로 빌드되었는지 확인 (next.config.mjs에서 output: 'standalone' 설정)"
  echo "   3. Dockerfile에서 .next/standalone 복사가 제대로 되었는지 확인"
  echo ""
  echo "📋 현재 디렉토리 내용:"
  ls -la /app/ | head -20
  echo ""
  exit 1
fi

echo "✅ server.js 파일 확인 완료"
echo "🚀 Next.js 애플리케이션 시작 중..."
echo ""
echo "📋 실행할 명령: $@"
echo "📋 현재 작업 디렉토리: $(pwd)"
echo "📋 server.js 파일 정보:"
ls -lh /app/server.js
echo ""

# 원래 명령 실행
echo "▶️  명령 실행 시작..."
exec "$@"

