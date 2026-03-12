[한국어](README.md)

# ModolAI

ModolAI is an open-source, self-hosted AI chat platform built with Next.js 15.

It combines multi-model chat, agent workflows, admin operations, OpenAI-compatible APIs, direct messaging, board/notice features, and compliance tooling in a single JavaScript stack.

## Highlights

- Next.js 15 App Router + React 19
- shadcn/ui-based component system with monochrome design tokens
- Multi-provider model routing (Ollama, OpenAI-compatible, Gemini)
- OpenAI-compatible API (`/v1/chat/completions`, `/v1/models`, `/v1/embeddings`, `/v1/rerank`)
- Admin control panel (users, models, model servers, logs, settings, analytics)
- PII detection/testing and log views
- Local login + generic OAuth SSO flow
- Built-in PPT creation workflow (`app/components/PPTMaker.js`)
- i18n support (Korean / English)

## Tech Stack

- Framework: Next.js 15.5.9
- Runtime: React 19.2.1
- Language: JavaScript
- UI: shadcn/ui + Tailwind CSS v4
- Database: PostgreSQL (Supabase-compatible via connection string)
- Auth: JWT + refresh token
- Charts: Recharts
- Package manager: npm

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+

### Install

```bash
git clone <your-fork-or-repo-url> modol
cd modol
npm install
```

### Environment

```bash
cp .env.development .env.local
```

Required values in `.env.local`:

```env
JWT_SECRET=your-secret
POSTGRES_URI=postgresql://user:password@localhost:5432/modol
```

Optional values:

```env
TZ=UTC
SKIP_DB_CONNECTION=false
OAUTH_URL=https://oauth.example.com
OAUTH_AUTH_PATH=/cau/v1/idpw-authorize
OAUTH_COMPANY_CODE=ORG
OAUTH_CLIENT_ID=
OAUTH_CLIENT_SECRET=
```

### Database Bootstrap

```bash
createdb modol
npm run setup-postgres
npm run create-admin
```

Default admin account:

- Email: `admin@modol.ai`
- Password: `modol@admin`

### Run

```bash
npm run dev
```

Build verification:

```bash
SKIP_DB_CONNECTION=true npm run build
```

## Project Layout

- `app/` — Next.js app routes, pages, and API handlers
- `app/admin/` — Admin UI pages
- `app/api/` — Application API routes
- `app/components/` — Shared UI and feature components
- `app/components/ui/` — shadcn/ui primitives
- `app/lib/` — Auth, DB, logging, model-server, and utilities
- `app/lib/i18n/` — Internationalization (Korean / English)
- `scripts/` — Setup/admin/diagnostic scripts

## Migration Status

Completed:

- Company-specific branding cleanup
- Monochrome shadcn/ui migration across chat/admin/auth/profile flows
- Admin page migrations (dashboard/users/settings/env + logs/messages/analytics)
- Remaining component migrations including PPTMaker and modal/toggle/spinner utilities
- SSO generalization (removed Swing-specific route/page)
- Timezone configuration moved to env-driven session setup
- Legacy utility class removal (`btn-*`, `input-primary`, `card`)
- `modol` branding updated to `ModolAI` in package metadata and defaults
- Full i18n (Korean/English) applied across all pages and components
- Security audit and patch (API endpoint authentication)

## Verification

Latest full build check:

- Command: `SKIP_DB_CONNECTION=true npm run build`
- Result: success (warnings only)

## Contributing

See `CONTRIBUTING.md`.

## License

MIT. See `LICENSE`.
