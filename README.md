[English](README_en.md)

# ModolAI

ModolAI는 Next.js 15 기반의 **오픈소스 셀프호스팅 AI 챗 플랫폼**입니다.

멀티모델 채팅, 에이전트 워크플로우, 관리자 운영, OpenAI 호환 API, 쪽지, 게시판/공지사항, 컴플라이언스 도구를 하나의 JavaScript 스택으로 제공합니다.

---

## 주요 특징

| 기능 | 설명 |
|------|------|
| 멀티모델 채팅 | Ollama, OpenAI 호환, Gemini 등 여러 모델을 동시에 연결하고 방별로 선택 |
| 에이전트 시스템 | 에이전트 생성/관리, 권한 제어(역할/부서/개인), PPT 생성 내장 |
| Draw (캔버스) | AI가 HTML 시각화를 생성하면 실시간 미리보기 (iframe 샌드박싱) |
| Custom Instruction | 채팅방별 사용자 지정 시스템 프롬프트 설정 |
| OpenAI 호환 API | `/v1/chat/completions`, `/v1/models`, `/v1/embeddings`, `/v1/rerank` |
| 관리자 패널 | 사용자, 모델, 모델 서버, 로그, 설정, 분석 대시보드 |
| DB 뷰어 | 관리자용 데이터베이스 조회/검색/정렬/CRUD + 컬럼 설명 툴팁 |
| PII 탐지 | 개인정보 탐지/테스트 및 로그 조회 |
| 커뮤니티 | 공지사항, 자유게시판, 댓글, 마크다운 에디터, 쪽지(DM) |
| 인증 | 로컬 로그인 + 범용 OAuth SSO, JWT 리프레시 토큰 |
| 다국어 | 한국어 / 영어 완전 지원 (i18n) |
| 테마 | 프리셋 + 커스텀 색상, 다크/라이트 모드 |

---

## 기술 스택

| 항목 | 버전/도구 |
|------|----------|
| 프레임워크 | Next.js 15.5.9 |
| 런타임 | React 19.2.1 |
| 언어 | JavaScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| 데이터베이스 | PostgreSQL 14+ (Supabase 호환) |
| 인증 | JWT + 리프레시 토큰 |
| 차트 | Recharts |
| 패키지 매니저 | npm |

---

## 빠른 시작

### 1단계: 사전 요구사항

시작하기 전에 아래 소프트웨어가 설치되어 있어야 합니다:

