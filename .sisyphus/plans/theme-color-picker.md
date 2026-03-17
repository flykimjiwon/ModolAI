# Admin 테마 컬러 피커 + 색상 조정

## TL;DR

> **Quick Summary**: Admin 설정 페이지(`/admin/settings`)에 디자인 테마 색상 선택 섹션을 추가하여, 관리자가 프리셋 팔레트(amber, blue, green, purple, rose 등) 또는 커스텀 컬러 피커로 플랫폼 전체의 주요 색상을 변경할 수 있게 한다. 현재 amber/warm stone 버튼 색상도 70-80% 연한 톤으로 조정한다.
> 
> **Deliverables**:
> - DB `settings` 테이블에 테마 관련 컬럼 추가 (`theme_preset`, `theme_colors`)
> - Admin 설정 UI에 "디자인 테마" 섹션 (프리셋 스워치 + 커스텀 HEX 피커)
> - 설정 저장/로드 API 확장 (admin PUT + public GET)
> - `SiteSettings.js` 확장하여 테마 CSS 변수 동적 주입 (`:root` inline + `.dark` style tag)
> - FOUC 방지를 위한 `layout.js` inline script 확장
> - 현재 amber 색상 기본값을 75% 연한 톤으로 변경
> - 한국어/영어 i18n 키 추가
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (DB) → Task 3 (API) → Task 5 (Admin UI) → Task 6 (SiteSettings injection) → Task 7 (FOUC prevention)

---

## Context

### Original Request
사용자가 요청: "화이트, 다크모드 디자인색상톤을 http://localhost:3100/admin/settings 화면쪽에서 직접 디자인색상 팔레트에서 골라서 결정할 수 있도록 만들 수있나? 그리고 warm stone처럼 버튼색이면 너무 진해서 저거보단 7-80%정도의 연한 톤으로 해주면 될거같아"

### Interview Summary
**Key Discussions**:
- 팔레트 방식: 프리셋 + 커스텀 HEX 피커 모두 제공
- 적용 범위: 라이트 + 다크 모드 모두 영향
- 적용 대상: 전체 사용자 (Admin이 설정하면 모든 사용자에게 적용)
- 테스트 인프라 없음 — Agent-Executed QA (Playwright) 사용

**Research Findings**:
- CSS 변수 시스템 이미 구축됨: `--primary`, `--ring`, `--chart-*`, `--sidebar-primary` 등 `:root`와 `.dark`에 정의
- `globals.css`에 HEX 폴백(348-417행) + oklch 프로그레시브 인핸스먼트(419-489행)
- 설정 저장 패턴: 각 섹션별 독립 `save*` 함수 (예: `saveSiteBranding`)
- `SiteSettings.js`는 현재 브랜딩만 처리 — 테마 확장 필요
- `DarkModeToggle.js`는 `.dark` 클래스 토글 — 변경 불필요
- Settings API는 범용 PUT 핸들러로 각 필드를 개별 검증 후 동적 SQL 빌드

### Metis Review
**Identified Gaps** (addressed):
- **Dark mode injection 패턴**: `:root` 변수는 inline style로, `.dark` 변수는 동적 `<style id="modolai-theme-dark">` 태그로 분리 주입해야 함 — 단순 inline style만으로는 `.dark` 스코프 불가
- **FOUC 방지**: `layout.js`의 inline script에서 localStorage 캐시된 테마 데이터를 동기적으로 적용해야 함
- **기본값 복원**: 테마 리셋 시 `removeProperty()` 사용 + 동적 style 태그 제거로 `globals.css` 기본값 복원
- **oklch vs HEX**: `@supports (color: oklch(...))` 블록도 inline style이 우선하므로 oklch 값이 아닌 HEX 값으로 저장해도 동작함
- **프리셋 데이터 구조**: `{ preset: string, light: { vars... }, dark: { vars... } }` 형태로 저장

---

## Work Objectives

### Core Objective
Admin 설정에서 플랫폼 전체의 디자인 테마 색상을 선택(프리셋/커스텀)할 수 있게 하고, 선택된 테마를 모든 사용자에게 실시간 적용한다.

### Concrete Deliverables
- DB: `theme_preset` (VARCHAR), `theme_colors` (JSONB) 컬럼 추가
- API: `/api/admin/settings` PUT에 테마 검증/저장, `/api/public/settings` GET에 테마 노출
- UI: Admin 설정에 "디자인 테마" 카드 섹션 (프리셋 스워치 그리드 + 커스텀 컬러 피커 + 라이브 프리뷰)
- Client: `SiteSettings.js`에서 테마 CSS 변수 동적 주입
- FOUC 방지: `layout.js` inline script에서 localStorage 캐시 테마 동기 적용
- i18n: 한국어/영어 번역 키 추가
- 기본 amber 색상을 75% 연한 톤으로 조정

### Definition of Done
- [x] Admin이 프리셋 팔레트를 선택하면 전체 UI 색상이 즉시 변경됨
- [x] Admin이 커스텀 HEX 색상을 입력하면 프라이머리 색상이 변경됨
- [x] 다크 모드 토글 시 해당 테마의 다크 모드 색상이 적용됨
- [x] 페이지 새로고침 시 FOUC(비적용 깜빡임) 없이 테마 유지됨
- [x] 다른 사용자(비로그인 포함)도 Admin이 설정한 테마를 보게 됨
- [x] 기존 amber 버튼이 70-80% 연한 톤으로 표시됨
- [x] `SKIP_DB_CONNECTION=true npm run build` 성공 (JWT_SECRET=build-placeholder 필요, 기존 이슈)

