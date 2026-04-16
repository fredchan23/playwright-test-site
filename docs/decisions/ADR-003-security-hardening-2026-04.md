# ADR-003: Security Hardening and Quality Fixes (April 2026)

## Status
Accepted

## Date
2026-04-16

## Context
A five-axis code review (correctness, readability, architecture, security, performance) was conducted
against the full codebase. The review identified ten prioritised issues ranging from exposed secrets
in browser console logs through to missing error boundaries and unbounded database queries.

The site is a Playwright test target (LMS for automation training) deployed on Google Cloud Run via
Cloud Build, with Supabase as the backend.

## Decisions and Rationale

### P1 — Remove all console.log / console.error debug statements

**Files changed:** `src/pages/LessonDetailPage.tsx`

Fourteen debug log calls in `loadThumbnails()` and `getFileUrl()` were emitting user IDs, lesson IDs,
and file storage paths to the browser console. Any user opening DevTools could read this information.
All debug statements were removed. Bare `catch {}` clauses replaced catch blocks whose only action was
a removed `console.error`.

### P2 — Rotate Supabase anon key *(done manually)*

The anon key `sb_publishable_JRcXVmiNGHH4bvhM1a3cMQ_ehmhvo9k` was exposed in this review session.
The key was regenerated in the Supabase dashboard, the new value stored in GCP Secret Manager, and a
Cloud Build redeploy triggered to bake the new key into the production bundle.

**Note:** Because Vite inlines `VITE_*` variables at build time, rotating a key requires a full
redeploy — updating Secret Manager alone has no effect on the running Cloud Run revision.

### P3 — Add `.env.local` to `.gitignore` *(done manually)*

`.env.local` was not listed in `.gitignore`, risking future accidental commits of local credentials.

### P4 — Fix misleading RLS policy on `profiles` table

**Files changed:** `supabase/migrations/20260416000000_fix_profiles_select_policy.sql`

The migration `20251106062657_fix_security_issues.sql` consolidated two SELECT policies:

- `"Users can view own profile"` → `USING (uid = id)`
- `"Authenticated users can search profiles by email"` → `USING (true)`

The merged form was written as `USING ((select auth.uid()) = id OR true)`, which is logically
equivalent to `USING (true)` but reads as a bug. The new migration drops the old policy and recreates
it as `USING (true)` with the policy renamed to `"Authenticated users can read all profiles"`.

**Why `USING (true)` is correct:** The lesson sharing feature requires authenticated users to look up
other users by email. Restricting reads to own-profile only would break sharing. A more restrictive
alternative (own-profile only, with sharing lookups moved to a server-side edge function) was
considered and deferred as Option B for a future iteration.

### P5 — Wrap `loadData` in try/catch with error UI in LibraryPage

**Files changed:** `src/pages/LibraryPage.tsx`

`loadData()` used `Promise.all` with no error handling. Any Supabase query failure left the page in
a silent empty state. Changes:

- Added `loadError` state
- Wrapped `Promise.all` in `try/catch/finally` (`setLoading(false)` moved to `finally`)
- Added explicit error throws for Supabase error objects returned from individual queries
- Added an error screen with a Retry button (`data-testid="library-error"`) rendered before the main UI

### P6 — Surface delete and share-revocation errors to the user

**Files changed:** `src/pages/LessonDetailPage.tsx`

Two silent failure paths were fixed:

1. **Delete failure:** Added `deleteError` state. On catch, the dialog stays open and shows
   "Failed to delete lesson. Please try again." (`data-testid="lesson-detail-delete-error"`).
   Cancelling the dialog clears the error.

2. **Revoke failure:** `handleRevoke` in `ShareDialog` reused the existing `error` state to surface
   "Failed to remove user. Please try again." on a Supabase delete error, keeping the user in the
   shared-users list.

### P7 — Non-atomic file upload *(skipped)*

Lesson creation uploads files sequentially after the lesson record is created. A mid-upload failure
leaves a partial lesson. This was assessed as low risk for a training/test site because:
- Owners can edit or delete the partial lesson
- The failure mode is visible (lesson exists but files are missing)
- A proper fix (rollback on failure, or draft/publish pattern) carries disproportionate complexity

### P8 — Add React Error Boundary

**Files changed:** `src/components/ErrorBoundary.tsx` (new), `src/App.tsx`

Without an error boundary, any unhandled render-time exception produces a blank white screen with no
recovery path. A class-based `ErrorBoundary` component was added wrapping the `<Routes>` tree in
`App.tsx`. On catch it renders a centred message with a Reload button
(`data-testid="error-boundary"`). The boundary has zero effect on normal operation.

### P9 — Reduce signed URL duration from 1 hour to 15 minutes *(done manually)*

**Files changed:** `src/pages/LessonDetailPage.tsx`

`createSignedUrl(filePath, 3600)` was changed to `createSignedUrl(filePath, 900)`. Shortening the
window from 60 minutes to 15 minutes reduces the exposure period if a signed URL is exfiltrated.

### P10 — Limit Q&A message history to 50 most recent messages

**Files changed:** `src/components/LessonQAPanel.tsx`

The history query fetched all messages with no limit. The fix fetches the 50 most recent messages
(ordered descending, then reversed in JS for display). Rationale:

- The edge function's `HISTORY_LIMIT = 6` means Claude only ever receives the last 6 messages
  regardless, so unbounded loading provides no AI quality benefit
- 50 messages is generous coverage for any realistic training conversation
- A Clear button already exists for users who want to reset context
- True lazy-load pagination (load more on scroll-up) was considered and deferred as disproportionate
  complexity for this site

## Consequences

- Browser console no longer leaks internal IDs or file paths
- Library page and lesson detail page now surface errors to users instead of failing silently
- The app survives render-time crashes instead of going blank
- Q&A panel query is bounded, preventing memory bloat for long conversations
- The `profiles` RLS policy intent is now self-documenting
- All changes are additive or narrowly surgical — no architectural regressions introduced
