# ModolAI Quick Reference Guide

## File Locations (All Absolute Paths)

### Core System Files
- **Root Layout**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/layout.js`
- **Package.json**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/package.json`
- **Next.js Config**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/next.config.mjs`

### Internationalization (i18n)
- **Language Context**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/contexts/LanguageContext.js`
- **useTranslation Hook**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/hooks/useTranslation.js`
- **English Translations**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/i18n/en.json` (1268 lines)
- **Korean Translations**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/i18n/ko.json` (1268 lines)

### Icon System
- **Icon Mappings**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/components/icons/index.jsx` (256 lines)
  - Maps 100+ Phosphor icons to lucide-react naming
  - Weight strategy: light (default), duotone (AI), regular (status/UI)

### Authentication & Authorization
- **Auth Library**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/auth.js` (151 lines)
  - Functions: `verifyToken()`, `verifyAdminWithResult()`, `requireAuth()`, `updateLastActive()`
- **Admin Auth Context**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/contexts/AdminAuthContext.js`

### Utilities & Helpers
- **PostgreSQL Query**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/postgres.js`
- **Config**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/config.js`
- **Error Handler**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/errorHandler.js`
- **Validation**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/validation.js`
- **Token Manager**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/tokenManager.js`
- **JWT Utils**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/jwtUtils.js`
- **API Token Utils**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/apiTokenUtils.js`
- **Logger**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/logger.js`

### Contexts & Providers
- **LanguageContext**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/contexts/LanguageContext.js`
- **AlertContext**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/contexts/AlertContext.js`
- **AdminAuthContext**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/contexts/AdminAuthContext.js`

### Hooks
- **useTranslation**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/hooks/useTranslation.js`
- **useChat**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/hooks/useChat.js`
- **useChatSender**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/hooks/useChatSender.js`
- **useModelManager**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/hooks/useModelManager.js`
- **useAlert**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/hooks/useAlert.js`
- **useDarkMode**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/hooks/useDarkMode.js`
- **useAgentHistory**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/hooks/useAgentHistory.js`
- **useCustomInstruction**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/hooks/useCustomInstruction.js`

### Components
- **AgentSelector**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/components/AgentSelector.js` (79 lines)
- **Admin Analytics Charts**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/components/admin/AnalyticsCharts.js` (38KB)
- **UI Components** (shadcn/ui): `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/components/ui/`
  - dialog.jsx, button.jsx, input.jsx, textarea.jsx, select.jsx, checkbox.jsx, switch.jsx, etc.
- **Chat Components**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/components/chat/`
  - Sidebar.js, ChatHeader.js, MessageList.js, ChatInput.js, ChatLayout.js

### Main Pages
- **Home/Chat**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/page.js` (20KB, uses AgentSelector)
- **Agent Detail**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/agent/[id]/page.js`
- **Chat Variants**: 
  - `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/chat/page.js`
  - `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/chat1/page.js`
  - `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/chat2/page.js`
  - `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/chat3/page.js`

### Admin Pages & Layout
- **Admin Layout**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/layout.js` (31KB)
  - Sidebar with drag-reorder, role-based menu visibility, dark mode toggle
- **Admin Dashboard**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/page.js`
- **Agent Management**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/agents/page.js`
- **Other Admin Sections**:
  - `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/analytics/`
  - `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/api-keys/`
  - `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/api-tokens/`
  - `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/users/`
  - `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/models/`
  - `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/database/`
  - `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/settings/`
  - `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/dashboard/`
  - And 10+ more sections

### API Routes
- **Base Path**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/api/`
- **Agent APIs**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/api/agents/`
- **Admin APIs**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/api/admin/`

---

## Usage Patterns

### Use i18n in a Component
```jsx
'use client';
import { useTranslation } from '@/hooks/useTranslation';

export default function MyComponent() {
  const { t, lang, setLang } = useTranslation();
  return <h1>{t('admin.agents_mgmt')}</h1>;
}
```

### Use Icons
```jsx
import { Bot, Settings, Check } from '@/components/icons';
<Bot className="h-4 w-4" />
<Settings weight="duotone" />
```

### API Route Authentication
```jsx
import { verifyAdminWithResult } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const auth = verifyAdminWithResult(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const { user } = auth;
  // ... implementation
}
```

### Use Alert/Confirm
```jsx
import { useAlert } from '@/contexts/AlertContext';

export default function MyComponent() {
  const { alert, confirm } = useAlert();
  
  const handleDelete = async () => {
    if (await confirm('Are you sure?')) {
      // ... delete logic
      alert('Deleted successfully!');
    }
  };
}
```

### Add Admin Page
1. Create `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/[section]/page.js`
2. Use layout from admin/layout.js
3. Add translation keys to en.json and ko.json
4. Verify auth with `verifyAdminWithResult()`

### Add Translation Keys
1. Open `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/i18n/en.json`
2. Open `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/i18n/ko.json`
3. Add keys in same structure
4. Use: `t('section.key')` or `t('section.key', { param: value })`

---

## Key Constants & Configuration

### Supported Languages
- `ko` (Korean) - Default
- `en` (English)
- Storage key: `modolai-lang`

### Admin-Only Menu Items
```javascript
['messages', 'direct-messages', 'external-api-logs', 'database']
```

### Agent IDs
- `chat` - Main chat interface (path: `/`)
- `agent7` - PPT Maker (path: `/agent/7`)
- `agent1` - Virtual Meeting
- `agent10` - Chart Maker

### User Roles
- `admin` - Full access
- `manager` - Elevated access
- `user` - Regular user

### JWT Token
- Uses `sub` field for user ID
- Includes `role` field for authorization
- Header format: `Authorization: Bearer <token>`
- Verified with JWT_SECRET from config

---

## Architecture Notes

### Icon System
- **Strategy**: Phosphor (via @phosphor-icons/react) → lucide-react naming convention
- **Weights**: light (default), duotone (AI), regular (UI primitives)
- **Organization**: Navigation, Actions, Status, Chat, Admin, Misc categories

### i18n Implementation
- **Storage**: localStorage (`modolai-lang`)
- **Fallback**: Korean → English → key itself
- **Interpolation**: `{paramName}` syntax
- **Detection**: Browser language on first visit

### Authentication Flow
1. JWT in Authorization header: `Bearer <token>`
2. Verify with `verifyTokenWithResult()` or `verifyAdminWithResult()`
3. Check role: `admin`, `manager`, or `user`
4. Track last activity (throttled to 10 min)

### Admin Panel
- **Sidebar**: Drag-reorder, menu edit mode, role-based visibility
- **Components**: dnd-kit for drag-and-drop, dark mode toggle, breadcrumbs
- **Auth**: AdminAuthProvider wrapper, read-only mode for non-admins

---

## Build & Development Scripts

```bash
npm run dev              # Development with turbopack
npm run build            # Production build (SKIP_DB_CONNECTION=true)
npm run start            # Production start
npm run lint             # ESLint check
npm run create-admin     # Create admin user
npm run setup-postgres   # PostgreSQL schema setup
```

---

## Dependencies Summary

**UI & Styling**:
- Tailwind CSS 4, shadcn/ui, Phosphor Icons, Lucide React

**State & Effects**:
- React 19, Next.js 15 App Router

**Drag & Drop**:
- @dnd-kit/core, @dnd-kit/sortable

**Database & Auth**:
- pg (PostgreSQL), jsonwebtoken, bcryptjs

**Charts & Data**:
- recharts

**Utilities**:
- clsx, tailwind-merge, sonner (toast)

---

Generated: 2026-03-26
ModolAI Pattern Documentation Complete
