# TechAI ↔ ModolAI 동기화 추적 문서

> **마지막 동기화 점검일**: 2026-03-16 (2차)
> **ModolAI 기준 커밋**: `d969d36` (feat/techai-sync-2 → main 머지 예정)
> **techai/web 기준**: `173a665` HEAD

---

## 1. 개요

| 항목 | ModolAI | techai/web |
|------|---------|------------|
| **성격** | 개인 오픈소스 | 사내 운영 서비스 |
| **저장소** | `flykimjiwon/ModolAI` | `yompeach/techai` (모노레포 `web/`) |
| **동기화 방향** | **techai/web → ModolAI** (단방향) | — |
| **원칙** | ModolAI가 항상 최신·최상위 | techai/web 개선사항은 ModolAI에 반영 |
| **패키지 매니저** | npm | yarn |
| **기본 언어** | en (다국어) | ko (단일) |
| **브랜딩** | ModolAI | TechAI (신한은행 Tech그룹) |

### 동기화 규칙

1. techai/web에서 버그 수정, 디자인 개선, 기능 추가 발생 시 ModolAI에 포팅
2. ModolAI → techai/web 역방향 불필요 (ModolAI가 상위)
3. 회사 전용 기능은 제외 (섹션 8 참조)
4. 포팅 시 ModolAI 아키텍처 표준에 맞게 변환 (섹션 2 참조)

---

## 2. 아키텍처 차이 (포팅 변환 가이드)

| 영역 | ModolAI (표준) | techai/web |
|------|---------|------------|
| **다국어** | `useTranslation()` → `t('key')` | 한국어 하드코딩 |
| **디자인 토큰** | CSS 변수 (`text-foreground`, `bg-background` 등) | Tailwind 직접 (`text-gray-600`, `bg-white` 등) |
| **UI 컴포넌트** | shadcn/ui (`Button`, `Dialog`, `Badge`, `Input`, `ScrollArea` 등 28종) | raw HTML + 유틸리티 클래스 (6종) |
| **아이콘** | `@/components/icons` 래핑 | `lucide-react` 직접 import |
| **CSS 클래스** | 시멘틱 토큰 기반 | 하드코딩 다크모드 (`dark:bg-gray-900`) |
| **테마** | 프리셋 + 커스텀 색상 (themePresets.js) | 없음 |
| **레이아웃** | `LanguageProvider` + `GlobalControls` 래핑 | 직접 렌더링 |

### 포팅 변환 맵

```
# 색상 토큰
bg-white dark:bg-gray-900          → bg-background
text-gray-900 dark:text-white      → text-foreground
text-gray-500 dark:text-gray-400   → text-muted-foreground
border-gray-200 dark:border-gray-700 → border-border
bg-blue-600 text-white             → bg-primary text-primary-foreground
bg-red-500 text-white              → bg-destructive text-destructive-foreground
hover:bg-gray-100 dark:hover:bg-gray-800 → hover:bg-accent
bg-gray-50 dark:bg-gray-800       → bg-muted
text-blue-600                      → text-primary

# 컴포넌트
<button className="btn-primary">   → <Button variant="default">
<button className="btn-secondary"> → <Button variant="outline">
<input className="...">            → <Input />
raw <div> 모달                     → <Dialog> / <DialogContent>
raw <span> 뱃지                    → <Badge variant="...">
<div> 스크롤 영역                   → <ScrollArea>

# 문자열
'한국어 텍스트'                     → t('namespace.key')  + locales 파일에 키 추가
```

---

## 3. 상세 기능 비교표

> 범례: ✅ 있음 | ❌ 없음 | 🔶 부분적

