# syntax=docker/dockerfile:1.7

# ============================================================================
# 베이스 이미지 (빌드용 - 빌드 도구 포함)
# ============================================================================
# 폐쇄망 환경 대응: node:22-bookworm 사용 (slim보다 더 많은 패키지 포함)
# 이 이미지에는 python3, curl, ca-certificates 등 기본 패키지가 포함되어 있음
FROM node:22-bookworm AS base-build
WORKDIR /app

# 빌드 시 필요한 의존성 설치
# 폐쇄망 환경 대응: SKIP_APT_INSTALL 환경 변수로 패키지 설치 건너뛰기 가능
# 기본적으로는 설치를 시도하되, 실패해도 빌드가 계속 진행되도록 처리
ARG SKIP_APT_INSTALL=false
RUN if [ "$SKIP_APT_INSTALL" != "true" ]; then \
        (apt-get update || true) 2>/dev/null && \
        (apt-get install -y --no-install-recommends \
            ca-certificates \
            curl \
            python3 \
            build-essential \
            pkg-config \
            libcairo2-dev \
            libpango1.0-dev \
            libjpeg62-turbo-dev \
            libgif-dev \
            librsvg2-dev 2>/dev/null || \
            echo "Warning: Package installation skipped or failed. Using packages from base image.") && \
        (rm -rf /var/lib/apt/lists/* || true); \
    else \
        echo "Skipping apt-get install (SKIP_APT_INSTALL=true)"; \
    fi

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Seoul

# ============================================================================
# 런타임 베이스 이미지 (빌드 도구 제외, 런타임 라이브러리만)
# ============================================================================
# 폐쇄망 환경 대응: node:22-bookworm 사용 (slim보다 더 많은 패키지 포함)
# 이 이미지에는 기본 런타임 라이브러리들이 포함되어 있을 수 있음
FROM node:22-bookworm AS base-runtime
WORKDIR /app

# 런타임 의존성 설치 (빌드 도구 제외)
# 폐쇄망 환경 대응: SKIP_APT_INSTALL 환경 변수로 패키지 설치 건너뛰기 가능
# 기본적으로는 설치를 시도하되, 실패해도 빌드가 계속 진행되도록 처리
ARG SKIP_APT_INSTALL=false
RUN if [ "$SKIP_APT_INSTALL" != "true" ]; then \
        (apt-get update || true) 2>/dev/null && \
        (apt-get install -y --no-install-recommends \
            ca-certificates \
            tini \
            libcairo2 \
            libpango-1.0-0 \
            libjpeg62-turbo \
            libgif7 \
            librsvg2-2 \
            poppler-utils \
            graphicsmagick \
            ghostscript \
            pandoc 2>/dev/null || \
            echo "Warning: Package installation skipped or failed. Using packages from base image.") && \
        (rm -rf /var/lib/apt/lists/* || true); \
    else \
        echo "Skipping apt-get install (SKIP_APT_INSTALL=true)"; \
        # tini는 별도로 설치 필요 (없으면 ENTRYPOINT에서 직접 node 실행)
        (which tini > /dev/null || echo "Warning: tini not found, will use node directly") || true; \
    fi

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Seoul

# ============================================================================
# 의존성 설치 단계 (빌드용 - devDependencies 포함)
# ============================================================================
FROM base-build AS deps

# package.json과 yarn.lock만 먼저 복사하여 의존성 레이어 캐싱 최적화
# 이 파일들이 변경되지 않으면 이 레이어는 재사용되어 빌드 시간 단축
COPY package.json yarn.lock ./

# 의존성 설치 시 devDependencies도 포함하기 위해 development 설정
ENV NODE_ENV=development

# BuildKit 캐시 마운트로 yarn 캐시 재사용
# 폐쇄망 환경에서도 캐시를 활용하여 의존성 설치 속도 향상
# SSL 인증서 검증 비활성화 (self-signed certificate 오류 해결)
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn,sharing=locked \
    --mount=type=cache,target=/root/.cache,sharing=locked \
    yarn config set strict-ssl false && \
    yarn install --frozen-lockfile --network-timeout 600000

# ============================================================================
# 프로덕션 의존성만 설치하는 단계
# ============================================================================
FROM base-build AS prod-deps

# package.json과 yarn.lock만 먼저 복사하여 의존성 레이어 캐싱 최적화
COPY package.json yarn.lock ./

RUN --mount=type=cache,target=/usr/local/share/.cache/yarn,sharing=locked \
    --mount=type=cache,target=/root/.cache,sharing=locked \
    yarn config set strict-ssl false && \
    yarn install --frozen-lockfile --production --network-timeout 600000 \
    && yarn cache clean \
    && find node_modules -name "*.map" -type f -delete \
    && find node_modules -name "*.test.js" -type f -delete \
    && find node_modules -name "*.test.ts" -type f -delete \
    && find node_modules -name "*.test.tsx" -type f -delete \
    && find node_modules -name "*.spec.js" -type f -delete \
    && find node_modules -name "*.spec.ts" -type f -delete \
    && find node_modules -name "*.spec.tsx" -type f -delete \
    && find node_modules -name "*.test.d.ts" -type f -delete \
    && find node_modules -name "*.spec.d.ts" -type f -delete \
    && find node_modules -name "README.md" -type f -delete \
    && find node_modules -name "README.txt" -type f -delete \
    && find node_modules -name "CHANGELOG.md" -type f -delete \
    && find node_modules -name "CHANGELOG.txt" -type f -delete \
    && find node_modules -name "HISTORY.md" -type f -delete \
    && find node_modules -name "LICENSE" -type f -delete \
    && find node_modules -name "LICENSE.txt" -type f -delete \
    && find node_modules -name "LICENSE.md" -type f -delete \
    && find node_modules -name "NOTICE" -type f -delete \
    && find node_modules -name "*.md" -type f -delete \
    && find node_modules -name "*.txt" ! -name "*.min.txt" -type f -delete \
    && find node_modules -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -type d -name "__test__" -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -type d -name "test" -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -type d -name "docs" -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -type d -name "doc" -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -type d -name "examples" -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -type d -name "example" -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -type d -name "coverage" -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -type d -name ".github" -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -type d -name ".nyc_output" -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -type d -name "benchmark" -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -type d -name "benchmarks" -exec rm -rf {} + 2>/dev/null || true

# ============================================================================
# 빌드 단계
# ============================================================================
FROM deps AS builder

# 빌드 시 NODE_ENV를 development로 설정 (devDependencies 사용)
ENV NODE_ENV=development

# 빌드용 더미 JWT_SECRET
ARG BUILD_JWT_SECRET="buildtime-secret"
ENV JWT_SECRET=${BUILD_JWT_SECRET}

# 빌드 시점임을 표시하는 환경 변수 (PostgreSQL 연결 방지)
ENV SKIP_DB_CONNECTION=true

# Next.js 빌드 캐시를 위한 환경 변수 설정
ENV NEXT_TELEMETRY_DISABLED=1

# 소스 코드 복사 (.dockerignore로 불필요한 파일 제외)
# 의존성은 이미 deps 단계에서 설치되었으므로 소스 코드만 복사
COPY . ./

# 빌드용 더미 .env 파일 생성
RUN touch .env.production || true

# Next.js 프로덕션 빌드 실행 (standalone 모드, Docker 빌드용 스크립트 사용)
# BuildKit 캐시 마운트로 Next.js 빌드 캐시 재사용하여 빌드 속도 향상
# 주의: 빌드 단계에서는 데이터베이스 테이블 생성 스크립트를 실행하지 않습니다.
# 테이블 생성은 다음 중 하나의 방법으로 수행해야 합니다:
#   1. docker.env에서 AUTO_INIT_DB=true 설정 (컨테이너 시작 시 자동 초기화)
#   2. 수동으로 'yarn setup-postgres' 명령 실행 (권장)
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked \
    --mount=type=cache,target=/root/.cache,sharing=locked \
    NODE_ENV=production yarn build:docker

# ============================================================================
# 실행 단계 (런타임 베이스 사용)
# ============================================================================
FROM base-runtime AS runner

# node 그룹/사용자 생성 (비루트 권한 실행)
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

WORKDIR /app

# standalone 빌드 결과물 복사 (Next.js가 필요한 모든 파일을 포함)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# scripts 폴더 복사 (데이터베이스 초기화 및 관리자 계정 생성 스크립트)
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# 스크립트 실행에 필요한 의존성 복사 (standalone에 포함되지 않은 경우)
# bcryptjs, pg, dotenv 등이 필요하므로 prod-deps에서 복사
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# 불필요한 파일 제거 및 최적화
RUN find .next -name "*.map" -type f -delete 2>/dev/null || true \
    && find public \( -name "*.md" -o -name ".DS_Store" -o -name "Thumbs.db" \) -type f -delete 2>/dev/null || true \
    && rm -rf .next/cache public/uploads/* public/rag-documents/* 2>/dev/null || true

# 디렉토리 생성 및 권한 설정
RUN mkdir -p /app/public/uploads /app/public/rag-documents \
    /app/volumes/public/uploads /app/volumes/public/rag-documents /app/volumes/data/rag-documents \
    && chown -R nextjs:nodejs /app

# entrypoint 스크립트 복사 및 실행 권한 부여 (root로 복사 후 권한 설정)
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && chown nextjs:nodejs /app/docker-entrypoint.sh

USER nextjs

# Next.js 포트
EXPOSE 3000

# tini를 사용하여 신호 처리를 올바르게 수행 (없으면 직접 node 실행)
# entrypoint 스크립트를 통해 환경 검증 → 필수 디렉토리 확인 → DB 초기화(선택적) → server.js 실행
# DB 초기화는 AUTO_INIT_DB=true로 설정 시에만 자동으로 실행됩니다. (기본값: false)
# 폐쇄망 환경 대응: tini가 없을 경우 직접 node 실행
RUN if [ -f /usr/bin/tini ]; then \
        echo "Using tini for signal handling"; \
    else \
        echo "tini not found, will use node directly"; \
    fi
# ENTRYPOINT를 wrapper 스크립트로 설정하여 CMD를 올바르게 전달
# tini가 있으면 tini를 통해 실행, 없으면 직접 실행
ENTRYPOINT ["sh", "-c", "if [ -f /usr/bin/tini ]; then exec /usr/bin/tini -- /app/docker-entrypoint.sh \"$@\"; else exec /app/docker-entrypoint.sh \"$@\"; fi", "--"]
CMD ["node", "server.js"]
CMD ["node", "server.js"]
