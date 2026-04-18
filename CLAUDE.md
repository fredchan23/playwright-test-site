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
Schema lives in `supabase/migrations/`. Apply via Supabase dashboard or CLI. Local Supabase CLI requires Docker — not available in this WSL environment.

### Supabase Edge Functions
Located in `supabase/functions/`. Three functions support the Q&A feature:
- **lesson-qa-index** — checks whether a lesson has indexable PDF files
- **lesson-qa-ask** — sends question + PDF content to Gemini 2.5 Flash (Vertex AI), persists messages
- **lesson-qa-clear** — deletes all Q&A messages for a lesson

All Supabase changes (edge functions, migrations) are deployed **manually via the Supabase dashboard** — do not suggest CLI deploy commands.

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

### Deployment
Google Cloud Run via Cloud Build (`cloudbuild.yaml`). The app is containerized with nginx (`Dockerfile`, `nginx.conf`). See `docs/DEPLOYMENT.md` for full GCP setup instructions.

**Cloud Build gotchas:**
- `package.json` and `package-lock.json` **must stay committed** — Cloud Build runs `npm ci` which requires both. Never add them to `.gitignore`.
- Keep vite pinned to `^7` (not 8+) until `@vitejs/plugin-react` declares support for vite 8. Bumping vite to 8 causes an ERESOLVE peer dependency failure in `npm ci`.

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

### Outstanding (next session)

- **All 45 local tests now passing** as of 2026-04-18.
- **Cloud Build step 4 fix committed** — needs a triggered build to confirm secrets (`TEST_*`, `SUPABASE_SERVICE_ROLE_KEY`) are provisioned in Secret Manager under the expected names.

## Project Docs (git-ignored, local only)
All specification and planning documents live in `docs/` and `tasks/` — both are git-ignored.
- `docs/SPEC.md` — feature enhancement specifications
- `docs/enhancements-plan.md` — implementation plan for the 2026-04-17 enhancements
- `docs/enhancements-todo.md` — task checklist (all complete)
- `tasks/plan.md` / `tasks/todo.md` — prior Q&A feature implementation plan
- `tasks/playwright-plan.md` / `tasks/playwright-todo.md` — Playwright regression suite plan (pending)