### 3-1. 인증 & 사용자

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| 이메일/비밀번호 로그인 | ✅ | ✅ | 동일 |
| 회원가입 (이메일 검증, 부서 선택) | ✅ | ✅ | 동일 |
| OAuth/SSO 범용 로그인 | ✅ | ✅ | ModolAI는 범용 OAuth, techai는 Swing 특화 |
| Swing SSO 전용 로그인 | ❌ | ✅ | 회사 전용 — 제외 |
| JWT 리프레시 토큰 | ✅ | ✅ | 동일 |
| 프로필 수정 (이름, 부서, 비밀번호) | ✅ | ✅ | 동일 |
| 역할 체계: admin | ✅ | ✅ | 동일 |
| 역할 체계: manager | ✅ | ✅ | 동일 |
| 역할 체계: user | ✅ | ✅ | 동일 |
| 마지막 접속/활동 추적 | ✅ | ✅ | 동일 (10분 throttle) |
| 초기 설정 마법사 | ✅ | ✅ | 동일 |

### 3-2. 채팅 핵심

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| 멀티룸 채팅 | ✅ | ✅ | 동일 (최대 20개) |
| 실시간 스트리밍 응답 | ✅ | ✅ | 동일 |
| 이미지 업로드 & 분석 | ✅ | ✅ | 동일 |
| 룸별 모델 선택 (localStorage 저장) | ✅ | ✅ | 동일 |
| 사용자 기본 모델 설정 (서버 저장) | ✅ | ❌ | **ModolAI만** — useModelManager + /api/user/settings |
| 자동 방 이름 생성 | ✅ | ✅ | 동일 |
| 메시지 피드백 (좋아요/싫어요) | ✅ | ✅ | 동일 |
| 스크롤 하단 이동 버튼 | ✅ | ✅ | 동일 |
| 타이핑 애니메이션 | ✅ | ✅ | 동일 |
| 컨텍스트 길이 경고 | ✅ | ✅ | 동일 |
| 응답 중단 버튼 | ✅ | ✅ | 동일 |

### 3-3. 채팅 UI

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| 사이드바 (방 목록/생성/삭제) | ✅ | ✅ | 동일 |
| 업데이트 노트 버튼 (사이드바) | ❌ | ✅ | **포팅 필요** — Rocket 아이콘 + PatchNotesModal |
| 매니저 뱃지 (사이드바) | ❌ | ✅ | **포팅 필요** — manager 역할 뱃지 표시 |
| 매니저 관리자 페이지 진입 | ❌ | ✅ | **포팅 필요** — `userRole === 'manager'` 조건 |
| 모델 셀렉터 (shadcn DropdownMenu) | ✅ | ❌ | ModolAI가 상위 (techai는 raw div) |
| 모델 셀렉터 My Default 별표 | ✅ | ❌ | **ModolAI만** |
| 채팅 헤더 | ✅ | ✅ | 디자인 토큰 차이만 |
| 이미지 드래그&드롭 | ✅ | ✅ | 동일 |
| 클립보드 이미지 붙여넣기 | ✅ | ✅ | 동일 |
| 코드 블록 복사 버튼 | ✅ | ✅ | 동일 |
| 답변 전체 복사 | ✅ | ✅ | 동일 |

### 3-4. 에이전트

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| 에이전트 사이드바 | ✅ | ✅ | 동일 |
| 에이전트 셀렉터 | ✅ | ✅ | 동일 |
| 에이전트 상세 페이지 | ✅ | ✅ | 동일 |
| PPT 생성 에이전트 | ✅ | ✅ | 동일 |
| 에이전트 권한 관리 (역할/부서/개인) | ✅ | ✅ | 동일 |
| 에이전트 노출/숨김 (visibility) | ✅ | ❌ | **ModolAI만** — PATCH /api/admin/agents + Eye/EyeOff |
| 에이전트 설정 (모델, 슬라이드 수 등) | ✅ | ✅ | 동일 |
| 에이전트 하드코딩 목록 (회사 전용) | ❌ | ✅ | 회사 전용 — 제외 |

