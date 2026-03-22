[한국어](README.md)

# ModolAI

ModolAI is an **open-source, self-hosted AI chat platform** built with Next.js 15.

It combines multi-model chat, agent workflows, admin operations, OpenAI-compatible APIs, direct messaging, board/notice features, and compliance tooling in a single JavaScript stack.

---

## Key Features

| Feature | Description |
|---------|-------------|
| Multi-Model Chat | Connect Ollama, OpenAI-compatible, Gemini models simultaneously; select per room |
| Agent System | Create/manage agents with role/department/individual permissions, built-in PPT maker |
| Draw (Canvas) | AI generates HTML visualizations with live preview (sandboxed iframe) |
| Custom Instruction | Per-room user-defined system prompts |
| OpenAI-Compatible API | `/v1/chat/completions`, `/v1/models`, `/v1/embeddings`, `/v1/rerank` |
| Admin Panel | Users, models, model servers, logs, settings, analytics dashboard |
| DB Viewer | Admin database browser with search/sort/CRUD + column description tooltips |
| PII Detection | Personal information detection/testing and log viewer |
| Community | Notices, board, comments, markdown editor, direct messages |
| Auth | Local login + generic OAuth SSO, JWT refresh tokens |
| i18n | Full Korean / English support |
| Theming | Presets + custom colors, dark/light mode |

---

## Tech Stack

| Item | Version/Tool |
|------|-------------|
| Framework | Next.js 15.5.9 |
| Runtime | React 19.2.1 |
| Language | JavaScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| Database | PostgreSQL 14+ (Supabase-compatible) |
| Auth | JWT + refresh token |
| Charts | Recharts |
| Package Manager | npm |

---

## Quick Start

### Step 1: Prerequisites

Make sure the following are installed:

- **Node.js 20+** — [Download](https://nodejs.org/)
- **PostgreSQL 14+** — [Download](https://www.postgresql.org/download/)

Verify installation:

```bash
node --version   # v20.x.x or higher
psql --version   # 14.x or higher
```

### Step 2: Clone the Project

```bash
git clone https://github.com/flykimjiwon/ModolAI.git
cd ModolAI
npm install
```

### Step 3: Environment Setup

```bash
cp .env.development .env.local
```

Open `.env.local` and set the **required values**:

```env
# Required
JWT_SECRET=your-secret-key-here        # Any string for JWT encryption
POSTGRES_URI=postgresql://user:password@localhost:5432/modolai   # PostgreSQL connection URL
```

**Optional settings** (only if needed):

```env
TZ=UTC                                 # Timezone (default: UTC)
SKIP_DB_CONNECTION=false               # Set true to build without DB
OAUTH_URL=https://oauth.example.com    # OAuth server URL
OAUTH_CLIENT_ID=                       # OAuth client ID
OAUTH_CLIENT_SECRET=                   # OAuth client secret
```

### Step 4: Initialize Database

```bash
# Create database in PostgreSQL
createdb modolai

# Auto-create table schemas
npm run setup-postgres

# Create admin account
npm run create-admin
```

Default admin account:

| Field | Value |
|-------|-------|
| Email | `admin@modol.ai` |
| Password | `modol@admin` |

> Change your password after first login for security.

### Step 5: Run

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### Production Build

```bash
npm run build        # Build
npm run start        # Start production server
```

---

## Project Structure

```
ModolAI/
├── app/                    # Next.js app routes
│   ├── admin/              # Admin UI pages
│   │   ├── database/       #   DB viewer (table browse/CRUD)
│   │   ├── users/          #   User management (role changes, deletion)
│   │   ├── agents/         #   Agent management (visibility toggle)
│   │   ├── settings/       #   Site settings (theme, Draw, widgets)
│   │   └── ...             #   Dashboard, logs, analytics, etc.
│   ├── api/                # API routes
│   │   ├── v1/             #   OpenAI-compatible API
│   │   ├── admin/          #   Admin API
│   │   └── webapp-chat/    #   Chat API
│   ├── components/         # Shared UI components
│   │   ├── chat/           #   Chat-related (ChatInput, MessageList, Sidebar, DrawPreviewPanel)
│   │   ├── ui/             #   shadcn/ui primitives
│   │   └── ...             #   PatchNotesModal, NoticePopup, etc.
│   ├── hooks/              # React custom hooks
│   │   ├── useChatSender.js    # Chat message sending logic
│   │   ├── useChat.js          # Chat state management
│   │   └── useTranslation.js   # i18n support
│   └── lib/                # Utility libraries
│       ├── i18n/           #   Translation files (en.json, ko.json)
│       ├── postgres.js     #   DB connection
│       ├── autoMigrate.js  #   Auto schema migration
│       └── modelServers.js #   Model server routing
├── scripts/                # Setup/admin scripts
├── public/                 # Static files
├── docs/                   # Project documentation
└── tests/                  # Test code
```

---

## Feature Guide

### Chat

1. After login, click `+` in the **left sidebar** to create a new chat room
2. Select an AI model from the **model selector** at the top (star icon to set default)
3. Type your message and send — real-time streaming response
4. Image upload supported (drag & drop or clipboard paste)

### Draw (Canvas) Mode

1. Click the **paintbrush icon** on the left side of the chat input to activate Draw mode
2. Request things like "draw a chart", "create a dashboard"
3. When the AI generates HTML code, view it in the **live preview panel**
4. Copy the code or open it in a new tab

> An admin must enable Draw in Settings > Draw first.

### Custom Instruction

1. Click the **person icon** in the chat input area
2. Write your desired system prompt in the modal (max 5,000 characters)
3. Toggle the enable switch and save
4. Automatically applied to all conversations in that chat room

### Admin Panel

Access at `http://localhost:3000/admin` (requires admin or manager role)

| Menu | Features |
|------|----------|
| Dashboard | User/message/token stats, popular model chart, system status |
| User Management | Search/filter, role change (admin/manager/user dropdown), delete |
| Model Management | Drag & drop sorting, enable/disable, PII settings, categories |
| Agents | Create/edit/delete, visibility toggle, permission settings |
| Settings | Site branding, theme, Draw config, chat widget, endpoints |
| DB Management | DB viewer (table browse/search/CRUD), schema repair, backup/restore |
| Logs | Message logs, external API logs, security logs |

### OpenAI-Compatible API

Use ModolAI as an AI server with external tools (Continue, Cursor, etc.):

```bash
# Chat request
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# List models
curl http://localhost:3000/v1/models \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

> API tokens can be issued from Admin Panel > Settings.

---

## Database Migration

When upgrading an existing DB to a newer version:

```bash
# Option 1: Via Admin Panel
# Settings > DB Management > Click "Schema Migration" button

# Option 2: Via API
curl -X POST http://localhost:3000/api/admin/migrate-models \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Auto-migration also runs on each login, automatically adding any missing columns.

---

## Running in Different Environments

### Development

```bash
npm run dev                    # Default dev server
npm run dev:turbopack           # Faster dev server with Turbopack
```

### Production

```bash
npm run build                  # Production build
npm run start                  # Production server
```

### Docker

```bash
docker build -t modolai .
docker run -p 3000:3000 --env-file .env.local modolai
```

---

## Useful Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run setup-postgres` | Initialize DB schema |
| `npm run create-admin` | Create admin account |
| `npm run create-admin:interactive` | Interactive admin creation |
| `npm run test-postgres` | Test DB connection |
| `npm run test:ollama` | Test Ollama endpoints |
| `npm run lint` | Run ESLint |

---

## Troubleshooting

### DB Connection Failure

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

Make sure PostgreSQL is running:

```bash
# macOS
brew services start postgresql@14

# Linux
sudo systemctl start postgresql
```

### Build Errors with DB

To build without a database connection:

```bash
SKIP_DB_CONNECTION=true npm run build
```

### Model Loading Failure

1. Check that Ollama/OpenAI endpoints are correct in Admin Panel > Settings
2. Verify the model server is running: `curl http://localhost:11434/api/tags`

---

## Contributing

See `CONTRIBUTING.md`.

## License

MIT. See `LICENSE`.
