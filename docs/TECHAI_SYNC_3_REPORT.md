# TechAI → ModolAI 3차 동기화 리포트

> **동기화 일자**: 2026-03-22
> **techai/web 기준 커밋**: `4309851` (HEAD of web/main)
> **이전 동기화 기준**: `173a665`
> **총 분석 커밋**: 43개

---

## 동기화 결과 요약

| 구분 | 항목 수 | 상태 |
|------|---------|------|
| 이전에 이미 포팅됨 | 10 | ✅ 확인 완료 |
| 이번에 신규 포팅 | 3 | ✅ 포팅 완료 |
| 회사 전용 제외 | - | ⛔ 해당 없음 |

---

## 이미 포팅 확인된 기능 (변경 없음)

| # | 기능 | 검증 결과 |
|---|------|----------|
| 1 | Draw(캔버스) — HTML 시각화 생성/미리보기 + admin 설정 + iframe 보안 | ✅ 전체 파일 포팅 확인 |
| 2 | Custom Instruction — 사용자 지정 프롬프트 + 매니저 접근 제한 | ✅ Dialog + useChatSender + API 포팅 확인 |
| 3 | DB 뷰어 — /admin/database 테이블 조회/검색/정렬/CRUD + 컬럼 툴팁 | ✅ page.js + API routes + dbColumnDescriptions 확인 |
| 4 | 메시지 소프트 삭제 — is_deleted/deleted_at/deleted_by + PATCH API | ✅ 스키마 + API 엔드포인트 확인 |
| 5 | useChatSender 무한 렌더링 버그 수정 — ref 패턴 전환 | ✅ 동일 패턴 확인 |
| 6 | 마크다운 링크 새 탭 열기 — target="_blank" | ✅ MessageList.js:333 확인 |
| 7 | 사이드바 가로 스크롤바 제거 — overflow-x-hidden | ✅ Sidebar.js:245 확인 |
| 8 | PatchNotesModal — 업데이트 노트 모달 | ✅ PatchNotesModal.js + Sidebar.js 확인 |
| 9 | Manager 뱃지/사이드바 접근 | ✅ Sidebar.js:647-649 확인 |
| 10 | Role 인라인 드롭다운 (admin/manager/user 3단계) | ✅ users/page.js:533-539 확인 |
| 11 | 에이전트 표시/숨김 토글 | ✅ agents/page.js:85,170,173 확인 |
| 12 | 유저별 기본 모델 설정 | ✅ /api/user/settings + user_settings 테이블 확인 |
| 13 | snake_case 버그 수정 (modelServers.js) | ✅ 동일 수정 확인 |

---

## 이번에 포팅한 항목

### 1. settings 테이블 마이그레이션 15개 컬럼 추가
- **파일**: `app/api/admin/migrate-models/route.js`
- **내용**: endpoint 설정, 파일 파싱, API 설정 관련 컬럼 추가
- **컬럼**: `ollama_endpoints`, `endpoint_type`, `custom_endpoints`, `openai_compat_base`, `openai_compat_api_key`, `file_parsing_model`, `file_parsing_enabled`, `room_name_generation_model`, `max_file_size`, `max_files_per_room`, `max_total_size_per_room`, `supported_image_formats`, `supported_document_formats`, `api_config_example`, `api_curl_example`

### 2. messages 소프트 삭제 마이그레이션 + 방어적 에러 처리
- **파일**: `app/api/admin/migrate-models/route.js`
- **내용**: messages 테이블 `is_deleted`, `deleted_at`, `deleted_by` 컬럼 마이그레이션 추가
- **추가**: model_logs ALTER + 인덱스에 try-catch 방어 처리, REQUIRED_TABLES 루프 에러 핸들링

### 3. v1/rerank + v1/embeddings 사용통계 로깅
- **파일**: `app/api/v1/rerank/route.js`, `app/api/v1/embeddings/route.js`
- **내용**: `logExternalApiRequest` import 추가, manual/openai-compatible/ollama 엔드포인트별 로깅 호출 추가
- **로깅 필드**: sourceType, provider, apiType, endpoint, model, responseTime, statusCode, clientIP, userAgent, jwtUserId, tokenHash

### 4. AI 면책 문구 (main page.js)
- **파일**: `app/page.js`, `app/lib/i18n/en.json`, `app/lib/i18n/ko.json`
- **내용**: 메인 채팅 페이지에 "ModolAI can make mistakes" 면책 문구 추가 (i18n 대응)

---

## 빌드 검증

- **명령어**: `SKIP_DB_CONNECTION=true npm run build`
- **결과**: ✅ 성공

---

## 변경 파일 목록

| 파일 | 변경 유형 |
|------|----------|
| `app/api/admin/migrate-models/route.js` | 수정 |
| `app/api/v1/rerank/route.js` | 수정 |
| `app/api/v1/embeddings/route.js` | 수정 |
| `app/page.js` | 수정 |
| `app/lib/i18n/en.json` | 수정 |
| `app/lib/i18n/ko.json` | 수정 |