### 3-5. 커뮤니티 기능

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| 공지사항 CRUD | ✅ | ✅ | 동일 |
| 공지 팝업 | ✅ | ✅ | 동일 |
| 자유게시판 CRUD + 검색/페이지네이션 | ✅ | ✅ | 동일 |
| 댓글 CRUD | ✅ | ✅ | 동일 |
| 마크다운 에디터 | ✅ | ✅ | 동일 |
| 쪽지 (DM) 기능 | ✅ | ✅ | 동일 |
| 읽지 않은 쪽지 카운트 | ✅ | ✅ | 동일 |
| 패치노트 모달 | ❌ | ✅ | **포팅 필요** — PatchNotesModal.js |

### 3-6. 관리자 대시보드

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| 통계 (사용자/메시지/토큰) | ✅ | ✅ | 동일 |
| 기간별 필터링 | ✅ | ✅ | 동일 |
| 인기 모델 차트 | ✅ | ✅ | 동일 |
| 최근 활동 피드 | ✅ | ✅ | 동일 |
| 시스템 상태 (DB, API, 모델 서버) | ✅ | ✅ | 동일 |
| 엔드포인트 헬스체크 | ✅ | ✅ | 동일 |

### 3-7. 관리자 사용자 관리

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| 사용자 검색/필터/페이지네이션 | ✅ | ✅ | 동일 |
| 사용자 상세 모달 (더블클릭) | ✅ | ✅ | 동일 |
| 사용자 정보 수정 모달 | ✅ | ✅ | ModolAI는 Dialog, techai는 raw div |
| 역할 변경: 토글 버튼 (admin↔user) | ✅ | ❌ | ModolAI 현재 방식 |
| 역할 변경: 인라인 드롭다운 (3단계) | ❌ | ✅ | **포팅 필요** — 배지 클릭 → admin/manager/user 전환 |
| 매니저 역할 필터 옵션 | ❌ | ✅ | **포팅 필요** — `<option value='manager'>` |
| 사용자 삭제 | ✅ | ✅ | 동일 |

### 3-8. 관리자 모델 관리

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| 모델 드래그&드롭 정렬 | ✅ | ✅ | 동일 |
| 모델 활성화/비활성화 | ✅ | ✅ | 동일 |
| 모델별 PII 탐지 설정 | ✅ | ✅ | 동일 |
| 모델 라벨 커스터마이징 | ✅ | ✅ | 동일 |
| 모델 카테고리 분류 | ✅ | ✅ | 동일 |
| 라운드로빈 로드밸런싱 | ✅ | ✅ | 동일 |
| 모델 서버 헬스 모니터링 | ✅ | ✅ | 동일 |
| 모델 서버 오류 이력 | ✅ | ✅ | 동일 |

### 3-9. 관리자 설정

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| 사이트 브랜딩 (제목, 설명, 파비콘) | ✅ | ✅ | 동일 |
| 기능 토글 (채팅 위젯, 프로필, 게시판) | ✅ | ✅ | 동일 |
| 테마 프리셋 + 커스텀 색상 | ✅ | ❌ | **ModolAI만** — themePresets.js |
| 지원 연락처 설정 | ✅ | ✅ | 동일 |
| 이미지 분석 설정 (모델, 프롬프트, 최대 수) | ✅ | ✅ | 동일 |
| 방 이름 생성 모델 설정 | ✅ | ✅ | 동일 |
| 최대 질문 길이 | ✅ | ✅ | 동일 |
| 엔드포인트 설정 (Ollama, OpenAI) | ✅ | ✅ | 동일 |
| DB 백업/복원/리셋 | ✅ | ✅ | 동일 |
| 스키마 초기화/수복 | ✅ | ✅ | 동일 |
| 모델 마이그레이션 | ✅ | ✅ | 동일 |
| 선택적 테이블 초기화 | ✅ | ✅ | 동일 |

