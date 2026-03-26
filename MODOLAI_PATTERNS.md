# ModolAI Project Exploration Summary

## Project Overview
- **Location**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI`
- **Framework**: Next.js 15.5.9 with React 19
- **Package Manager**: npm@10.8.2
- **Architecture**: App Router (Next.js 15)
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **Icons**: Phosphor Icons (@phosphor-icons/react) + lucide-react fallback

## Key Dependencies
```json
{
  "@phosphor-icons/react": "^2.1.10",
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@radix-ui/react-label": "^2.1.7",
  "@radix-ui/react-switch": "^1.2.6",
  "recharts": "^3.2.0",
  "pg": "^8.16.3",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^2.4.3"
}
```

## 1. Icon System (Phosphor Icons)

**File**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/components/icons/index.jsx`

### Strategy
- Converts Phosphor Icons to lucide-react naming convention
- Weight strategy: 
  - Default: "light" (editorial feel)
  - AI icons (Bot, Sparkles): "duotone" (visual emphasis)
  - Status/Feedback: "regular" (clear perception in small sizes)
  - shadcn/ui primitives: "regular" (precise rendering)

### Structure
- Wrapper factory `w()` injects default weights
- Export 100+ icon aliases organized by category
- Categories: Navigation, Actions, Status/Feedback, Chat/Message, Admin/Settings, Misc

### Usage Pattern
```jsx
import { Bot, Settings, Check } from '@/components/icons';
<Bot className="h-4 w-4" />
```

---

## 2. Internationalization (i18n)

**Files**:
- Context: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/contexts/LanguageContext.js`
- Hook: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/hooks/useTranslation.js`
- Locales: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/i18n/en.json` (1268 lines)
- Locales: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/i18n/ko.json` (1268 lines)

### Implementation Details

**LanguageContext.js**:
- Creates context with `lang`, `setLang`, `t()` function
- Supports 2 languages: 'ko' (default), 'en'
- Stores preference in localStorage with key `modolai-lang`
- Auto-detects browser language on first visit
- Syncs html lang attribute for accessibility
- Interpolation: `t('key.name', { param: 'value' })` → replaces `{param}` in strings

**useTranslation Hook**:
```jsx
const { t, lang, setLang } = useTranslation();
t('admin.agents_mgmt')        // "에이전트 관리" or "Agent Management"
t('common.confirm', { max: 5 }) // Interpolation support
```

**Translation Structure**:
```json
{
  "admin": {
    "agents_mgmt": "Agent Management",
    "change_complete": "Changed",
    "...": "..."
  },
  "admin_api_logs": { ... }
}
```

### Root Layout Setup
**File**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/layout.js`
```jsx
import { LanguageProvider } from './contexts/LanguageContext';
// Wrapped in root layout
<LanguageProvider>
  {children}
</LanguageProvider>
```

---

## 3. Authentication & Authorization

**File**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/auth.js`

### Key Functions
- `verifyToken(request)` → returns decoded JWT payload or null
- `verifyTokenWithResult(request)` → returns `{ valid: boolean, user?: object, error?: string }`
- `verifyAdminWithResult(request)` → checks for 'admin' role
- `verifyAdminOrManagerWithResult(request)` → checks for 'admin' or 'manager' role
- `requireAuth(request)` → returns `{ user: payload }` or null
- `requireAdmin(request)` → checks both auth + admin role
- `updateLastActive(userId)` → throttled to 10-minute intervals

### JWT Structure
- Uses `sub` (subject) as user ID
- Includes `role` field ('admin', 'manager', 'user')
- Token from Authorization header: `Bearer <token>`

### Example Usage in API Routes
```javascript
export async function POST(request) {
  const auth = verifyAdminWithResult(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: 401 });
  const { user } = auth;
  // ... proceed
}
```

---

## 4. Database Utilities