### Must Have
- 프리셋 팔레트 최소 6개 (amber, blue, green, purple, rose, slate)
- 커스텀 컬러 입력 (HEX)
- 라이트/다크 모드 모두 적용
- 전체 사용자 적용 (Admin 설정 = 글로벌)
- FOUC 방지
- 저장 후 새로고침 없이 즉시 적용
- 기존 설정 섹션 스타일과 일관된 UI

### Must NOT Have (Guardrails)
- 개인별 테마 설정 (이번 스코프 아님)
- 폰트 변경 기능
- 전체 Tailwind gray 팔레트 오버라이드 (stone은 유지, primary 계열만 변경)
- shadcn/ui 컴포넌트 파일 직접 수정
- `DarkModeToggle.js` 수정
- 외부 컬러 피커 라이브러리 추가 (HTML `<input type="color">` + HEX 텍스트 입력 사용)
- oklch 계산 로직 구현 (프리셋은 사전 계산된 값 사용)
- TypeScript 마이그레이션

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None
- **Framework**: None
- **Agent-Executed QA**: Playwright for UI verification, curl for API verification

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright — Navigate, interact, assert DOM, screenshot
- **API/Backend**: Use Bash (curl) — Send requests, assert status + response fields
- **Build**: Use Bash — `SKIP_DB_CONNECTION=true npm run build`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation):
├── Task 1: DB schema + theme preset data definitions [quick]
├── Task 2: i18n 번역 키 추가 [quick]
└── Task 3: Soften default amber colors in globals.css [quick]

Wave 2 (After Wave 1 — core implementation):
├── Task 4: API 확장 (admin PUT validation + public GET) [unspecified-high]
├── Task 5: Admin 설정 UI - 디자인 테마 섹션 [visual-engineering]
└── Task 6: SiteSettings.js 테마 CSS 변수 동적 주입 [deep]

Wave 3 (After Wave 2 — integration + polish):
├── Task 7: FOUC 방지 - layout.js inline script 확장 [deep]
└── Task 8: Build 검증 + 전체 통합 QA [unspecified-high]