### 3-10. 컴플라이언스 & 보안

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| PII 탐지 (주민번호, 전화, 이메일, 카드 등 8종+) | ✅ | 🔶 | ModolAI에 piiDetector.js 독립 모듈 추가됨 |
| PII 마스킹/필터링 | ✅ | ✅ | 동일 (piiFilter.js) |
| PII 탐지 테스트 도구 | ✅ | ✅ | 동일 |
| PII 이벤트 로그 | ✅ | ✅ | 동일 |
| SSO 감사 로그 | ✅ | ✅ | 동일 |
| 외부 API 호출 로그 | ✅ | ✅ | 동일 |
| 오류 로그 | ✅ | ✅ | 동일 |
| 클라이언트 에러 리포팅 | ✅ | ✅ | 동일 |

### 3-11. OpenAI 호환 API

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| `/v1/chat/completions` | ✅ | ✅ | 동일 |
| `/v1/completions` | ✅ | ✅ | 동일 |
| `/v1/models` | ✅ | ✅ | 동일 |
| `/v1/embeddings` | ✅ | ✅ | 동일 |
| `/v1/rerank` | ✅ | ✅ | 동일 |
| API 키/토큰 관리 (사용자) | ✅ | ✅ | 동일 |
| API 키/토큰 관리 (관리자) | ✅ | ✅ | 동일 |

### 3-12. 다국어 & UI 시스템

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| 한국어/영어 전환 | ✅ | ❌ | **ModolAI만** |
| useTranslation 훅 | ✅ | ❌ | **ModolAI만** |
| LanguageContext | ✅ | ❌ | **ModolAI만** |
| LanguageSwitcher 컴포넌트 | ✅ | ❌ | **ModolAI만** |
| GlobalControls (테마+언어 통합 패널) | ✅ | ❌ | **ModolAI만** |
| 테마 FOUC 방지 (layout.js) | ✅ | ❌ | **ModolAI만** — CSS 변수 사전 적용 |
| 레거시 브라우저 감지 | ❌ | ✅ | 회사 전용 — 제외 |
| shadcn/ui 컴포넌트 (28종) | ✅ | 🔶 (6종) | ModolAI가 상위 |
| Phosphor Icons 래핑 | ✅ | ❌ | **ModolAI만** |
| sonner 토스트 | ✅ | ❌ | **ModolAI만** |

### 3-13. 인프라 & 개발

| 기능 | ModolAI | techai/web | 비고 |
|------|:-------:|:----------:|------|
| Docker 빌드 스크립트 | ❌ | ✅ | techai 전용 (docker-build.js, pack-all.js) |
| Docker Compose | ❌ | ✅ | techai 모노레포 전용 |
| Playwright E2E 테스트 | ❌ | ✅ | techai 전용 (chatUI, login, signup) |
| 관리 스크립트 (create-admin, schema 등) | ✅ | ✅ | 동일 |
| 자동 DB 마이그레이션 | ✅ | ✅ | 동일 |
| ESLint + Prettier | ✅ | ✅ | 동일 |
| Turbopack 지원 | ✅ | ✅ | 동일 |
| SKIP_DB_CONNECTION 빌드 | ✅ | ✅ | 동일 |

---

## 4. ModolAI에만 존재하는 기능 (우위)

| 기능 | 파일/모듈 | 설명 |
|------|----------|------|
| 다국어 i18n (한/영) | `useTranslation`, `LanguageContext`, `locales/` | 전체 UI 다국어 |
| 디자인 토큰 시스템 | CSS 변수 + shadcn/ui 28종 | 일관된 테마 지원 |
| 테마 프리셋 | `themePresets.js` | 미리 정의된 색상 테마 |
| GlobalControls | `GlobalControls.js` | 테마+언어 통합 제어 |
| PII Detector (독립 모듈) | `piiDetector.js` | 8종+ 로컬 PII 탐지 |
| 사용자 기본 모델 설정 | `useModelManager` + `/api/user/settings` | 서버 저장 기본 모델 |
| 에이전트 노출/숨김 | `/api/admin/agents` PATCH | visibility 토글 |
| 모델 셀렉터 My Default 별표 | `ModelSelector.js` | Star 아이콘 토글 |
| Phosphor Icons 래핑 | `icons/index.jsx` | 아이콘 일괄 관리 |
| sonner 토스트 알림 | `sonner.jsx` | 비차단 알림 |
| 테마 FOUC 방지 | `layout.js` 인라인 스크립트 | CSS 변수 선 적용 |
| Radix UI 전체 통합 | `radix-ui` 패키지 | 접근성 기반 컴포넌트 |