**Key Files in `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/lib/`**:
- `postgres.js` - Query wrapper for PostgreSQL
- `config.js` - Configuration management
- `errorHandler.js` - Error handling utilities
- `validation.js` - Input validation
- `tokenManager.js` - JWT token operations
- `apiTokenUtils.js` - API token management
- `jwtUtils.js` - JWT decoding utilities

---

## 5. Component Organization

### AgentSelector Component
**File**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/components/AgentSelector.js`

```jsx
export default function AgentSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const [visibleAgents, setVisibleAgents] = useState(ALL_AGENTS);

  // Fetches agent visibility from /api/agents/list
  // Routes to different agents: '/' (Chat), '/agent/7' (PPT Maker)
  
  // Returns null if ≤1 agent visible
  return (
    <div>
      <select onChange={handleChange}>
        {visibleAgents.map(agent => ...)}
      </select>
    </div>
  );
}
```

**ALL_AGENTS**:
```javascript
[
  { id: 'chat', name: 'Chat', path: '/', agentId: null },
  { id: 'agent7', name: 'PPT Maker', path: '/agent/7', agentId: '7' }
]
```

### Agent Pages
- `/app/page.js` - Main Chat (uses AgentSelector)
- `/app/agent/[id]/page.js` - Agent detail pages (PPT Maker, Chart Maker, Virtual Meeting)
- `/app/chat2/page.js`, `/app/chat3/page.js`, `/app/chat1/page.js` - Additional chat variants

### Admin Components
**Location**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/components/admin/`
- `AnalyticsCharts.js` - Only admin component file currently (38KB)

### Admin Pages
**Location**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/`
- `layout.js` - Admin layout with sidebar navigation (31KB)
- `page.js` - Admin dashboard redirect
- `agents/` - Agent management page
- `analytics/` - Analytics dashboard
- `api-keys/` - API key management
- `api-tokens/` - API token management
- `dashboard/` - Main dashboard
- `database/` - Database viewer
- `users/` - User management
- `models/` - Model management
- `settings/` - Settings page
- And 10+ other admin sections

---

## 6. Admin Layout Architecture

**File**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/admin/layout.js` (31KB)

### Features
- Client-side ('use client')
- Sidebar with drag-reorder capability (@dnd-kit integration)
- Menu items editable with inline editing mode
- Role-based menu visibility (admin-only items hidden for non-admins)
- Breadcrumb navigation
- Dark mode toggle
- AdminAuthProvider wrapper
- Translation support via useTranslation hook

### Menu Item Structure
```javascript
ADMIN_ONLY_MENU_IDS = ['messages', 'direct-messages', 'external-api-logs', 'database']
```

### Sortable Navigation with dnd-kit
- Uses @dnd-kit/core, @dnd-kit/sortable
- Supports nested menu items (children)
- Reorder mode with save/cancel
- Edit mode for menu names

---

## 7. Context Providers