Wave FINAL (After ALL tasks — independent review):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high + playwright)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → F1-F4
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 3 (Waves 1 & 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1    | —         | 4, 5   | 1    |
| 2    | —         | 5      | 1    |
| 3    | —         | 8      | 1    |
| 4    | 1         | 5, 6   | 2    |
| 5    | 1, 2, 4   | 8      | 2    |
| 6    | 4         | 7, 8   | 2    |
| 7    | 6         | 8      | 3    |
| 8    | 3, 5, 6, 7| F1-F4  | 3    |

### Agent Dispatch Summary

- **Wave 1**: **3 tasks** — T1 `quick`, T2 `quick`, T3 `quick`
- **Wave 2**: **3 tasks** — T4 `unspecified-high`, T5 `visual-engineering`, T6 `deep`
- **Wave 3**: **2 tasks** — T7 `deep`, T8 `unspecified-high`
- **FINAL**: **4 tasks** — F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs


- [x] 1. DB 스키마 확장 + 테마 프리셋 데이터 정의

  **What to do**:
  - `ensureSettingsColumns()` 함수(`app/api/admin/settings/route.js:21-97`)에 다음 컬럼 추가:
    - `theme_preset VARCHAR(30) DEFAULT 'amber-soft'` — 선택된 프리셋 이름
    - `theme_colors JSONB DEFAULT '{}'::jsonb` — 커스텀 또는 프리셋의 실제 CSS 변수 값
  - 같은 파일의 GET 핸들러(100행~)에서 `settings` 객체에 `themePreset`, `themeColors` 매핑 추가
  - 같은 파일의 `defaultSettings` 객체(152행~)에 기본값 추가:
    ```
    themePreset: 'amber-soft',
    themeColors: {
      light: {
        '--primary': '#e5a63b',
        '--primary-foreground': '#ffffff',
        '--ring': '#f5be5b',
        '--chart-1': '#e5a63b',
        '--chart-3': '#f5be5b',
        '--sidebar-primary': '#e5a63b',
        '--sidebar-ring': '#f5be5b'
      },
      dark: {
        '--primary': '#f5be5b',
        '--primary-foreground': '#1c1917',
        '--ring': '#fcd480',
        '--chart-1': '#f5be5b',
        '--chart-3': '#fcd480',
        '--sidebar-primary': '#f5be5b',
        '--sidebar-ring': '#fcd480'
      }
    }  
    ```
  - INSERT 쿼리(197행~)에 `theme_preset`, `theme_colors` 파라미터 추가
  - 테마 프리셋 데이터 상수를 별도 파일 `app/lib/themePresets.js`로 정의:
    - `amber-soft` (현재 amber의 75% 연한 버전, 기본값)
    - `blue` (Tailwind blue-500/blue-400 기반)
    - `green` (Tailwind emerald-500/emerald-400 기반)
    - `purple` (Tailwind violet-500/violet-400 기반)
    - `rose` (Tailwind rose-500/rose-400 기반)
    - `slate` (Tailwind gray-500/gray-400 기반 — 무채색)
    - 각 프리셋은 `{ id, name, nameKo, preview, light: { vars }, dark: { vars } }` 구조
    - 변경 대상 CSS 변수: `--primary`, `--primary-foreground`, `--ring`, `--chart-1`, `--chart-3`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-ring`

  **Must NOT do**:
  - `--background`, `--foreground`, `--card`, `--border` 등 기본 neutral 색상은 변경하지 않음
  - stone 팔레트(gray/slate 오버라이드)는 건드리지 않음
  - 기존 컬럼이나 데이터에 영향 주지 않음

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: DB 스키마 확장은 기존 패턴(ensureSettingsColumns)을 따르는 반복 작업
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: DB/API 작업이라 브라우저 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `app/api/admin/settings/route.js:21-97` — `ensureSettingsColumns()` 함수: 이 패턴을 따라 `theme_preset`, `theme_colors` 컬럼 추가
  - `app/api/admin/settings/route.js:100-148` — GET 핸들러의 snake_case→camelCase 매핑: `themePreset`, `themeColors` 추가
  - `app/api/admin/settings/route.js:152-195` — `defaultSettings` 객체: 기본 테마 값 추가
  - `app/api/admin/settings/route.js:197-230` — INSERT 쿼리: 새 컬럼 파라미터 추가

  **External References**:
  - Tailwind CSS color palette: `https://tailwindcss.com/docs/colors` — 프리셋 색상값 참고

  **Acceptance Criteria**:

  ```
  Scenario: DB 컬럼 자동 생성 확인
    Tool: Bash (curl)
    Preconditions: dev 서버 실행 중 (localhost:3100)
    Steps:
      1. curl -s http://localhost:3100/api/public/settings | jq '.'
      2. 응답에 themePreset, themeColors 필드 존재 확인
    Expected Result: { "themePreset": "amber-soft", "themeColors": { "light": {...}, "dark": {...} } }
    Failure Indicators: 필드 누락 또는 500 에러
    Evidence: .sisyphus/evidence/task-1-db-columns.json

  Scenario: themePresets.js 모듈 로드 확인
    Tool: Bash (node)
    Preconditions: 파일 생성 완료
    Steps:
      1. node -e "const p = require('./app/lib/themePresets.js'); console.log(Object.keys(p.THEME_PRESETS).length, JSON.stringify(Object.keys(p.THEME_PRESETS)))"
      2. 프리셋 6개 존재 확인
    Expected Result: 6개 프리셋 키 출력 (amber-soft, blue, green, purple, rose, slate)
    Failure Indicators: require 실패 또는 6개 미만
    Evidence: .sisyphus/evidence/task-1-presets-loaded.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(theme): add DB schema and theme preset definitions`
  - Files: `app/api/admin/settings/route.js`, `app/lib/themePresets.js`

- [x] 2. i18n 번역 키 추가 (한국어/영어)

  **What to do**:
  - `app/lib/i18n/ko.json`에 다음 키 추가 (적절한 위치에):
    ```json
    "admin_settings": {
      "design_theme": "디자인 테마",
      "design_theme_desc": "플랫폼 전체의 주요 색상을 변경합니다. 모든 사용자에게 적용됩니다.",
      "preset_palettes": "프리셋 팔레트",
      "custom_color": "커스텀 색상",
      "custom_color_desc": "HEX 코드를 직접 입력하여 커스텀 색상을 설정합니다.",
      "primary_color": "주요 색상",
      "current_theme": "현재 테마",
      "theme_saved": "테마가 저장되었습니다.",
      "theme_reset": "기본 테마로 초기화",
      "theme_reset_confirm": "기본 테마(Amber Soft)로 초기화하시겠습니까?",
      "theme_preview": "미리보기",
      "apply_theme": "테마 적용"
    }
    ```
  - `app/lib/i18n/en.json`에 동일 키 영어로 추가

  **Must NOT do**:
  - 기존 번역 키 수정/삭제 금지
  - admin_settings 외 다른 섹션에 키 추가하지 않음

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: JSON 파일에 키-값 추가하는 단순 작업
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `app/lib/i18n/ko.json` — 기존 `admin_settings` 섹션 키 패턴을 따라 추가
  - `app/lib/i18n/en.json` — 동일 구조

  **Acceptance Criteria**:

  ```
  Scenario: i18n 키 존재 확인
    Tool: Bash (node)
    Preconditions: 파일 수정 완료
    Steps:
      1. node -e "const ko = require('./app/lib/i18n/ko.json'); console.log(ko.admin_settings.design_theme, ko.admin_settings.theme_saved)"
      2. node -e "const en = require('./app/lib/i18n/en.json'); console.log(en.admin_settings.design_theme, en.admin_settings.theme_saved)"
    Expected Result: 한국어 '디자인 테마', '테마가 저장되었습니다.' / 영어 'Design Theme', 'Theme saved.' 출력
    Failure Indicators: undefined 출력
    Evidence: .sisyphus/evidence/task-2-i18n-keys.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(theme): add i18n translation keys for theme settings`
  - Files: `app/lib/i18n/ko.json`, `app/lib/i18n/en.json`

- [x] 3. 기본 Amber 색상 70-80% 연한 톤으로 조정

  **What to do**:
  - `app/globals.css`에서 현재 amber 색상값을 75% 연한 버전으로 변경:
    - `:root` 블록 (348-382행):
      - `--primary: #d97706` → `--primary: #e5a63b` (amber-500의 75% 밝기)
      - `--ring: #f59e0b` → `--ring: #f5be5b` (amber-400의 75% 밝기)
      - `--chart-1: #d97706` → `--chart-1: #e5a63b`
      - `--chart-3: #f59e0b` → `--chart-3: #f5be5b`
      - `--sidebar-primary: #d97706` → `--sidebar-primary: #e5a63b`
      - `--sidebar-ring: #f59e0b` → `--sidebar-ring: #f5be5b`
    - `.dark` 블록 (384-417행):
      - `--primary: #f59e0b` → `--primary: #f5be5b` (amber-400의 75% 밝기)
      - `--ring: #fbbf24` → `--ring: #fcd480` (amber-300의 75% 밝기)
      - `--chart-1: #f59e0b` → `--chart-1: #f5be5b`
      - `--chart-3: #fbbf24` → `--chart-3: #fcd480`
      - `--sidebar-primary: #f59e0b` → `--sidebar-primary: #f5be5b`
      - `--sidebar-ring: #fbbf24` → `--sidebar-ring: #fcd480`
    - `@supports (color: oklch(...))` `:root` 블록 (420-453행):
      - `--primary: oklch(0.666 0.179 58)` → `--primary: oklch(0.73 0.14 65)` (연한 amber)
      - `--ring: oklch(0.769 0.188 70)` → `--ring: oklch(0.80 0.145 73)` (연한 amber)
      - 차트/사이드바도 동일하게 조정
    - `@supports (color: oklch(...))` `.dark` 블록 (455-488행):
      - `--primary: oklch(0.769 0.188 70)` → `--primary: oklch(0.80 0.145 73)`
      - `--ring: oklch(0.828 0.189 84)` → `--ring: oklch(0.85 0.145 80)`
      - 차트/사이드바도 동일하게 조정
  - 색상값은 기존 amber를 기준으로 채도(chroma)를 20-25% 낮추고 밝기(lightness)를 5-10% 높인 값

  **Must NOT do**:
  - `--background`, `--foreground`, `--card`, `--border`, `--muted` 등 neutral 색상 변경 금지
  - `--destructive` 색상 변경 금지
  - stone 팔레트 (gray/slate 오버라이드) 변경 금지
  - 마크다운, 스크롤바, 복사버튼 등 다른 스타일 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: CSS 변수값 교체만 필요한 단순 작업
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 8
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `app/globals.css:348-382` — `:root` 블록의 현재 amber HEX 값들
  - `app/globals.css:384-417` — `.dark` 블록의 현재 amber HEX 값들
  - `app/globals.css:420-453` — `@supports oklch` `:root` 블록
  - `app/globals.css:455-488` — `@supports oklch` `.dark` 블록

  **Acceptance Criteria**:

  ```
  Scenario: 연한 amber 색상 적용 확인
    Tool: Playwright
    Preconditions: dev 서버 실행, 로그인 상태
    Steps:
      1. http://localhost:3100 접속
      2. primary 색상을 사용하는 버튼 요소 찾기 (예: `.bg-primary`)
      3. computed style에서 background-color 값 확인
    Expected Result: background-color가 #e5a63b (rgb(229, 166, 59)) 또는 oklch 등가값
    Failure Indicators: 기존 #d97706 색상이 그대로인 경우
    Evidence: .sisyphus/evidence/task-3-amber-softened.png

  Scenario: 다크모드에서도 연한 색상 확인
    Tool: Playwright
    Preconditions: dev 서버 실행
    Steps:
      1. http://localhost:3100 접속
      2. 다크모드 토글 클릭
      3. primary 색상 버튼의 computed background-color 확인
    Expected Result: #f5be5b (rgb(245, 190, 91)) 또는 oklch 등가값
    Failure Indicators: 기존 #f59e0b 색상이 그대로인 경우
    Evidence: .sisyphus/evidence/task-3-amber-softened-dark.png
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `style(theme): soften default amber colors to 75% lighter tone`
  - Files: `app/globals.css`

- [x] 4. API 확장 (Admin PUT 검증/저장 + Public GET 노출)

  **What to do**:
  - **Admin PUT** (`app/api/admin/settings/route.js` PUT 핸들러, 320행~):
    - `request.json()` 디스트럭처링에 `themePreset`, `themeColors` 추가 (330행 근처)
    - `themePreset` 검증: `typeof themePreset === 'string' && themePreset.length <= 30`, 유효한 프리셋 이름인지 `themePresets.js`의 키로 확인, 또는 'custom' 허용
    - `themeColors` 검증: `typeof themeColors === 'object'`, `light` 및 `dark` 키 존재, 각 값이 `--`로 시작하는 CSS 변수명, 각 값이 유효한 HEX 코드(`/^#[0-9a-fA-F]{6}$/`)
    - 허용된 CSS 변수 화이트리스트: `--primary`, `--primary-foreground`, `--ring`, `--chart-1`, `--chart-3`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-ring`
    - `updateData`에 추가 후 기존 동적 SQL 빌드 패턴(696행~)이 JSONB를 처리하도록 `themeColors`를 JSON.stringify 대상에 추가 (702행 `supportContacts` 패턴 참조)
  - **Public GET** (`app/api/public/settings/route.js`):
    - SELECT 쿼리에 `theme_preset`, `theme_colors` 컬럼 추가
    - 응답 객체에 `themePreset`, `themeColors` 필드 추가
    - 에러 폴백 기본값에도 `themePreset: 'amber-soft'`, `themeColors: {}` 추가

  **Must NOT do**:
  - 기존 PUT 검증 로직 변경 금지
  - 인증 로직 변경 금지 (Admin만 PUT 가능, Public은 GET만)
  - XSS: themeColors의 값에 script 태그 등 허용하지 않음 (정규식 검증으로 차단)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 복수 API 라우트 수정, 검증 로직, SQL 통합 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 6과 병렬 가능)
  - **Parallel Group**: Wave 2 (Task 5는 이 태스크 완료 후 시작)
  - **Blocks**: Tasks 5, 6
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `app/api/admin/settings/route.js:320-357` - PUT 핸들러: request body 디스트럭처링 패턴
  - `app/api/admin/settings/route.js:362-598` - 개별 필드 검증 패턴 (이 패턴을 따라 themePreset/themeColors 검증 추가)
  - `app/api/admin/settings/route.js:696-711` - 동적 SQL SET 빌드 + JSONB 처리 패턴 (`customEndpoints` 참조)
  - `app/api/public/settings/route.js:17-58` - Public GET 핸들러 전체 (여기 테마 필드 추가)
  - `app/lib/themePresets.js` - Task 1에서 생성한 프리셋 데이터 (검증에 사용)

  **Acceptance Criteria**:

  ```
  Scenario: 테마 저장 API 테스트
    Tool: Bash (curl)
    Preconditions: dev 서버 실행, Admin 토큰 확보
    Steps:
      1. Admin 로그인하여 토큰 획득
      2. PUT /api/admin/settings with themePreset: 'blue' and themeColors: { light: { '--primary': '#3b82f6' }, dark: { '--primary': '#60a5fa' } }
      3. 응답에 success: true 확인
    Expected Result: 200 OK, success: true
    Failure Indicators: 400/500 에러
    Evidence: .sisyphus/evidence/task-4-api-save.json

  Scenario: 유효하지 않은 HEX 색상 거부 테스트
    Tool: Bash (curl)
    Preconditions: Admin 토큰 확보
    Steps:
      1. PUT with themeColors containing '--primary': 'not-a-color'
      2. 응답에 error 메시지 확인
    Expected Result: 400 상태코드 + validation error 메시지
    Failure Indicators: 200 성공 또는 500 서버 에러
    Evidence: .sisyphus/evidence/task-4-api-validation-error.json

  Scenario: Public GET에서 테마 노출 확인
    Tool: Bash (curl)
    Preconditions: Task 4 save 성공 후
    Steps:
      1. curl http://localhost:3100/api/public/settings
      2. 저장한 blue 테마 데이터 반환 확인
    Expected Result: themePreset: 'blue', themeColors: { light: {...}, dark: {...} }
    Failure Indicators: null 또는 필드 누락
    Evidence: .sisyphus/evidence/task-4-public-get-theme.json
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(theme): extend settings API for theme save/load`
  - Files: `app/api/admin/settings/route.js`, `app/api/public/settings/route.js`

- [x] 5. Admin 설정 UI - 디자인 테마 섹션

  **What to do**:
  - `app/admin/settings/page.js`에 새로운 '디자인 테마' 카드 섹션 추가:
    - **위치**: '사이트 브랜딩' 섹션 다음, '채팅 위젯' 섹션 전
    - **State 추가**: `themePreset` (string), `themeCustomPrimary` (string, HEX)
    - **UI 구성**:
      1. **프리셋 팔레트 그리드**: 3열x2행 그리드로 6개 팔레트 스워치 표시. 각 스워치: 원형 색상 샘플 + 테마명 + 선택 상태 표시(ring). `themePresets.js`에서 import한 데이터 사용. 클릭 시 `themePreset` state 변경 + 해당 프리셋의 CSS 변수 값으로 themeColors 설정
      2. **커스텀 색상 입력**: 프리셋 아래에 위치. `<input type='color'>` + HEX 텍스트 입력 필드. 커스텀 색상 선택 시 `themePreset`을 'custom'으로 변경. 입력된 HEX 기반으로 light/dark 변수 자동 계산 (다크모드는 20% 밝게)
      3. **라이브 프리뷰**: 색상 선택시 현재 페이지에 즉시 적용. `document.documentElement.style.setProperty()`로 :root 변수 즉시 주입. 저장 전 미리보기용 (저장 안 하면 새로고침시 복구)
      4. **저장 버튼**: 기존 `saveSiteBranding` 패턴을 따른 `saveTheme` 함수 추가. PUT body에 `themePreset`, `themeColors` 전송. 성공 시 `window.dispatchEvent(new CustomEvent('modolai-theme-updated', { detail: { themePreset, themeColors } }))`
      5. **초기화 버튼**: 기본 테마(amber-soft)로 되돌리기. confirm 다이얼로그 후 초기화
  - `fetchSettings` 함수에서 응답의 `themePreset`, `themeColors` 로드하여 state 초기화
  - Palette import: `import { THEME_PRESETS } from '@/lib/themePresets'`

  **Must NOT do**:
  - 기존 설정 섹션 수정/이동 금지
  - 외부 컬러 피커 라이브러리 추가 금지 (HTML native input type=color 사용)
  - shadcn/ui Button, Input 외 새 UI 컴포넌트 추가 금지
  - 다른 설정 섹션의 저장 로직 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI 컴포넌트 생성, 색상 스워치 그리드, 시각적 피드백 필요
  - **Skills**: [`frontend-design`]
    - `frontend-design`: 색상 팔레트 UI를 기존 Admin 설정 스타일과 일관되게 디자인

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 1, 2, 4)
  - **Parallel Group**: Wave 2 (starts after Task 4 completes)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 1, 2, 4

  **References**:

  **Pattern References**:
  - `app/admin/settings/page.js:464-512` - `saveSiteBranding` 함수: 이 패턴을 복사하여 `saveTheme` 함수 만들기
  - `app/admin/settings/page.js:1986-2004` - DB 스키마 보기 섹션: UI 카드 레이아웃 패턴 참조 (아이콘 + 제목 + 설명 + 버튼 구조)
  - `app/admin/settings/page.js:16-58` - state 선언 패턴: `themePreset`, `themeCustomPrimary` state 추가 위치
  - `app/admin/settings/page.js:3-12` - import 구조: `themePresets.js` import 추가 위치
  - `app/lib/themePresets.js` - Task 1에서 생성한 프리셋 데이터

  **Acceptance Criteria**:

  ```
  Scenario: 프리셋 팔레트 UI 렌더링 확인
    Tool: Playwright
    Preconditions: dev 서버 실행, Admin 로그인
    Steps:
      1. http://localhost:3100/admin/settings 이동
      2. '디자인 테마' 텍스트 포함 섹션 확인: page.locator('text=디자인 테마')
      3. 컬러 스워치 6개 존재 확인: page.locator('[data-testid^="theme-swatch-"]').count() === 6
      4. 커스텀 색상 입력 필드 확인: page.locator('input[type="color"]').isVisible()
    Expected Result: 6개 스워치 + 커스텀 입력 필드 표시
    Failure Indicators: 섹션 없음 또는 스워치 6개 미만
    Evidence: .sisyphus/evidence/task-5-theme-ui.png

  Scenario: 프리셋 선택 시 라이브 프리뷰
    Tool: Playwright
    Preconditions: Admin 설정 페이지 열린 상태
    Steps:
      1. 파란색(blue) 스워치 클릭: page.locator('[data-testid="theme-swatch-blue"]').click()
      2. 1초 대기
      3. 페이지의 primary 색상 변수 확인
    Expected Result: --primary 값이 blue 계열로 변경됨
    Failure Indicators: amber 색상 유지 또는 변경 없음
    Evidence: .sisyphus/evidence/task-5-live-preview-blue.png

  Scenario: 테마 저장 및 성공 메시지
    Tool: Playwright
    Preconditions: blue 프리셋 선택된 상태
    Steps:
      1. 저장 버튼 클릭
      2. 2초 대기
      3. 성공 알림 확인
    Expected Result: '테마가 저장되었습니다' 알림 표시
    Failure Indicators: 에러 알림 또는 반응 없음
    Evidence: .sisyphus/evidence/task-5-save-success.png
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(theme): add design theme section to admin settings UI`
  - Files: `app/admin/settings/page.js`

- [x] 6. SiteSettings.js 테마 CSS 변수 동적 주입

  **What to do**:
  - `app/components/SiteSettings.js` 확장:
    - **새 이벤트 리스너**: `modolai-theme-updated` 이벤트 구독 (Admin 설정에서 테마 저장 시 발생)
    - **테마 로드**: `fetchSiteSettings`에서 응답의 `themeColors` 읽기
    - **CSS 변수 주입 함수** `applyThemeColors(themeColors)` 구현:
      - **:root 변수** (라이트 모드): `document.documentElement.style.setProperty(varName, value)` 사용 - inline style이 @supports oklch보다 우선하므로 HEX 값이 정상 동작
      - **.dark 변수** (다크 모드): 동적 `<style id='modolai-theme-dark'>` 태그를 `<head>`에 생성/업데이트 - inline style은 .dark 스코프 불가하므로 반드시 style 태그 사용
      - style 태그 내용: `.dark { --primary: #xxx; --ring: #xxx; ... }`
    - **테마 리셋 함수** `resetThemeColors()` 구현:
      - 각 :root 변수에 `document.documentElement.style.removeProperty(varName)` 호출 (빈 문자열이 아닌 removeProperty 사용해야 globals.css 기본값 복원)
      - `document.getElementById('modolai-theme-dark')?.remove()` 로 동적 style 태그 제거
    - **localStorage 캐시**: 테마 데이터를 `localStorage.setItem('modolai-theme', JSON.stringify(themeColors))` 로 캐시 (FOUC 방지에 사용, Task 7)
    - themeColors가 빈 객체이거나 없으면 resetThemeColors() 호출하여 기본값 복원

  **Must NOT do**:
  - `DarkModeToggle.js` 수정 금지 (.dark 토글 메커니즘은 그대로 유지)
  - 기존 `applySiteBranding` 함수 수정 금지
  - globals.css 수정 금지 (동적 주입만)
  - oklch 변환 로직 구현 금지 (HEX 값만 사용)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: CSS specificity 이해, dual injection 패턴 (inline + style tag), localStorage 캐시 전략 필요
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Task 4 완료 후, Task 5와 병렬 가능)
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `app/components/SiteSettings.js:1-75` - 전체 파일: 기존 branding 로드/적용 패턴을 따라 테마 로직 추가
  - `app/components/SiteSettings.js:9-40` - `applySiteBranding`: DOM 조작 패턴 참조 (document.title, meta tag 등)
  - `app/components/SiteSettings.js:42-75` - useEffect + event listener 패턴: 동일 패턴으로 theme listener 추가
  - `app/globals.css:348-417` - :root 및 .dark CSS 변수 목록: 어떤 변수를 주입해야 하는지 참조

  **Acceptance Criteria**:

  ```
  Scenario: API에서 테마 로드 후 CSS 변수 적용
    Tool: Playwright
    Preconditions: Task 4에서 blue 테마 저장 완료, dev 서버 실행
    Steps:
      1. http://localhost:3100 새 탭으로 접속 (비로그인)
      2. getComputedStyle(document.documentElement).getPropertyValue('--primary') 확인
    Expected Result: blue 테마의 primary 색상값 반환
    Failure Indicators: 기본 amber 색상 반환
    Evidence: .sisyphus/evidence/task-6-theme-applied.txt

  Scenario: 다크모드 토글 시 테마 색상 유지
    Tool: Playwright
    Preconditions: blue 테마 적용된 상태에서 라이트 모드
    Steps:
      1. 다크모드 토글 클릭
      2. 1초 대기
      3. getComputedStyle(document.documentElement).getPropertyValue('--primary') 확인
      4. document.getElementById('modolai-theme-dark') 존재 확인
    Expected Result: dark 테마의 blue primary 색상값 + style 태그 존재
    Failure Indicators: amber 다크 색상 또는 style 태그 없음
    Evidence: .sisyphus/evidence/task-6-dark-mode-theme.txt

  Scenario: localStorage 캐시 확인
    Tool: Playwright
    Preconditions: 테마 적용된 페이지
    Steps:
      1. localStorage.getItem('modolai-theme') 값 확인
    Expected Result: JSON 문자열로 테마 데이터 저장되어 있음
    Failure Indicators: null 반환
    Evidence: .sisyphus/evidence/task-6-localstorage-cache.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(theme): add dynamic CSS variable injection in SiteSettings`
  - Files: `app/components/SiteSettings.js`

- [x] 7. FOUC 방지 - layout.js inline script 확장

  **What to do**:
  - `app/layout.js`의 inline script (135-162행)에 테마 복원 로직 추가:
    - 기존 dark mode 복원 로직 직후에 추가:
    ```javascript
    // Theme color restoration (FOUC prevention)
    var themeData = localStorage.getItem('modolai-theme');
    if (themeData) {
      try {
        var parsed = JSON.parse(themeData);
        var isDark = root.classList.contains('dark');
        var vars = isDark ? parsed.dark : parsed.light;
        if (vars && typeof vars === 'object') {
          for (var key in vars) {
            if (key.indexOf('--') === 0) {
              root.style.setProperty(key, vars[key]);
            }
          }
          // Dark vars via style tag
          if (parsed.dark) {
            var s = document.createElement('style');
            s.id = 'modolai-theme-dark';
            var css = '.dark {';
            for (var dk in parsed.dark) {
              if (dk.indexOf('--') === 0) css += dk + ':' + parsed.dark[dk] + ';';
            }
            css += '}';
            s.textContent = css;
            document.head.appendChild(s);
          }
        }
      } catch(e) { /* ignore parse errors */ }
    }
    ```
  - **주의사항**: 이 스크립트는 동기적으로 실행되어야 하므로 async/await 사용 금지
  - **주의사항**: ES5 문법만 사용 (var, for..in 등) - 구형 브라우저 호환
  - **주의사항**: try-catch로 감싸서 JSON.parse 실패 시 무시

  **Must NOT do**:
  - 기존 dark mode 토글 스크립트 수정 금지
  - 기존 언어 설정 스크립트 수정 금지
  - async 코드 사용 금지 (FOUC 방지를 위해 동기 실행 필수)
  - ES6+ 문법 사용 금지 (const, let, arrow function 등)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: FOUC 방지, specificity 이해, 동기 실행 보장, 기존 스크립트와의 통합
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (Task 6 완료 후)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 8
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `app/layout.js:133-165` - 기존 inline script: dark mode + language 복원 패턴을 따라 theme 복원 추가
  - `app/components/SiteSettings.js` - Task 6에서 구현한 localStorage 캐시 키 ('modolai-theme') 사용

  **Acceptance Criteria**:

  ```
  Scenario: 페이지 새로고침 시 FOUC 없음
    Tool: Playwright
    Preconditions: blue 테마 저장 및 적용 완료
    Steps:
      1. http://localhost:3100 새로고침
      2. DOMContentLoaded 이벤트 전에 --primary 값 확인 (page.evaluate)
      3. 페이지 로드 완료 후 --primary 값 확인
    Expected Result: 로드 초기부터 blue primary 색상 적용 (amber 깜빡임 없음)
    Failure Indicators: 초기에 amber 색상이 보였다가 blue로 변경되는 깜빡임
    Evidence: .sisyphus/evidence/task-7-no-fouc.txt

  Scenario: localStorage 없을 때 기본값 표시
    Tool: Playwright
    Preconditions: localStorage.removeItem('modolai-theme') 실행 후
    Steps:
      1. localStorage에서 테마 데이터 삭제
      2. 페이지 새로고침
      3. --primary 값 확인
    Expected Result: globals.css 기본값(연한 amber) 표시
    Failure Indicators: 에러 발생 또는 빈 색상
    Evidence: .sisyphus/evidence/task-7-fallback-default.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `feat(theme): add FOUC prevention via inline script`
  - Files: `app/layout.js`

- [x] 8. Build 검증 + 전체 통합 QA

  **What to do**:
  - `SKIP_DB_CONNECTION=true npm run build` 실행하여 빌드 성공 확인
  - 전체 워크플로우 통합 테스트:
    1. Admin 로그인 -> 설정 -> 테마 섹션 확인
    2. 프리셋 선택 -> 라이브 프리뷰 확인
    3. 저장 -> 새 탭에서 테마 적용 확인
    4. 다크모드 토글 -> 테마 색상 유지 확인
    5. 새로고침 -> FOUC 없이 테마 유지 확인
    6. 커스텀 색상 입력 -> 라이브 프리뷰 확인
    7. 초기화 -> 기본 테마 복구 확인

  **Must NOT do**:
  - 새 코드 작성 금지 (검증만 수행)
  - 이전 태스크 파일 수정 금지 (문제 발견 시 보고)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 빌드 실행 + 복합적인 통합 테스트 수행
  - **Skills**: [`playwright`]
    - `playwright`: 브라우저 기반 전체 워크플로우 검증

  **Parallelization**:
  - **Can Run In Parallel**: NO (모든 구현 태스크 완료 후)
  - **Parallel Group**: Wave 3 (Task 7 이후)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 3, 5, 6, 7

  **References**:

  **Pattern References**:
  - 모든 이전 태스크의 Acceptance Criteria 시나리오 참조
  - `package.json` scripts 섹션 - build 명령어 확인

  **Acceptance Criteria**:

  ```
  Scenario: 빌드 성공
    Tool: Bash
    Steps:
      1. SKIP_DB_CONNECTION=true npm run build
    Expected Result: 빌드 성공 (exit code 0, warnings 허용)
    Failure Indicators: exit code 1, 컴파일 에러
    Evidence: .sisyphus/evidence/task-8-build.txt

  Scenario: 전체 워크플로우 통합 테스트
    Tool: Playwright
    Preconditions: dev 서버 실행
    Steps:
      1. Admin 로그인 (admin@modol.ai / modol@admin)
      2. /admin/settings 이동
      3. '디자인 테마' 섹션 스크롤
      4. 'blue' 프리셋 클릭 -> 페이지 색상 변경 확인
      5. '테마 적용' 버튼 클릭 -> 성공 알림 확인
      6. 새 시크릿 탭에서 http://localhost:3100 접속 -> blue 테마 확인
      7. 다크모드 토글 -> blue 다크 색상 확인
      8. 새로고침 -> 깜빡임 없이 blue 유지 확인
      9. Admin 설정으로 돌아가서 '기본 테마로 초기화' 클릭
      10. amber-soft 복구 확인
    Expected Result: 모든 단계 성공
    Failure Indicators: 어느 단계에서든 색상 불일치 또는 에러
    Evidence: .sisyphus/evidence/task-8-integration.png
  ```

  **Commit**: NO (검증만 수행)

---
## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `SKIP_DB_CONNECTION=true npm run build`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (theme selection → page reload → dark mode toggle → verify colors). Test edge cases: empty/invalid hex, rapid preset switching. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(theme): add DB schema, i18n keys, and soften default amber colors` — globals.css, ko.json, en.json
- **Wave 2**: `feat(theme): add theme color picker to admin settings` — route.js (admin + public), settings/page.js, SiteSettings.js
- **Wave 3**: `feat(theme): add FOUC prevention and integration verification` — layout.js

---

## Success Criteria

### Verification Commands
```bash
SKIP_DB_CONNECTION=true npm run build  # Expected: success (warnings only)
curl -s http://localhost:3100/api/public/settings | jq '.themePreset, .themeColors'  # Expected: theme data returned
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] Build succeeds
- [x] Theme persists across page refresh without FOUC
- [x] Dark mode toggle works correctly with custom theme
- [x] All users see admin-set theme