---

## 5. techai/web에만 존재하는 기능

### 포팅 대상 (ModolAI에 가져와야 함)

| 우선순위 | 기능 | 파일 | 설명 |
|---------|------|------|------|
| **높음** | PatchNotesModal | `components/PatchNotesModal.js` | 업데이트 내역/예정 탭 모달 (데이터는 재작성) |
| **높음** | 사이드바 업데이트 노트 버튼 | `components/chat/Sidebar.js` | Rocket 아이콘 + 모달 연결 |
| **높음** | 매니저 사이드바 처리 | `components/chat/Sidebar.js` | manager → 관리자 페이지 진입 + 뱃지 |
| **높음** | 역할 인라인 드롭다운 | `admin/users/page.js` | 배지 클릭 → admin/manager/user 전환 |
| **높음** | 매니저 역할 필터 | `admin/users/page.js` | 필터 `<select>`에 manager 추가 |
| **보통** | 에이전트 매니저 라벨 | `admin/agents/page.js` | 사용자 목록 `(매니저)` 표시 |

### 제외 대상 (회사 전용)

| 기능 | 파일 | 이유 |
|------|------|------|
| Swing SSO 로그인 | `swinglogin/page.js` | 사내 전용 |
| Swing SSO 테스트 | `api/auth/swing-test/route.js` | 사내 전용 |
| 회사 에이전트 6종 하드코딩 | `admin/agents/page.js` | 사내 전용 |
| 부서→그룹 치환 | `admin/users/page.js` | 사내 용어 |
| 레거시 브라우저 감지 | `layout.js` | 사내 환경 전용 |
| Docker 빌드/패키징 | `scripts/docker-build.js`, `pack-all.js` | 운영 환경 전용 |
| Playwright E2E | `tests/*.spec.ts` | techai 전용 테스트 |
| 사내 운영 문서 | `*.md` (한글) | 사내 전용 |

---

## 6. 파일별 상세 동기화 상태

> 범례: ✅ ModolAI 상위 | ⬜ 포팅 필요 | 🔵 ModolAI만 | 🟡 techai만 (제외) | ⚪ 동일/차이 미미

### 페이지 (app/)

| 파일 | 상태 | 차이 내용 |
|------|------|----------|
| `page.js` | ⚪ | 거의 동일 |
| `chat/page.js` | ⚪ | 거의 동일 |
| `login/page.js` | ⚪ | 동일 |
| `signup/page.js` | ⚪ | 동일 |
| `setup/page.js` | ⚪ | 동일 |
| `sso/page.js` | ⚪ | 동일 |
| `profile/page.js` | ⚪ | 동일 |
| `layout.js` | ✅ | ModolAI: LanguageProvider, GlobalControls, 테마 FOUC 방지. techai: 레거시 브라우저 감지 |
| `swinglogin/page.js` | 🟡 | 사내 전용 — 제외 |

### 컴포넌트 (app/components/)