### AlertContext
**File**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/contexts/AlertContext.js`
- Provides `alert()` and `confirm()` methods
- Usage: `const { alert, confirm } = useAlert();`

### AdminAuthContext
**File**: `/Users/jiwonkim/Desktop/kimjiwon/ModolAI/app/contexts/AdminAuthContext.js`
- Provides admin authentication state
- Usage: `const { isReadOnly } = useAdminAuth();`

### LanguageContext
Already covered in section 2

---

## 8. Directory Structure

```
app/
├── admin/
│   ├── layout.js (main admin sidebar)
│   ├── agents/page.js
│   ├── analytics/
│   ├── api-keys/
│   ├── users/
│   ├── models/
│   ├── database/
│   ├── dashboard/
│   ├── settings/
│   └── [11+ other admin sections]
├── agent/
│   └── [id]/page.js
├── chat/
├── chat1/, chat2/, chat3/
├── components/
│   ├── icons/index.jsx (Phosphor icon mappings)
│   ├── AgentSelector.js
│   ├── admin/AnalyticsCharts.js
│   ├── ui/ (shadcn/ui components)
│   └── [50+ other components]
├── contexts/
│   ├── LanguageContext.js
│   ├── AlertContext.js
│   └── AdminAuthContext.js
├── hooks/
│   ├── useTranslation.js
│   ├── useChat.js
│   ├── useChatSender.js
│   ├── useModelManager.js
│   └── [5+ other hooks]
├── lib/
│   ├── i18n/
│   │   ├── en.json
│   │   └── ko.json
│   ├── auth.js
│   ├── config.js
│   ├── postgres.js
│   ├── tokenManager.js
│   └── [20+ utility files]
├── api/
│   ├── agents/
│   ├── admin/
│   └── [other API routes]
├── page.js (main entry, uses AgentSelector)
└── layout.js (root layout with LanguageProvider)
```

---

## 9. Styling System

### CSS Framework
- Tailwind CSS 4 with @tailwindcss/postcss
- Class utilities: `bg-muted`, `border-border`, `text-foreground`, etc.
- Dark mode support: `dark:` prefix variants

### Component Styling
- shadcn/ui components use cn() utility for class merging
- `tailwind-merge` for intelligent class merging
- `clsx` for conditional classes

### Theme Colors
- `foreground`, `background`, `muted`, `border`, `ring`
- Theme tokens imported from design system

---

## 10. Build & Development

### Scripts
```bash
npm run dev              # Development with turbopack
npm run build            # Production build (SKIP_DB_CONNECTION=true)
npm run start            # Production start
npm run lint             # ESLint check
npm run create-admin     # Create admin user
npm run setup-postgres   # PostgreSQL schema setup
```

### Build Configuration
- **Database Skip**: `SKIP_DB_CONNECTION=true` during build
- **Node Env**: Configurable (development/production)
- **Turbopack**: Available for faster dev builds

---

## 11. Key Patterns & Conventions

### Page Component Pattern
```jsx
'use client';
import { useTranslation } from '@/hooks/useTranslation';
import { useAlert } from '@/contexts/AlertContext';
import { Bot, Settings } from '@/components/icons';

export default function PageName() {
  const { t } = useTranslation();
  const { alert, confirm } = useAlert();
  
  return (
    <div>
      <h1>{t('key.name')}</h1>
      <Bot className="h-4 w-4" />
    </div>
  );
}
```

### API Route Pattern
```jsx
import { verifyAdminWithResult } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const auth = verifyAdminWithResult(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  // ... implementation
}
```

### Hook Pattern
```jsx
const { t, lang, setLang } = useTranslation();
const { alert, confirm } = useAlert();
const { isReadOnly } = useAdminAuth();
```

---

## 12. Notable Implementation Details

### className Patch
- Root layout includes a global className patch for browser compatibility
- Handles DOMTokenList, SVGAnimatedString, and other edge cases
- Fallback to empty string if issues occur

### Translation Fallback
- If translation key not found in current language, falls back to Korean
- If still not found, returns the key itself
- Supports parameter interpolation: `{paramName}`

### Agent Visibility
- AgentSelector fetches `/api/agents/list` on mount
- Filters agents based on `visibilityMap` from API
- Caches with token from localStorage

### Last Active Tracking
- Throttled to 10-minute intervals in updateLastActive()
- Prevents excessive DB updates

---

## Summary for Integration

### For New Features:
1. **Icons**: Add to `/app/components/icons/index.jsx` following Phosphor → lucide-react naming
2. **i18n**: Add keys to `en.json` and `ko.json`, use `const { t } = useTranslation()`
3. **Admin Pages**: Create in `/app/admin/[section]/page.js`, implement auth check, use admin layout
4. **API Routes**: Use `verifyAdminWithResult()` or `verifyTokenWithResult()` from auth.js
5. **Components**: Follow 'use client' pattern, use shadcn/ui for primitives, Phosphor icons

### Key Files to Reference:
- Icon system: `/app/components/icons/index.jsx`
- i18n setup: `/app/contexts/LanguageContext.js`
- Auth: `/app/lib/auth.js`
- Admin layout: `/app/admin/layout.js`
- AgentSelector: `/app/components/AgentSelector.js`
