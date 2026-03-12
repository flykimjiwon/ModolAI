[English](README_en.md)

# ModolAI

ModolAI는 Next.js 15 기반의 오픈소스 셀프호스팅 AI 챗 플랫폼입니다.

멀티모델 채팅, 에이전트 워크플로우, 관리자 운영, OpenAI 호환 API, 쪽지, 게시판/공지사항, 컴플라이언스 도구를 하나의 JavaScript 스택으로 제공합니다.

## 주요 특징

- Next.js 15 App Router + React 19
- shadcn/ui 기반 모노크롬 디자인 토큰 컴포넌트 시스템
- 멀티 프로바이더 모델 라우팅 (Ollama, OpenAI 호환, Gemini)
- OpenAI 호환 API (`/v1/chat/completions`, `/v1/models`, `/v1/embeddings`, `/v1/rerank`)
- 관리자 패널 (사용자, 모델, 모델 서버, 로그, 설정, 분석)
- 개인정보(PII) 탐지/테스트 및 로그 조회
- 로컬 로그인 + 범용 OAuth SSO 지원
- PPT 생성 워크플로우 내장 (`app/components/PPTMaker.js`)
- 다국어 지원 (한국어 / 영어)

## 기술 스택

- 프레임워크: Next.js 15.5.9
- 런타임: React 19.2.1
- 언어: JavaScript
- UI: shadcn/ui + Tailwind CSS v4
- 데이터베이스: PostgreSQL (Supabase 호환, 연결 문자열 방식)
- 인증: JWT + 리프레시 토큰
- 차트: Recharts
- 패키지 매니저: npm

## 빠른 시작

### 사전 요구사항

- Node.js 20+
- PostgreSQL 14+

### 설치

```bash
git clone <your-fork-or-repo-url> modol
cd modol
npm install
```

### 환경 설정

```bash
cp .env.development .env.local
```

`.env.local`에 필수 값 설정:

```env
JWT_SECRET=your-secret
POSTGRES_URI=postgresql://user:password@localhost:5432/modol
```

선택 값:

```env
TZ=UTC
SKIP_DB_CONNECTION=false
OAUTH_URL=https://oauth.example.com
OAUTH_AUTH_PATH=/cau/v1/idpw-authorize
OAUTH_COMPANY_CODE=ORG
OAUTH_CLIENT_ID=
OAUTH_CLIENT_SECRET=
```

### 데이터베이스 초기화

```bash
createdb modol
npm run setup-postgres
npm run create-admin
```

기본 관리자 계정:

- 이메일: `admin@modol.ai`
- 비밀번호: `modol@admin`

### 실행

```bash
npm run dev
```

빌드 검증:

```bash
SKIP_DB_CONNECTION=true npm run build
```

## 프로젝트 구조

- `app/` — Next.js 앱 라우트, 페이지, API 핸들러
- `app/admin/` — 관리자 UI 페이지
- `app/api/` — 애플리케이션 API 라우트
- `app/components/` — 공유 UI 및 기능 컴포넌트
- `app/components/ui/` — shadcn/ui 기본 컴포넌트
- `app/lib/` — 인증, DB, 로깅, 모델서버, 유틸리티
- `app/lib/i18n/` — 다국어 지원 (한국어 / 영어)
- `scripts/` — 설정/관리/진단 스크립트

## 마이그레이션 현황

완료된 작업:

- 기업 전용 브랜딩 정리
- 모노크롬 shadcn/ui 마이그레이션 (채팅/관리자/인증/프로필)
- 관리자 페이지 마이그레이션 (대시보드/사용자/설정/환경 + 로그/메시지/분석)
- PPTMaker, 모달/토글/스피너 등 나머지 컴포넌트 마이그레이션
- SSO 범용화 (특정 기업 전용 라우트/페이지 제거)
- 타임존 설정을 환경변수 기반 세션 설정으로 이전
- 레거시 유틸리티 클래스 제거 (`btn-*`, `input-primary`, `card`)
- `modol` 브랜딩을 `ModolAI`로 업데이트
- 전체 다국어(한국어/영어) i18n 적용 — 모든 페이지 및 컴포넌트
- 보안 점검 및 패치 (API 엔드포인트 인증)

## 빌드 검증

최신 빌드 확인:

- 명령어: `SKIP_DB_CONNECTION=true npm run build`
- 결과: 성공 (경고만 존재)

## 기여

`CONTRIBUTING.md`를 참고하세요.

## 라이선스

MIT. `LICENSE`를 참고하세요.