| 파일 | 상태 | 차이 내용 |
|------|------|----------|
| `chat/Sidebar.js` | ⬜ | techai: PatchNotes 버튼, 매니저 역할 뱃지/진입, Rocket import. ModolAI: i18n, 디자인 토큰, Button/ScrollArea. **기능 포팅 필요** |
| `chat/ChatInput.js` | ✅ | ModolAI: i18n, 디자인 토큰, Button, userDefaultModelId prop |
| `chat/MessageList.js` | ✅ | ModolAI: i18n, 디자인 토큰, @/components/icons |
| `chat/ModelSelector.js` | ✅ | ModolAI: DropdownMenu (shadcn), My Default 별표, Badge. techai: raw div |
| `chat/ChatHeader.js` | ✅ | ModolAI: 디자인 토큰. techai: 하드코딩 색상 |
| `chat/ChatLayout.js` | ✅ | ModolAI: `bg-background`. techai: `bg-gray-50 dark:bg-gray-900` |
| `chat/AgentSidebar.js` | ⚪ | 비교 결과 차이 미미 |
| `chat/ScrollButtons.js` | ⚪ | 비교 결과 차이 미미 |
| `AgentSelector.js` | ✅ | ModolAI가 상위 |
| `ChatWidget.js` | ⚪ | 동일 |
| `PPTMaker.js` | ⚪ | 동일 |
| `NoticePopup.js` | ⚪ | 동일 |
| `DirectMessageModal.js` | ⚪ | 동일 |
| `DarkModeToggle.js` | ⚪ | 동일 |
| `SiteSettings.js` | ⚪ | 동일 |
| `ClientErrorReporter.js` | ⚪ | 동일 |
| `ClientLayout.js` | ⚪ | 동일 |
| `ContextWarning.js` | ⚪ | 동일 |
| `LoadingSpinner.js` | ⚪ | 동일 |
| `TypingAnimation.js` | ⚪ | 동일 |
| `PatchNotesModal.js` | ⬜ | techai에만 존재 → **ModolAI에 신규 생성 필요** |
| `GlobalControls.js` | 🔵 | ModolAI에만 존재 |
| `LanguageSwitcher.js` | 🔵 | ModolAI에만 존재 |
| `icons/index.jsx` | 🔵 | ModolAI에만 존재 |
| `admin/AnalyticsCharts.js` | ⚪ | 동일 |

### UI 컴포넌트 (app/components/ui/)

| 파일 | ModolAI | techai/web |
|------|:-------:|:----------:|
| `button.jsx` | ✅ | ✅ |
| `input.jsx` | ✅ | ✅ |
| `card.jsx` | ✅ | ✅ |
| `label.jsx` | ✅ | ✅ |
| `modal.jsx` | ✅ | ✅ |
| `switch.jsx` | ✅ | ✅ |
| `alert-dialog.jsx` | ✅ | ❌ |
| `alert.jsx` | ✅ | ❌ |
| `avatar.jsx` | ✅ | ❌ |
| `badge.jsx` | ✅ | ❌ |
| `checkbox.jsx` | ✅ | ❌ |
| `dialog.jsx` | ✅ | ❌ |
| `dropdown-menu.jsx` | ✅ | ❌ |
| `popover.jsx` | ✅ | ❌ |
| `progress.jsx` | ✅ | ❌ |
| `radio-group.jsx` | ✅ | ❌ |
| `scroll-area.jsx` | ✅ | ❌ |
| `select.jsx` | ✅ | ❌ |
| `separator.jsx` | ✅ | ❌ |
| `sheet.jsx` | ✅ | ❌ |
| `skeleton.jsx` | ✅ | ❌ |
| `sonner.jsx` | ✅ | ❌ |
| `table.jsx` | ✅ | ❌ |
| `tabs.jsx` | ✅ | ❌ |
| `textarea.jsx` | ✅ | ❌ |
| `tooltip.jsx` | ✅ | ❌ |

### 관리자 페이지 (app/admin/)

