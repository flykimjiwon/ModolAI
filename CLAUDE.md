# ModolAI — AI Assistant Guide

## Project Overview

ModolAI는 Next.js 15 기반 **오픈소스 셀프호스팅 AI 챗 플랫폼**.
멀티모델 채팅, 에이전트 워크플로우, 관리자 패널, OpenAI 호환 API, 커뮤니티(게시판/공지/쪽지), 컴플라이언스 도구를 단일 JavaScript 스택으로 제공.

**Sister project**: `../techai/web/` (TechAI Web) — 동일 기반의 엔터프라이즈 변형. AICR 멀티에이전트 오케스트레이션, 콘텐츠 필터 바이패스, OCR 등 고급 기능 보유. TechAI → ModolAI 방향으로 주기적 기능 포팅 진행.

## Tech Stack

- **Framework**: Next.js 15.5.9 (App Router, no `src/` directory)
- **Language**: JavaScript (no TypeScript — `jsconfig.json` with path aliases)
- **UI**: shadcn/ui + Tailwind CSS v4 + Lucide/Phosphor icons
- **Database**: PostgreSQL 14+ via `pg` (raw SQL, parameterized queries)
- **Auth**: JWT (jsonwebtoken) + HttpOnly refresh token cookies + bcryptjs
- **State**: React 19.2.1, no external state manager (useState/useContext)
- **Charts**: Recharts
- **Markdown**: @uiw/react-md-editor, @uiw/react-markdown-preview + rehype-sanitize
- **DnD**: @dnd-kit (core, sortable, utilities)
- **Logging**: Winston (server-side)
- **Package manager**: npm

## Architecture

```
app/
├── page.js                 # Home (chat)
├── layout.js               # Root layout (global)
├── chat/ chat1/ chat2/ chat3/  # Chat variants (TODO: consolidate)
├── admin/                  # Admin panel (22 pages, own layout.js)
│   ├── layout.js           # Admin layout
│   └── [agents|users|models|settings|database|...]/
├── api/                    # ~95 API routes
│   ├── auth/               # login, register, refresh, validate, sso
│   ├── admin/              # 46 admin endpoints
│   ├── v1/                 # OpenAI-compatible (chat/completions, models, embeddings, rerank)
│   ├── webapp-chat/        # Chat rooms, history, feedback
│   ├── webapp-*/           # Feature endpoints (generate, ppt, chart, code-convert, etc.)
│   ├── board/ notice/      # Community CRUD
│   ├── workflows/          # Workflow engine
│   ├── screens/            # Screen builder
│   └── user/               # Profile, settings, api-keys, api-tokens, memory
├── components/
│   ├── chat/               # ChatInput, MessageList, Sidebar, DrawPreviewPanel
│   ├── ui/                 # shadcn/ui (19 active, 7 unused)
│   └── [PPTMaker|VirtualMeeting|ChartMaker|CodeConverter|TextToSql|...]
├── hooks/                  # 11 custom hooks (useChat, useChatSender, useTranslation, etc.)
├── lib/
│   ├── postgres.js         # DB connection pool
│   ├── auth.js             # verifyToken, verifyAdmin, verifyAdminWithResult
│   ├── modelServers.js     # Model server routing & load balancing
│   ├── autoMigrate.js      # Auto schema migration
│   ├── i18n/               # ko.json, en.json
│   └── agent-data/         # Agent prompt templates
└── [board|notice|workflow|screen-builder|agent|...]/  # Feature pages
```

## Key Patterns

### Authentication
- Login returns JWT access token (short-lived) + HttpOnly refresh token cookie
- API routes use `verifyToken(request)` or `verifyAdmin(request)` from `@/lib/auth`
- Client-side: token stored in localStorage, decoded via `@/lib/jwtUtils.js` (decode only, no verification)
- Refresh flow: `/api/auth/refresh` rotates refresh token, returns new access token

### Database
- Raw SQL with parameterized queries via `pg` — NO ORM
- Connection: `@/lib/postgres.js` exports `query(sql, params)` and `getPool()`
- Schema auto-migration on startup via `autoMigrate.js`
- Manual migration: `npm run setup-postgres`

### API Route Pattern
```js
import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyToken, verifyAdmin } from '@/lib/auth';

export async function GET(request) {
  const tokenPayload = verifyToken(request);
  if (!tokenPayload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await query('SELECT * FROM table WHERE id = $1', [id]);
  return NextResponse.json(result.rows);
}
```

### i18n
- `useTranslation()` hook returns `t(key)` function
- Translation files: `app/lib/i18n/ko.json`, `app/lib/i18n/en.json`
- Language preference stored in localStorage

### Path Aliases (jsconfig.json)
- `@/components/*` → `app/components/*`
- `@/hooks/*` → `app/hooks/*`
- `@/lib/*` → `app/lib/*`
- `@/models/*` → `app/models/*`
- `@/contexts/*` → `app/contexts/*`

## Commands

```bash
npm run dev              # Dev server (with safe startup)
npm run dev:turbopack    # Dev with Turbopack
npm run build            # Production build (SKIP_DB_CONNECTION=true)
npm run start            # Production server
npm run lint             # ESLint
npm run setup-postgres   # Initialize DB schema
npm run create-admin     # Create admin account
npm run test-postgres    # Test DB connection
npm run test:ollama      # Test Ollama endpoints
```

## Development Rules

### Do
- Use parameterized SQL queries (`$1`, `$2`) — never concatenate user input
- Use `verifyToken` or `verifyAdmin` on every API route
- Use the project's Winston logger (`@/lib/logger.js`) instead of `console.log`
- Keep components under 500 lines — extract sub-components and custom hooks
- Use `@/lib/utils.js` `cn()` for className merging (clsx + tailwind-merge)
- Run `npm run lint` before committing

### Don't
- Don't add TypeScript — this is a JS project with jsconfig path aliases
- Don't add an ORM — raw SQL with `pg` is intentional
- Don't use `dangerouslySetInnerHTML` without sanitization (use rehype-sanitize or DOMPurify)
- Don't store secrets in source code — use environment variables
- Don't add new chat page variants — consolidate into existing ones

## Known Issues

- **No middleware.js**: Auth is per-route, not centralized. New admin routes MUST include auth checks.
- **4 chat variants**: `chat/`, `chat1/`, `chat2/`, `chat3/` — significant duplication, consolidation needed
- **God components**: `admin/models/page.js` (3,994 lines), `PPTMaker.js` (3,543 lines) need decomposition
- **216 console.log**: Scattered across 39 files, should use Winston logger
- **Static crypto salt**: `api/user/api-tokens/route.js` uses hardcoded `'salt'` for scrypt
- **Unused shadcn/ui**: avatar, popover, progress, radio-group, skeleton, sonner, tooltip — never imported
- **Unused dep**: `radix-ui` umbrella package — individual `@radix-ui/*` are used instead

## Porting from TechAI

When porting features from `../techai/web/`:
1. Check if the feature depends on AICR agent system (complex, needs schema changes)
2. Adapt imports — TechAI may have different component paths
3. Ensure i18n keys are added to both `ko.json` and `en.json`
4. Add proper auth checks (TechAI patterns may differ)
5. Test with ModolAI's DB schema — run migration if new tables/columns needed
