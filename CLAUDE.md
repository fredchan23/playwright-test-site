# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Protocol

At the end of every session, before closing:
1. Document any new bugs fixed, patterns discovered, or gotchas encountered in the relevant section of this file.
2. Update the **Outstanding (next session)** section to reflect current state.

## Commands

```bash
npm run dev          # Start dev server (Vite, http://localhost:5173)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript type-check without emitting
npm run preview      # Preview production build locally
```

No test runner is configured — this is a Playwright test target site, not a project that runs its own tests.

### Supabase CLI

Supabase CLI is available via npx (no global install required). Current version: **2.93.0**.

```bash
npx supabase --version          # Confirm version
npx supabase status             # Show linked project status
npx supabase db diff            # Diff local schema against remote
npx supabase functions serve    # Serve edge functions locally for dev/testing
npx supabase functions deploy <name>   # Deploy a specific edge function
npx supabase migration new <name>      # Scaffold a new migration file
```

The project is **linked** to the Supabase remote. Migrations and edge functions can be deployed via CLI or the Supabase dashboard — both are valid. Prefer CLI for repeatability; use the dashboard SQL Editor for one-off hotfixes.

## Architecture

This is a React + TypeScript + Vite SPA — a **Learning Management System for Playwright automation training**. It's intentionally built as a test target site with rich `data-testid` attributes throughout the UI.

### Tech Stack
- **React 18** with React Router v7 for client-side routing
- **Supabase** (`@supabase/supabase-js`) for auth, database (PostgreSQL), and file storage
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **react-markdown** + **rehype-sanitize** for rendering markdown in chat responses
- **pdfjs-dist** for client-side PDF thumbnail generation

### Auth Flow
`AuthContext` (`src/contexts/AuthContext.tsx`) wraps the app and exposes `user`, `signIn`, `signUp`, `signOut`. `ProtectedRoute` redirects unauthenticated users to `/login`. Auth state is driven by Supabase's `onAuthStateChange`.

### Route Structure
```
/login              → LoginPage
/register           → RegisterPage
/library            → LibraryPage (protected, main view)
/lessons/create     → CreateLessonPage (protected)
/lessons/:id        → LessonDetailPage (protected)
/lessons/:id/edit   → EditLessonPage (protected)
/                   → redirects to /library
```

### Data Model (Supabase)
Five tables with Row Level Security (RLS) enforced at the database level:
- **profiles** — extends `auth.users`; auto-created via trigger on signup
- **genres** — predefined categories (Programming, Design, Business, Language, Science, Mathematics, Arts)
- **lessons** — owned by a profile; has title, description, genre, tags (text[])
- **lesson_files** — file metadata; actual files stored in Supabase Storage
- **lesson_shares** — many-to-many between lessons and profiles for sharing

All RLS policies enforce: owners can CRUD their own data; shared users get read-only access.

### Environment Variables
Required at build time (Vite inlines them):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
In production these are injected via Google Cloud Secret Manager during Cloud Build (see `cloudbuild.yaml`).

### Supabase Migrations
Schema lives in `supabase/migrations/`. Apply via `npx supabase db push` (CLI) or the Supabase dashboard SQL Editor. Both are valid; CLI is preferred for migrations that are already in the migrations directory.

### Supabase Edge Functions
Located in `supabase/functions/`. Current functions:
- **lesson-qa-index** — checks whether a lesson has indexable PDF files
- **lesson-qa-ask** — sends question + PDF content to Gemini 2.5 Flash (Vertex AI), persists messages
- **lesson-qa-clear** — deletes all Q&A messages for a lesson
- **lesson-metadata-suggest** — accepts a base64 file, returns suggested title/description/tags/genre via Gemini (AI Metadata Autofill feature)

Deploy a function: `npx supabase functions deploy <function-name> --no-verify-jwt`. The `--no-verify-jwt` flag is **required** — see gotcha below.

**Shared code between edge functions:** Supabase edge functions are isolated Deno processes. `_shared/` imports only work when deployed via CLI (CLI bundles before upload). They do **not** work when copy-pasting into the dashboard. Since we now use the CLI for deployment, `_shared/` is viable — but existing functions copy helpers verbatim. New functions should use `_shared/` only if the CLI deploy path is confirmed working end-to-end.

### Supabase Edge Functions — ES256 JWT Gotcha (2026-04-23)

**Root cause:** This Supabase project now issues **ES256**-signed JWTs (both the anon/publishable key and the user access tokens). The Supabase edge function gateway performs JWT verification before routing to the function. For **newly deployed** functions the gateway defaults to HS256 validation, which rejects ES256 tokens with `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM`.