| 파일 | 상태 | 차이 내용 |
|------|------|----------|
| `layout.js` | ✅ | ModolAI가 상위 |
| `page.js` | ⚪ | 동일 |
| `dashboard/page.js` | ⚪ | 동일 |
| `users/page.js` | ⬜ | techai: 역할 인라인 드롭다운 (admin/manager/user), 매니저 필터, roleDropdownRef. ModolAI: Dialog, Badge, i18n. **기능 포팅 필요** |
| `agents/page.js` | ⬜ | techai: 매니저 라벨, 회사 에이전트. ModolAI: visibility 토글, i18n. **매니저 라벨만 포팅** |
| `models/page.js` | ⚪ | 동일 |
| `modelServers/page.js` | ⚪ | 동일 |
| `settings/page.js` | ✅ | ModolAI: 테마 프리셋/커스텀 색상, themePresets import, Switch/Button/Input/Textarea. techai: DB 백업 복원 결과 표시 |
| `messages/page.js` | ⚪ | 동일 |
| `analytics/page.js` | ⚪ | 동일 |
| `api-keys/page.js` | ⚪ | 동일 |
| `api-tokens/page.js` | ⚪ | 동일 |
| `direct-messages/page.js` | ⚪ | 동일 |
| `sso-logs/page.js` | ⚪ | 동일 |
| `pii-logs/page.js` | ⚪ | 동일 |
| `pii-test/page.js` | ⚪ | 동일 |
| `external-api-logs/page.js` | ⚪ | 동일 |
| `env/page.js` | ⚪ | 동일 |
| `db-schema/page.js` | ⚪ | 동일 |
| `db-connection-check/page.js` | ⚪ | 동일 |

### API 라우트 (app/api/)

| 파일 | 상태 | 차이 내용 |
|------|------|----------|
| `admin/agents/route.js` | ✅ | ModolAI: PATCH (visibility 토글) 추가됨 |
| `agents/list/route.js` | 🔵 | ModolAI에만 존재 (visibility 기반 필터링) |
| `user/settings/route.js` | 🔵 | ModolAI에만 존재 (기본 모델 저장) |
| `v1/completions/route.js` | ✅ | ModolAI가 상위 |
| `v1/embeddings/route.js` | ✅ | ModolAI가 상위 |
| `v1/rerank/route.js` | ✅ | ModolAI가 상위 |
| `admin/db-backup/route.js` | ⚪ | 동일 |
| `admin/db-restore/route.js` | ⚪ | 동일 |
| `auth/swing-test/route.js` | 🟡 | 사내 전용 — 제외 |
| 그 외 ~70개 라우트 | ⚪ | 주석/라벨 차이만 (i18n으로 커버) |

### Hooks (app/hooks/)

| 파일 | 상태 | 차이 내용 |
|------|------|----------|
| `useChat.js` | ✅ | ModolAI: i18n 적용 |
| `useChatSender.js` | ✅ | ModolAI: i18n 적용, toUserFriendlyError에 t 전달 |
| `useModelManager.js` | ✅ | ModolAI: userDefaultModelId, saveUserDefaultModel, X-User-Role 헤더 |
| `useAlert.js` | ⚪ | 동일 |
| `useDarkMode.js` | ⚪ | 동일 |
| `useTranslation.js` | 🔵 | ModolAI에만 존재 |

### 라이브러리 (app/lib/)

| 파일 | 상태 | 차이 내용 |
|------|------|----------|
| `auth.js` | ✅ | 동일 기능, ModolAI 영문 주석 |
| `adminAuth.js` | ✅ | ModolAI가 상위 |
| `modelTables.js` | ✅ | ModolAI가 상위 |
| `config.js` | ✅ | ModolAI: SKIP_DB_CONNECTION 체크 추가 |
| `piiDetector.js` | 🔵 | ModolAI에만 존재 |
| `themePresets.js` | 🔵 | ModolAI에만 존재 |
| 그 외 (~20개) | ⚪ | 주석 차이만 |

### Contexts (app/contexts/)

| 파일 | 상태 | 차이 내용 |
|------|------|----------|
| `AlertContext.js` | ⚪ | 동일 |
| `AdminAuthContext.js` | ⚪ | 동일 |
| `LanguageContext.js` | 🔵 | ModolAI에만 존재 |

### 스크립트 (scripts/)

| 파일 | 상태 | 차이 내용 |
|------|------|----------|
| `create-admin.js` | ⚪ | 동일 |
| `create-postgres-schema.js` | ⚪ | 동일 |
| `test-postgres-connection.js` | ⚪ | 동일 |
| `db-utils.js` | ⚪ | 동일 |
| `dev-safe.js` | ⚪ | 동일 |
| `docker-build.js` | 🟡 | techai 전용 |
| `pack-all.js` | 🟡 | techai 전용 |