- **Node.js 20 이상** — [다운로드](https://nodejs.org/)
- **PostgreSQL 14 이상** — [다운로드](https://www.postgresql.org/download/)

설치 확인:

```bash
node --version   # v20.x.x 이상
psql --version   # 14.x 이상
```

### 2단계: 프로젝트 다운로드

```bash
git clone https://github.com/flykimjiwon/ModolAI.git
cd ModolAI
npm install
```

### 3단계: 환경 설정

```bash
cp .env.development .env.local
```

`.env.local` 파일을 열어 아래 **필수 값**을 설정하세요:

```env
# 필수 설정
JWT_SECRET=your-secret-key-here        # JWT 암호화 키 (아무 문자열)
POSTGRES_URI=postgresql://user:password@localhost:5432/modolai   # PostgreSQL 연결 주소
```

**선택 설정** (필요한 경우만):

```env
TZ=Asia/Seoul                          # 타임존 (기본: UTC)
SKIP_DB_CONNECTION=false               # true면 DB 없이 빌드 가능
OAUTH_URL=https://oauth.example.com    # OAuth 서버 주소
OAUTH_CLIENT_ID=                       # OAuth 클라이언트 ID
OAUTH_CLIENT_SECRET=                   # OAuth 클라이언트 시크릿
```

### 4단계: 데이터베이스 초기화

```bash
# PostgreSQL에 데이터베이스 생성
createdb modolai

# 테이블 스키마 자동 생성
npm run setup-postgres

# 관리자 계정 생성
npm run create-admin
```

기본 관리자 계정:

| 항목 | 값 |
|------|---|
| 이메일 | `admin@modol.ai` |
| 비밀번호 | `modol@admin` |

> 보안을 위해 첫 로그인 후 비밀번호를 변경하세요.

### 5단계: 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

### 빌드 (프로덕션)

```bash
npm run build        # 빌드
npm run start        # 프로덕션 서버 실행
```

---

## 프로젝트 구조

```
ModolAI/
├── app/                    # Next.js 앱 라우트
│   ├── admin/              # 관리자 UI 페이지
│   │   ├── database/       #   DB 뷰어 (테이블 조회/CRUD)
│   │   ├── users/          #   사용자 관리 (역할 변경, 삭제)
│   │   ├── agents/         #   에이전트 관리 (표시/숨김)
│   │   ├── settings/       #   사이트 설정 (테마, Draw, 위젯)
│   │   └── ...             #   대시보드, 로그, 분석 등
│   ├── api/                # API 라우트
│   │   ├── v1/             #   OpenAI 호환 API
│   │   ├── admin/          #   관리자 API
│   │   └── webapp-chat/    #   채팅 API
│   ├── components/         # 공유 UI 컴포넌트
│   │   ├── chat/           #   채팅 관련 (ChatInput, MessageList, Sidebar, DrawPreviewPanel)
│   │   ├── ui/             #   shadcn/ui 기본 컴포넌트
│   │   └── ...             #   PatchNotesModal, NoticePopup 등
│   ├── hooks/              # React 커스텀 훅
│   │   ├── useChatSender.js    # 채팅 메시지 전송 로직
│   │   ├── useChat.js          # 채팅 상태 관리
│   │   └── useTranslation.js   # 다국어 지원
│   └── lib/                # 유틸리티 라이브러리
│       ├── i18n/           #   번역 파일 (en.json, ko.json)
│       ├── postgres.js     #   DB 연결
│       ├── autoMigrate.js  #   자동 스키마 마이그레이션
│       └── modelServers.js #   모델 서버 라우팅
├── scripts/                # 설정/관리 스크립트
├── public/                 # 정적 파일
├── docs/                   # 프로젝트 문서
└── tests/                  # 테스트 코드
```

---

## 주요 기능 상세 가이드

### 채팅

1. 로그인 후 **좌측 사이드바**에서 `+` 버튼을 눌러 새 채팅방 생성
2. 상단 **모델 셀렉터**에서 사용할 AI 모델 선택 (별표로 기본 모델 설정 가능)
3. 메시지 입력 후 전송 — 실시간 스트리밍 응답
4. 이미지 업로드 (드래그&드롭 또는 클립보드 붙여넣기) 지원

### Draw (캔버스) 모드

1. 채팅 입력창 좌측의 **붓 아이콘**을 클릭하여 Draw 모드 활성화
2. "차트 그려줘", "대시보드 만들어줘" 등 요청
3. AI가 HTML 코드를 생성하면 **미리보기 패널**에서 실시간 확인
4. 코드 복사 또는 새 탭에서 열기 가능

> 관리자가 설정 > Draw에서 활성화해야 사용 가능합니다.

### Custom Instruction (사용자 지정 프롬프트)

1. 채팅 입력창의 **사람 아이콘**을 클릭
2. 모달에서 원하는 시스템 프롬프트 작성 (최대 5,000자)
3. 활성화 토글을 켜고 저장
4. 해당 채팅방의 모든 대화에 자동 적용

### 관리자 패널

`http://localhost:3000/admin`으로 접속 (admin 또는 manager 역할 필요)

| 메뉴 | 기능 |
|------|------|
| 대시보드 | 사용자/메시지/토큰 통계, 인기 모델 차트, 시스템 상태 |
| 사용자 관리 | 검색/필터, 역할 변경 (admin/manager/user 드롭다운), 삭제 |
| 모델 관리 | 드래그&드롭 정렬, 활성화/비활성화, PII 설정, 카테고리 분류 |
| 에이전트 | 생성/수정/삭제, 표시/숨김 토글, 권한 설정 |
| 설정 | 사이트 브랜딩, 테마, Draw 설정, 채팅 위젯, 엔드포인트 |
| DB 관리 | DB 뷰어 (테이블 조회/검색/CRUD), 스키마 수복, 백업/복원 |
| 로그 | 메시지 로그, 외부 API 로그, 보안 로그 |

### OpenAI 호환 API

외부 도구(Continue, Cursor 등)에서 ModolAI를 AI 서버로 사용할 수 있습니다:

```bash
# 채팅 요청
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# 모델 목록 조회
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

> API 토큰은 관리자 패널 > 설정에서 발급받을 수 있습니다.

---

## 데이터베이스 마이그레이션

기존 DB에서 버전을 업그레이드할 때:

```bash
# 방법 1: 관리자 패널에서 실행
# 설정 > DB 관리 > "스키마 마이그레이션" 버튼 클릭

# 방법 2: API 호출
curl -X POST http://localhost:3000/api/admin/migrate-models \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

자동 마이그레이션이 로그인 시마다 누락 컬럼을 자동 추가합니다.

---

## 환경별 실행

### 개발 환경

```bash
npm run dev                    # 기본 개발 서버
npm run dev:turbopack           # Turbopack으로 빠른 개발 서버
```

### 프로덕션 환경

```bash
npm run build                  # 프로덕션 빌드
npm run start                  # 프로덕션 서버 실행
```

### Docker

```bash
docker build -t modolai .
docker run -p 3000:3000 --env-file .env.local modolai
```

---

## 유용한 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 |
| `npm run setup-postgres` | DB 스키마 초기화 |
| `npm run create-admin` | 관리자 계정 생성 |
| `npm run create-admin:interactive` | 대화형 관리자 계정 생성 |
| `npm run test-postgres` | DB 연결 테스트 |
| `npm run test:ollama` | Ollama 엔드포인트 테스트 |
| `npm run lint` | ESLint 검사 |

---

## 문제 해결

### DB 연결 실패

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

PostgreSQL이 실행 중인지 확인하세요:

```bash
# macOS
brew services start postgresql@14

# Linux
sudo systemctl start postgresql
```

### 빌드 시 DB 오류

DB 없이 빌드하려면:

```bash
SKIP_DB_CONNECTION=true npm run build
```

### 모델 로딩 실패

1. 관리자 패널 > 설정에서 Ollama/OpenAI 엔드포인트가 올바른지 확인
2. 모델 서버가 실행 중인지 확인: `curl http://localhost:11434/api/tags`

---

## 기여

`CONTRIBUTING.md`를 참고하세요.

## 라이선스

MIT. `LICENSE`를 참고하세요.