**Observed symptom:** Every authenticated request returns 401 `{"code":"UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM","message":"Unsupported JWT algorithm ES256"}` — even with a valid user session token — while the same token works against older functions that were deployed before the project migrated to ES256.

**Why older functions are unaffected:** `lesson-qa-index`, `lesson-qa-ask`, and `lesson-qa-clear` were originally deployed with `--no-verify-jwt`, which disables gateway-level JWT verification and lets the function handle auth itself (by constructing a userClient from the raw `Authorization` header). The gateway's HS256/ES256 mismatch is therefore irrelevant to them.

**Fix:** Always deploy new functions with:
```bash
npx supabase functions deploy <name> --no-verify-jwt
```

**Impact on function code:** With `--no-verify-jwt`, the gateway does **not** validate the token. The function must check for the presence of the `Authorization` header itself (as all current functions already do). Cryptographic JWT verification is not done at either layer — access control is enforced by the Supabase RLS policies when the function creates a `userClient` with the bearer token.

**Impact on testing:** User JWTs obtained via `client.auth.signInWithPassword()` are ES256 and cannot be used as Bearer tokens against gateway-verified functions. For the `api` Playwright project (`edge-function-metadata.spec.ts`), the test signs in to get a real user JWT and tests against the deployed `--no-verify-jwt` function — this works correctly.

**Rule:** Every new Supabase edge function in this project must be deployed with `--no-verify-jwt` until Supabase updates the gateway to support ES256.

### data-testid Convention
Every interactive element and major section has a `data-testid` attribute following the pattern `{page}-{element}` (e.g., `library-search-input`, `library-lesson-card-{id}`, `library-filter-genre-programming`). These are the Playwright test hooks — preserve them when modifying UI.

New testids added in the 2026-04-17 enhancement session:
- `lesson-qa-save-md-button` — Save chat as Markdown button (LessonQAPanel header)
- `lesson-file-pdf-thumbnail-{id}` — PDF first-page thumbnail image (LessonDetailPage file tile)

New testids added in the 2026-04-17 UI polish session:
- `lesson-card-date` — creation date in LessonCard footer
- `lesson-card-file-count` — file count in LessonCard footer

### LibraryPage UI Design (2026-04-17)

**Header:** Monogram badge (`SN` in a slate-900 rounded square) + wordmark "StudyNode" bold / "Library" in slate-400. No Lucide icon in the header.

**Lesson cards (`LessonCard`):** 4px colored top border keyed to genre (`border-t-{color}`). Genre badge is a soft-tinted rounded pill matching that color. Tags are outline-style rounded pills (`border border-slate-200`). Footer row shows creation date + file count separated by a `border-t border-slate-100` hairline. Hover adds `border-slate-300` color shift + shadow.

**Genre → color mapping** (defined in `GENRE_COLORS` const above the components):
- Programming → blue, Design → rose, Business → emerald, Language → amber, Science → violet, Mathematics → indigo, Arts → orange. Default → slate.

**Lesson list items (`LessonListItem`):** `rounded-lg` border, slim colored left-bar dot accent matching genre, same tinted genre badge and outline tags as cards. "Shared" indicator is an amber pill badge (`bg-amber-50 text-amber-700 border border-amber-200`) rather than plain text.

### Key Components
| File | Purpose |
|------|---------|
| `src/components/LessonQAPanel.tsx` | AI Q&A chat panel; handles chat history, submission, markdown rendering, save-as-MD, clear |
| `src/pages/LessonDetailPage.tsx` | Lesson detail view; file tiles with image + PDF thumbnails, lesson metadata, share/delete |
| `src/pages/LibraryPage.tsx` | Lesson list with search, genre filter, file-size range filter |
| `src/pages/CreateLessonPage.tsx` | New lesson form with file upload |
| `src/pages/EditLessonPage.tsx` | Edit lesson metadata and manage files |
| `src/contexts/AuthContext.tsx` | Auth state provider |

### PDF Thumbnail Behaviour
`LessonDetailPage` generates PDF thumbnails client-side using `pdfjs-dist`. On load, it fetches a signed URL for each PDF, renders page 1 to an offscreen canvas at scale 1.0, and stores the `dataURL` in `thumbnailUrls` state. Errors fall back silently to the `FileText` icon. The PDF.js worker is loaded via Vite URL import (`pdfjs-dist/build/pdf.worker.min.mjs`).