### 테스트

| 파일 | 상태 | 차이 내용 |
|------|------|----------|
| `tests/chatUI.spec.ts` | 🟡 | techai 전용 (Playwright) |
| `tests/loginUser.spec.ts` | 🟡 | techai 전용 |
| `tests/signupUser.spec.ts` | 🟡 | techai 전용 |

---

## 7. 패키지 의존성 비교

| 패키지 | ModolAI | techai/web | 비고 |
|--------|:-------:|:----------:|------|
| next | 15.5.9 | 15.5.9 | 동일 |
| react | 19.2.1 | 19.2.1 | 동일 |
| tailwindcss | v4 | v4 | 동일 |
| lucide-react | 0.542.0 | 0.542.0 | 동일 |
| pg | 8.16.3 | 8.16.3 | 동일 |
| recharts | 3.2.0 | 3.2.0 | 동일 |
| winston | 3.17.0 | 3.17.0 | 동일 |
| **@phosphor-icons/react** | ✅ (2.1.10) | ❌ | ModolAI만 |
| **radix-ui** | ✅ (1.4.3) | ❌ | ModolAI만 |
| **sonner** | ✅ (2.0.7) | ❌ | ModolAI만 |
| **@playwright/test** | ❌ | ✅ (1.57.0) | techai만 |

---

## 8. 제외 목록 (회사 전용 — 포팅 금지)

| 항목 | 파일/기능 | 이유 |
|------|----------|------|
| Swing SSO | `swinglogin/page.js`, `api/auth/swing-test/route.js` | 사내 SSO 전용 |
| 회사 에이전트 목록 | AI 가상회의, 코드 컨버터, Text to SQL, 텍스트 재작성, 에러 해결 도우미, Solgit 리뷰어 | 사내 업무 특화 |
| 부서→그룹 치환 | `admin/users/page.js` 내 replaceAll 로직 | 사내 조직 용어 |
| 레거시 브라우저 감지 | `layout.js` Chromium 111 미만 체크 | 사내 환경 전용 |
| Docker 빌드/패키징 | `docker-build.js`, `pack-all.js`, `Dockerfile`, `docker-compose.yml` | 사내 배포 환경 |
| Playwright E2E 테스트 | `tests/*.spec.ts` | techai 전용 테스트 |
| 사내 운영 문서 | `브라우저하위호환가이드.md`, `빌드.md`, `패키지,머지충돌.md`, `rag_cleanup_summary.txt` | 사내 문서 |
| 기본 브랜딩 | `TechAI`, `신한은행 Tech그룹 AI` | 회사 브랜딩 |

---

## 9. 점검 이력

| 날짜 | 내용 |
|------|------|
| 2026-03-16 | 초기 전체 분석. ModolAI `6dcfd5f` vs techai/web `main` HEAD. 모든 파일 대비 완료. 포팅 대상 6개 식별, ModolAI 우위 항목 12개 확인 |
| 2026-03-16 (2차) | techai `173a665` HEAD 기준 재분석. 12개 항목 포팅 완료 (보안+버그+기능+UI). 신규: 차트 색상 피커(ModolAI 독자 기능) 추가. 브랜치 `feat/techai-sync-2` (`d969d36`) |

---

## 10. 다음 점검 시 절차

```bash
# 1. techai/web 최근 변경 확인
cd /Users/kimjiwon/Desktop/kimjiwon/techai && git pull && git log --oneline -20 -- web/

# 2. ModolAI 최근 변경 확인
cd /Users/kimjiwon/Desktop/kimjiwon/ModolAI && git pull && git log --oneline -20

# 3. 변경 파일 diff
diff <ModolAI file> <techai/web file>

# 4. 이 문서 업데이트
# - 포팅 완료 항목: ⬜ → ✅
# - 신규 차이 발견 시 추가
# - 점검 이력 기록
```
