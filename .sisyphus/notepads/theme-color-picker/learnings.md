# Theme Color Picker — Learnings

## [2026-03-13] Session Init

### Architecture
- CSS variables: `app/globals.css` — `:root` (lines 348-382), `.dark` (384-417), `@supports oklch` `:root` (420-453), `@supports oklch` `.dark` (455-488)
- Settings DB: `settings` table, `config_type = 'general'`, auto-column-add via `ensureSettingsColumns()` (route.js:21-97)
- Settings API pattern: PUT handler in `app/api/admin/settings/route.js` — destructure fields, validate, build dynamic SQL
- Public settings: `app/api/public/settings/route.js` — no auth, SELECT specific columns, return JSON
- SiteSettings.js: loaded in root layout.js, fetches `/api/public/settings`, applies branding to DOM

### Critical Implementation Notes (from Metis)
- **Dual injection required**: `:root` vars → `document.documentElement.style.setProperty()` (inline), `.dark` vars → dynamic `<style id="modolai-theme-dark">` in `<head>` (inline style cannot scope to `.dark`)
- **Reset**: use `removeProperty()` not empty string — `removeProperty` restores `globals.css` defaults
- **FOUC prevention**: `layout.js` inline script must run synchronously, ES5 only (no const/let/arrow fn)
- **HEX beats oklch**: inline style has higher specificity than `@supports` block, so HEX values work fine

### File Structure
- `app/api/admin/settings/route.js` (786 lines) — admin settings CRUD
- `app/api/public/settings/route.js` (59 lines) — public read-only settings
- `app/components/SiteSettings.js` (75 lines) — client-side settings applicator
- `app/admin/settings/page.js` (2008 lines) — admin settings UI
- `app/globals.css` (560 lines) — CSS variables
- `app/layout.js` (180 lines) — root layout with inline dark-mode script
- `app/lib/i18n/ko.json` (1223 lines) — Korean i18n, `admin_settings` section starts at line 615, last key `widget_saved` at line 801
- `app/lib/i18n/en.json` (1223 lines) — English i18n, parallel structure

### Key Patterns
- Save pattern: each section has its own `save*()` async function that does PUT with specific fields (e.g., `saveSiteBranding` at page.js:464)
- i18n keys go inside `admin_settings` section, alphabetically or appended before closing `}`
- JSONB fields in SQL: use JSON.stringify and add to the special-case check at route.js:702 (alongside `customEndpoints`, `supportContacts`)
- Event broadcasting: use `window.dispatchEvent(new CustomEvent('modolai-xxx-updated', { detail: {...} }))` after save

## [2026-03-13] Task 1: DB Schema + Presets
- themePresets.js created at app/lib/themePresets.js with 6 presets: amber-soft, blue, green, purple, rose, slate
- Each preset has: id, name, nameKo, preview (hex color), light: {...}, dark: {...}
- route.js ensureSettingsColumns() updated with theme_preset VARCHAR(30) and theme_colors JSONB checks
- GET handler camelCase mapping updated: themePreset, themeColors
- defaultSettings object updated with themePreset: 'amber-soft' and themeColors with light/dark vars
- INSERT query updated: added theme_preset, theme_colors columns and parameters (JSON.stringify for themeColors)
- GET response JSON updated: themePreset and themeColors fields with defaults
- Dynamic SQL builder updated: themeColors added to JSONB special-case condition (line 702)
- Verification: node -e "const p = require('./app/lib/themePresets.js'); console.log(Object.keys(p.THEME_PRESETS).length)" outputs 6 ✓

## [2026-03-13] Task 2: i18n Keys
- Added 12 keys to admin_settings section in both ko.json and en.json
- Keys: design_theme, design_theme_desc, preset_palettes, custom_color, custom_color_desc, primary_color, current_theme, theme_saved, theme_reset, theme_reset_confirm, theme_preview, apply_theme
- Position: appended after widget_saved key (last key in admin_settings section)
- Files modified: app/lib/i18n/ko.json (lines 802-813), app/lib/i18n/en.json (lines 802-813)
- Verification: Both files load correctly with valid JSON syntax
- Evidence saved to .sisyphus/evidence/task-2-i18n-keys.txt

## [2026-03-13] Task 3: Amber Color Softening
- Modified app/globals.css: softened amber colors to 75% lighter tone
- :root HEX block (lines 356, 368, 369, 371, 376, 381):
  - --primary: #d97706 → #e5a63b
  - --ring: #f59e0b → #f5be5b
  - --chart-1: #d97706 → #e5a63b
  - --chart-3: #f59e0b → #f5be5b
  - --sidebar-primary: #d97706 → #e5a63b
  - --sidebar-ring: #f59e0b → #f5be5b
- .dark HEX block (lines 391, 403, 404, 406, 411, 416):
  - --primary: #f59e0b → #f5be5b
  - --ring: #fbbf24 → #fcd480
  - --chart-1: #f59e0b → #f5be5b
  - --chart-3: #fbbf24 → #fcd480
  - --sidebar-primary: #f59e0b → #f5be5b
  - --sidebar-ring: #fbbf24 → #fcd480
- @supports oklch :root block (lines 427, 439, 440, 442, 447, 452):
  - --primary: oklch(0.666 0.179 58) → oklch(0.73 0.14 65)
  - --ring: oklch(0.769 0.188 70) → oklch(0.80 0.145 73)
  - --chart-1: oklch(0.666 0.179 58) → oklch(0.73 0.14 65)
  - --chart-3: oklch(0.769 0.188 70) → oklch(0.80 0.145 73)
  - --sidebar-primary: oklch(0.666 0.179 58) → oklch(0.73 0.14 65)
  - --sidebar-ring: oklch(0.769 0.188 70) → oklch(0.80 0.145 73)
- @supports oklch .dark block (lines 462, 474, 475, 477, 482, 487):
  - --primary: oklch(0.769 0.188 70) → oklch(0.80 0.145 73)
  - --ring: oklch(0.828 0.189 84) → oklch(0.85 0.145 80)
  - --chart-1: oklch(0.769 0.188 70) → oklch(0.80 0.145 73)
  - --chart-3: oklch(0.828 0.189 84) → oklch(0.85 0.145 80)
  - --sidebar-primary: oklch(0.769 0.188 70) → oklch(0.80 0.145 73)
  - --sidebar-ring: oklch(0.828 0.189 84) → oklch(0.85 0.145 80)
- Only primary/ring/chart-1/chart-3/sidebar-primary/sidebar-ring changed
- background/foreground/card/border/muted/destructive NOT touched
- Verification: grep output saved to .sisyphus/evidence/task-3-amber-softened.txt

## [2026-03-13] Task 4: API Extension
- Admin PUT: added themePreset (string, 7 valid values) and themeColors (JSONB, HEX validation) to destructuring + validation
- ALLOWED_VARS whitelist: --primary, --primary-foreground, --ring, --chart-1, --chart-3, --sidebar-primary, --sidebar-primary-foreground, --sidebar-ring
- HEX validation regex: /^#[0-9a-fA-F]{6}$/
- Public GET: added theme_preset, theme_colors to SELECT + response + error fallback
- themeColors already in JSONB special-case at line 742 (from Task 1) — no change needed there