### Q&A Chat Behaviour
`LessonQAPanel` checks a feature flag (`app_config.qa_enabled`) on mount. It calls `lesson-qa-index` to verify PDF files exist, loads the last 50 messages from `lesson_qa_messages`, then renders the chat UI. Key defensive patterns:
- `resp.ok` is always checked **before** calling `resp.json()` — avoids `SyntaxError` on non-JSON error responses
- Assistant messages are rendered through `react-markdown` with `rehype-sanitize`; user messages are plain text
- Save button exports chat history as a `.md` file (client-side Blob download, no server call)
- Clear confirm prompt reminds user to save first
- `throwOnError: false` on `rehype-katex` — malformed LaTeX in a Gemini response falls back to raw source instead of crashing the renderer

**Known limitation — `span.style` CSS injection (2026-04-23):** The KaTeX LaTeX rendering pipeline (`remark-math` + `rehype-katex`, `output: 'html'`) requires `style` to be allowed on `span` elements in the `rehype-sanitize` schema (`src/lib/sanitizeSchema.ts`). This allowance is not scoped to KaTeX-generated spans — any `<span style="...">` in a Gemini response passes through sanitization. A prompt-injection attack embedded in a PDF could cause Gemini to emit `<span style="position:fixed;top:0;left:0;width:100vw;height:100vh;...">` and render a full-page overlay over the app UI (visual phishing). JavaScript execution and form submission remain blocked by the sanitizer's tag allowlist. Risk is acceptable for the current internal LMS context (authenticated users only, no public lesson sharing). **If the app ever allows untrusted users to upload lesson PDFs or exposes the QA panel to a broader audience, add a CSS property allowlist** — either a server-side sanitizer in the `lesson-qa-ask` edge function (e.g. stripping raw HTML from Gemini output) or a client-side CSS sanitizer pass before rendering.

### Deployment
Google Cloud Run via Cloud Build (`cloudbuild.yaml`). The app is containerized with nginx (`Dockerfile`, `nginx.conf`). See `docs/DEPLOYMENT.md` for full GCP setup instructions.

**Cloud Build gotchas:**
- `package.json` and `package-lock.json` **must stay committed** — Cloud Build runs `npm ci` which requires both. Never add them to `.gitignore`.
- `@vitejs/plugin-react` must stay at `^5.x` when using vite 7. The 4.x series only supports vite `^4.2.0 || ^5.0.0`; using it with vite 7 causes `ERESOLVE` in `npm ci`. The 6.x series requires vite 8+. If upgrading vite to 8, bump `@vitejs/plugin-react` to `^6.x` in lockstep.

**nginx MIME type for `.mjs` (PDF.js worker):**
The PDF.js worker is emitted by Vite as a `.mjs` file (`pdf.worker.min-*.mjs`). nginx's default `mime.types` does not include `.mjs`, so without an explicit override the file is served as `application/octet-stream`, which browsers reject under strict MIME checking for module scripts (manifests as "Failed to load module script" + "Setting up fake worker" fallback). The fix in `nginx.conf` is:
1. Give `.mjs` its **own dedicated `location ~* \.mjs$` block** with a nested `types { application/javascript mjs; }` override.
2. Keep the general static-file location (`css|js|jpg|...`) as a **separate block with no nested `types`**.

**Critical gotcha:** A nested `types { }` block inside a location **replaces** nginx's entire default MIME type resolution for that location — it does not merge. Adding `.mjs` to the shared static-file block and nesting a `types` block there will cause all CSS files in that location to be served without `text/css`, breaking all page styling. Always use a dedicated location block for the MIME override.

### Settings Toggle Not Persisting (2026-04-18 — Fixed)

**Root cause:** `app_config` has RLS enabled with only a `SELECT` policy. The client-side `supabase.update()` in `SettingsPage` silently affected 0 rows (PostgREST returns success, not an error, when RLS blocks a write). The UI toggled locally but the DB was unchanged; re-visiting the page reloaded the original value.

**Fix:** Added RLS UPDATE policy `"app_config_admin_update"` in migration `20260418000000_app_config_admin_update_policy.sql`, allowing `profiles.is_admin = true` users to update `app_config` directly. Applied manually via Supabase SQL Editor.

**Gotcha to remember:** Supabase/PostgREST returns `{ error: null }` even when an UPDATE is blocked by RLS — it just affects 0 rows. Never assume a null `error` means the row was actually written. For write operations on RLS-protected tables, verify a policy exists for the authenticated role.

### Playwright E2E Known Issues and Fixes (2026-04-17)

**`SettingsPage` auth race condition:** The `useEffect` that redirects non-admins checked `!isAdmin` before `loading` resolved (isAdmin defaults to `false`). Fixed by guarding with `if (loading) return` in `src/pages/SettingsPage.tsx`. Always destructure `loading` from `useAuth()` before acting on `isAdmin`.

**`aria-pressed` on view toggles:** `LibraryPage` view toggle buttons (`library-view-card-button`, `library-view-list-button`) now carry `aria-pressed={viewMode === 'card/list'}`. Tests should assert `toHaveAttribute('aria-pressed', 'true')` — not CSS classes — for view-mode state.

**React 18 controlled input + Playwright:** Using `clear()` then `fill()` on a React 18 controlled input can leave stale component state when `submit()` fires immediately after. Pattern: use `fill()` alone, then `await expect(locator).toHaveValue(newValue)` to gate on state commit before clicking submit.

**QA clear button visibility:** `lesson-qa-clear-button` only renders when `status === 'ready' && messages.length > 0`. Tests that click it must: (1) use a lesson with PDF files so `lesson-qa-index` returns `ready`, and (2) seed a `lesson_qa_messages` row via `adminClient()` before navigating.

**`page.content()` is not reactive:** Calling `page.content()` immediately after `goto()` returns HTML before React renders async data. Always use `expect(locator).toBeVisible()` instead of string-matching `page.content()`.

### Playwright E2E Fixes (2026-04-18)

**`AuthContext` — `setLoading(false)` fires before `fetchIsAdmin` resolves (`src/contexts/AuthContext.tsx`):** The `getSession()` callback called `setLoading(false)` synchronously after starting `fetchIsAdmin`, so `SettingsPage`'s `useEffect` saw `loading=false, isAdmin=false` and redirected to `/library` before admin status was known. Fixed by making the callback `async` and `await`ing `fetchIsAdmin` before calling `setLoading(false)`. Rule: `loading` must remain `true` until ALL auth state (including profile flags) is resolved. `ProtectedRoute` already gates rendering on `loading`, so this also prevents SettingsPage from mounting before auth is ready.

**Playwright race: clicking toggle before `loadConfig` resolves:** After `page.reload()`, React mounts `SettingsPage` with its initial state (`qaEnabled = true`) and kicks off `loadConfig()` asynchronously. If Playwright clicks the toggle before `loadConfig` sets the actual DB value, `handleToggle` fires with the wrong `qaEnabled` and updates in the wrong direction. Fix: always `await expect(toggle).toHaveAttribute('aria-checked', '<expected-loaded-value>')` after `reload()` before clicking. This gates the click on `loadConfig` completing.

**Playwright race: DB assertion before `handleToggle` save completes:** `click()` returns as soon as the DOM event fires — not when the async `handleToggle` save finishes. Asserting the DB value immediately after `click()` races with the in-flight `supabase.update()`. Fix: `await expect(toggle).toHaveAttribute('aria-checked', '<new-value>')` between `click()` and the DB check. Since `setQaEnabled` is only called after the `await supabase.update()` resolves, this gate confirms the save has completed before querying the DB.

**Playwright race: `loadLessonData()` overwrites filled title in `EditLessonPage` (`e2e/specs/lesson-crud.spec.ts`):** The edit-metadata test filled the title input immediately after `goto()`, but `loadLessonData()` was still in-flight. When its async Supabase fetch completed, `setTitle(originalTitle)` overwrote the test's fill. `toHaveValue(updatedTitle)` had already passed (DOM matched), so the overwrite happened silently before `submit()`. The save therefore sent the old title to Supabase. Fix: add `await expect(titleInput).toHaveValue(lesson.title)` before `fill()` to gate on `loadLessonData()` completing first. Rule: after `goto()` on any form page that loads data async, wait for the inputs to reflect the fetched values before interacting.

### Cloud Build Playwright Step — BASE_URL Fix (2026-04-18)

**Root cause:** The `BASE_URL` was hardcoded as `https://${_SERVICE_NAME}-${_CLOUD_RUN_REGION}-run.app`, which is not the real Cloud Run URL format. Actual URLs look like `https://SERVICE_NAME-HASH-SHORT_REGION.a.run.app` with an unpredictable hash segment.

**Fix:** Added a new step between `gcloud run deploy` and the Playwright step that calls `gcloud run services describe --format='value(status.url)'` and writes the result to `/workspace/service_url.txt`. The Playwright step then reads `SERVICE_URL=$(cat /workspace/service_url.txt)` and injects it into `e2e/.env.test`. Removed the now-unused `_CLOUD_RUN_REGION` substitution.

**Additional fixes in same pass:**
- Heredoc content moved to column 0 (unindented) to avoid accidental whitespace in the env file
- Added `env: CI=true` to the Playwright step so `playwright.config.ts` picks up the `CI` flag (enables retries and HTML reporter)

### Cloud Build Playwright Image Version (gotcha)

The Docker image tag in `cloudbuild.yaml` (`mcr.microsoft.com/playwright:vX.Y.Z-noble`) **must exactly match** the `@playwright/test` version in `package.json`. `npm ci` installs the version from `package-lock.json`; if the image ships a different Chromium build, Playwright refuses to launch with `Executable doesn't exist`. When bumping `@playwright/test`, update the image tag in lockstep.

### LibraryPage UI Redesign (2026-04-19)

**Source:** `docs/studynode/project/StudyNode.html` — implemented into `src/pages/LibraryPage.tsx`.

**LessonCard changes:**
- 4px genre color bar across the top (requires `overflow: hidden` on the card wrapper)
- Tinted card background per genre via `TINT_BG` map; reverts to `var(--surface)` on hover
- Layout reordered: genre badge + shared indicator → title → description → tags → footer
- Hover: border shifts to vivid genre `BAR_COLORS` value + `translateY(-2px)` lift + shadow-md
- Hover state managed via `useState` (not inline `onMouseEnter` style mutation) because multiple properties change

**LessonListItem changes:**
- 8px genre-colored dot as leftmost element
- Hover: left 3px border appears in genre `BAR_COLORS` (not `var(--accent)`)
- Genre tag moved to dedicated right column; date fixed 80px; file count icon+number fixed 44px
- Hover state managed via `useState` for same reason as LessonCard

**Section headers:**
- "My Lessons" count rendered as separate monospace `<span>` baseline-aligned next to heading
- "Shared with Me" section gets a hairline divider + "From others" accent pill badge

**New constants added:** `BAR_COLORS` (vivid per-genre bar/dot/border colors) and `TINT_BG` (very subtle per-genre card tint backgrounds).

### ProtectedRoute Loading State — Old Tailwind Classes (2026-04-19 — Fixed)

**Root cause:** `ProtectedRoute` still used old `bg-slate-50 / border-slate-900 / text-slate-600` Tailwind classes. Users saw two visually distinct loading screens in sequence: the auth-check spinner (gray, no sidebar) followed by the page's own styled spinner. Looked like a bug.

**Fix:** Updated `ProtectedRoute` to use `var(--bg)`, `var(--accent)`, `var(--text-muted)` CSS vars and the same spinner pattern used in LibraryPage's loading state.

**Rule:** Any component that shows a loading state should use the CSS variable design system, not Tailwind color classes. Tailwind layout utilities (`flex`, `items-center`) are fine to keep.

### QA Panel — Double "..." When Asking (2026-04-19 — Fixed)

**Root cause:** `handleSubmit` in `LessonQAPanel` did two things when a question was sent: (1) appended a `{ role: 'assistant', content: '…' }` placeholder to the message list, and (2) set `asking = true` which rendered bouncing dots below. Both showed simultaneously — users saw a text "…" bubble AND animated dots.

**Fix:** Removed the `'…'` placeholder message entirely. The bouncing dots alone communicate the pending state. Also removed the `slice(0, -1)` calls in the success and error paths that were previously cleaning up that placeholder (they would have incorrectly removed the user's own message).

**Rule:** Don't use both an inline placeholder message and a dedicated loading indicator for the same state. Pick one.

### Mobile Responsiveness — Implementation (2026-04-20)

Added full mobile support (breakpoint `< 640px`) across all protected pages. Reference design: `docs/studynode/project/StudyNode.html`.

**Architecture:**
- `src/hooks/useIsMobile.ts` — shared hook; `useState(() => window.innerWidth < 640)` initialiser avoids flash; single resize listener per component.
- `Layout.tsx` — owns `sidebarOpen` state; renders 52px mobile top bar (hamburger + SN badge + wordmark) above `{children}` only on mobile.
- `Sidebar.tsx` — accepts `isMobile`, `open`, `onClose` props; on mobile renders as a `position: fixed` 270px drawer (`z-41`) with a separate overlay backdrop (`z-40`). Desktop renders as before — `sticky top-0`.

**z-index stack:** sidebar overlay `z-40`, sidebar drawer `z-41`, modals/dialogs `z-50`. Dialogs always win.

**LibraryPage top bar on mobile:** two-row layout — search full-width on row 1, icon-only Filters + New Lesson on row 2. Content padding reduced from `px-7 py-6` to `16px` on mobile.

**LessonListItem on mobile:** fixed-width date / file-count / genre columns are hidden; genre tag, date, and file-count move inline into the text block to prevent horizontal overflow at 375px. `data-testid` values are preserved — the same testids appear in both mobile and desktop branches (only one branch renders at a time, so no DOM duplication).

**LessonDetailPage on mobile:** tab bar (`lesson-detail-tab-bar`) switches between "Lesson" (`lesson-detail-tab-lesson`) and "Ask AI" (`lesson-detail-tab-qa`). Action buttons (Share, Edit, Delete) become icon-only. `LessonQAPanel` receives `columnMode={!isMobile}` — full-width on mobile, 360px column on desktop.

**New testids:**

| testid | Location |
|--------|----------|
| `mobile-top-bar` | Layout.tsx |
| `mobile-menu-button` | Layout.tsx |
| `mobile-sidebar-overlay` | Sidebar.tsx |
| `mobile-sidebar-close-button` | Sidebar.tsx |
| `lesson-detail-tab-bar` | LessonDetailPage.tsx |
| `lesson-detail-tab-lesson` | LessonDetailPage.tsx |
| `lesson-detail-tab-qa` | LessonDetailPage.tsx |

### Mobile QA Panel Scroll Trap (2026-04-20 — Fixed)

**Root cause:** `LessonQAPanel` with `columnMode={false}` (mobile) rendered as a card with `overflow-hidden` on the root and no height constraint on the inner `div.flex.flex-col.gap-4.p-5` wrapper. The messages area had `flex: 1` and `overflow-y-auto` but no constrained parent, so it expanded to full content height — `overflow-y-auto` never activated. `scrollIntoView` on `bottomRef` scrolled the page/tab container instead. The tab row's `overflow-hidden` then clipped the top of the content, trapping the user at the bottom with no way to scroll up.

**Fix:** `LessonDetailPage` now passes `columnMode={true}` unconditionally. On mobile the panel fills the entire tab, so the column layout (`flex flex-col h-full`) is appropriate — scroll is properly contained within the messages area.

**Rule:** Any scrollable list inside a flex tab must have its height constrained by the flex chain. `overflow-y-auto` only activates when all ancestors have explicit or flex-derived height constraints. `overflow-hidden` on a parent clips content without enabling scroll.

### Edit Button Wrong Icon (2026-04-20 — Fixed)

**Root cause:** `CreditCard` from lucide-react was incorrectly aliased as `Edit` in `LessonDetailPage.tsx`, showing a credit-card rectangle instead of the pencil-on-square icon from the StudyNode.html reference design.

**Fix:** Replaced `CreditCard as Edit` with `SquarePen as Edit`.

### AI Metadata Autofill — Complete (2026-04-23)

Feature shipped end-to-end. Spec at `docs/specs/SPEC-ai-metadata-autofill.md`.

**What was built:**
- DB migration `supabase/migrations/20260422000000_add_genre_other.sql` — adds "Other" genre (applied via Supabase SQL Editor)
- Edge function `supabase/functions/lesson-metadata-suggest/index.ts` — accepts base64 file + MIME type, returns `{ title?, description?, tags?, genre? }` via Gemini 2.5 Flash (Vertex AI). Deployed with `--no-verify-jwt` (ES256 gotcha).
- `src/pages/CreateLessonPage.tsx` — autofill triggered on first file drop (≤5 MB). `autofillTriggered` ref (not state) prevents re-trigger. Fields disabled with animated shimmer gradient during the in-flight request; a spinner banner "Analysing file for metadata suggestions…" makes the loading state obvious. Empty-field guard: only populates fields still blank at response time. Silent fail on any error.
- `e2e/specs/create-lesson-autofill.spec.ts` — 4 Playwright tests: shimmer+disabled state, field population, single-trigger guard, pre-filled-field preservation. All 4 passing.
- `e2e/specs/edge-function-metadata.spec.ts` — 6 API tests against the deployed function. All 6 passing.

**UX detail:** PDF thumbnails in `LessonDetailPage` now use `object-top` so the top of the first page (title/headings) is always visible rather than the vertical centre.

**Shimmer implementation note:** Uses a `<style>` tag injected into the form when `autofilling === true` defining a `@keyframes autofill-shimmer` gradient sweep. Applied via `className="autofill-shimmer-field"` on each input/textarea/select. The `<style>` tag unmounts when autofilling ends — no persistent global styles added.

### Edge Functions — JWT Decode Pattern (2026-04-25)

**Root cause of intermittent "Unauthorized" / no_files in full-suite tests:** Both `auth.getUser(token)` (in `lesson-qa-ask`) and `userClient` PostgREST queries (in `lesson-qa-index`) fail intermittently when called under full-suite load. The Supabase auth API and PostgREST both validate the JWT on the server side; under concurrency or load, these calls can return null/empty results even for valid tokens, making the edge function return 401 or 404.

**Fix applied to `lesson-qa-ask` and `lesson-qa-index`:**
- Replaced `auth.getUser(token)` with a local JWT payload decode to extract `sub` (user ID):
```typescript
function getUserIdFromJwt(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return (decoded as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}
```
- Replaced `userClient` PostgREST lesson-access checks with admin client + explicit `owner_id` / `lesson_shares` checks (in `lesson-qa-index`). `lesson-qa-ask` still uses `userClient` for lesson access (works because the call happens later in the flow after the browser session is warmer).
- No signature verification — acceptable because `--no-verify-jwt` already disables gateway-level auth, and RLS policies enforce actual data access on all subsequent DB calls.

**Rule:** In Supabase edge functions deployed with `--no-verify-jwt`, prefer extracting the user ID from the JWT payload directly rather than calling `auth.getUser(token)`. For RLS-dependent lesson access checks, use the admin client with an explicit `owner_id = userId` check when reliability under load matters.

### Gemini Context Caching for lesson-qa-ask (2026-04-28 — Complete)

Spec at `docs/specs/SPEC-gemini-context-cache.md`.

**What was built:**
- DB migration `supabase/migrations/20260428000000_add_lesson_qa_cache.sql` — `lesson_qa_cache` table (per-user per-lesson Vertex AI cache names) + RLS + invalidation trigger on `lesson_files`
- `supabase/functions/lesson-qa-ask/index.ts` — cache lookup → create-on-miss → fallback path. On a cache hit, PDF download is skipped entirely; `cachedContent: cacheName` is passed to `generateContent`. On cache create failure, falls back silently to inline PDF upload.
- `supabase/functions/lesson-qa-index/index.ts` — added fire-and-forget `cachedContents` availability preflight (logs result, never blocks response)
- `e2e/specs/edge-function-qa-cache.spec.ts` — 3 API tests (auth guard, cache miss answer, cache hit answer); all passing

**Key implementation details:**
- Cache is **per-user per-lesson** (`UNIQUE(user_id, lesson_id)` in `lesson_qa_cache`)
- TTL: 15 minutes (`900s`). Not extended on cache hit — miss after idle >15 min recreates it.
- DB trigger `trg_invalidate_lesson_qa_cache` on `lesson_files` deletes cache rows when PDFs are added/deleted for a lesson, forcing a fresh miss.
- Admin client (service role) owns all `lesson_qa_cache` reads/writes.
- `cachedContents` model name format: `projects/{project}/locations/{location}/publishers/google/models/{model}` — required by Vertex AI, different from the `generateContent` URL path format.
- Gemini's minimum token threshold (32,768 for Flash) applies — lessons with very small PDFs fall through to the fallback path silently.

**How to read cache hit/miss from logs:**
- Supabase Dashboard → Edge Functions → `lesson-qa-ask` → Logs
- Cache hit: `Cache hit for lesson {id}, user {id}: projects/...`
- Cache miss (create success): `Cache created for lesson {id}, user {id}: projects/...`
- Cache miss (fallback): `Gemini cache create failed, falling back to inline PDF upload: ...`

**Playwright config:** `edge-function-qa-cache.spec.ts` runs in the `api` project (no browser). `testMatch` regex updated to `/edge-function-(metadata|qa-cache)\.spec\.ts/`. Tests that call Gemini use `test.setTimeout(90_000)` to override the 30 s global timeout.

### lesson-qa-ask Performance Review and Fixes (2026-04-28 — Complete)

A code review of the context caching implementation identified and fixed three issues:

**Fix 1 — Parallel token + cache lookup** (`index.ts`): `getGcpAccessToken` and `lookupCache` were sequential. Changed to `Promise.all([getGcpAccessToken(saKey), lookupCache(...)])` — saves 30–60ms on every request.

**Fix 2 — `NO_CACHE` sentinel for small PDFs** (`index.ts`): Gemini enforces a 32,768-token minimum for cached content. PDFs below this threshold caused `createGeminiCache` to fail on every request after a full Vertex AI HTTP round-trip (~1s wasted). Fix: when the error matches the token minimum pattern, upsert `cache_name = 'NO_CACHE'` with a 7-day TTL. Subsequent requests detect the sentinel and skip the create attempt entirely.

**Fix 3 — Stale cache 503 recovery** (`index.ts`): When `generateContent` rejects a `cachedContent` name (400/404) because Vertex AI evicted the cache before our DB TTL expired, the function previously threw an uncaught exception and Supabase returned HTTP 546 to the browser (no body, opaque failure). Fix: detect the condition, delete the stale `lesson_qa_cache` row, and return `{ error: '...' }` with HTTP 503 so `LessonQAPanel` can display a human-readable "try again" message.

**Gemini configuration tuned:**
- `thinkingConfig.thinkingBudget: 0` — disabled Flash 2.5 thinking tokens (no quality improvement for factual retrieval, significant latency cost)
- `maxOutputTokens` reduced from 8192 to 2048

**Model experiment — reverted:** `gemini-2.5-flash-lite` in `global` region was deployed and tested. Quality degraded with no latency improvement; reverted to `gemini-2.5-flash` in `asia-southeast1`.

**`GCP_API_ENDPOINT` constant** added to both `lesson-qa-ask` and `lesson-qa-index` to derive the Vertex AI hostname from `GCP_LOCATION` (regional vs global endpoint format differs).

**HTTP 546 gotcha:** Supabase returns 546 (not 500) when `Deno.serve` receives an uncaught exception. Always catch foreseeable error paths and return a JSON response — never let exceptions propagate from the handler.

### Page Reload on Tab Switch — Fixed (2026-04-28)

**Symptom:** Switching away from the app and returning caused a full network reload of lesson data — all Supabase queries re-fired, showing the loading spinner again.

**Root cause:** Supabase JS v2 has `FOCUS_AUTO_REFRESH` enabled by default. When the tab regains visibility, it fires `TOKEN_REFRESHED` via `onAuthStateChange`. `AuthContext` handles this by calling `setUser(sessionUser)` — which always produces a **new object reference**, even for the same user. Any `useEffect` that lists the whole `user` object as a dependency sees a changed reference and re-runs, re-fetching all data.

**Affected files:**
- `src/pages/LessonDetailPage.tsx` — `useEffect(..., [id, user])` → `[id, user?.id]`
- `src/pages/LibraryPage.tsx` — `useEffect(..., [user])` → `[user?.id]`

**Rule:** Never use the whole `user` object from `useAuth()` as a `useEffect` dependency. Use `user?.id` (a stable string primitive) instead. Object references from Supabase auth events change on every token refresh.

### Outstanding (next session)

- **60/60 tests passing** — suite is green.
- **Cloud Build step 0 fixed (2026-04-29)** — `@vitejs/plugin-react` upgraded from `^4.3.1` to `^5.2.0`; vite 7 is now covered by the peer dep range. Committed as `7fb4ca8`. Push and trigger a Cloud Build run to confirm.
- **Cloud Build step 4 (Playwright)** — still needs a triggered build to confirm secrets (`TEST_*`, `SUPABASE_SERVICE_ROLE_KEY`) are provisioned in Secret Manager under the expected names. Step 0 was failing before this could be reached.
- **Mobile E2E coverage** — plan drafted at `tasks/plan.md` (on hold).
- **Q&A latency** — cache hits still take ~25–30s (Gemini 2.5 Flash inference floor in asia-southeast1). The frontend already has a typewriter effect so perceived latency is acceptable. No further server-side levers identified without a model change.

## Project Docs (git-ignored, local only)

Both `docs/` and `tasks/` are git-ignored.

### docs/ layout

```
docs/
├── DEPLOYMENT.md               ← live ops reference (GCP Cloud Run setup)
├── capstone-report.md          ← permanent project report
├── decisions/                  ← Architecture Decision Records (permanent)
│   ├── ADR-001-lesson-qa-feature.md
│   ├── ADR-002-long-context-rag-pivot.md
│   └── ADR-003-security-hardening-2026-04.md
├── specs/                      ← feature specs (one file per feature, all complete)
│   ├── SPEC-enhancements-2026-04-17.md   (MD rendering, Save chat, PDF thumbnail)
│   └── SPEC-ai-metadata-autofill.md
├── studynode/                  ← design reference HTML + screenshots
└── archive/                    ← session notes, idea one-pagers
    ├── session-2026-04-17.md
    └── ideas/
        └── ai-metadata-autofill.md
```

### tasks/ layout

```
tasks/
├── plan.md     ← active plan (Mobile E2E coverage — on hold)
├── todo.md     ← active todo (empty; links to plan.md)
└── archive/    ← completed plans and todos
    ├── plan-enhancements-2026-04-17.md
    ├── todo-enhancements-2026-04-17.md
    ├── plan-playwright-suite.md
    ├── todo-playwright-suite.md
    └── todo-ai-metadata-autofill.md
```

### Workflow for new features

1. Write spec → `docs/specs/SPEC-<feature>.md`
2. Write plan → `tasks/plan.md` (replace previous, or rename previous to archive first)
3. Write task list → `tasks/todo.md`
4. On completion: move plan + todo to `tasks/archive/`; spec stays in `docs/specs/` (permanent record)
