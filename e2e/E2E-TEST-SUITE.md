# StudyNode — E2E Test Suite

End-to-end tests for the StudyNode LMS, written with [Playwright](https://playwright.dev/). The suite covers the full user journey from authentication through lesson management, sharing, AI Q&A, and admin settings.

---

## Design Framework

### Page Object Model (POM)

Every page or panel in the app has a corresponding class in [e2e/page-objects/](page-objects/). Tests import page objects via custom fixtures — they never construct them directly.

| Page Object | Covers |
|---|---|
| `LoginPage` | `/login` — credential form |
| `RegisterPage` | `/register` — sign-up form |
| `LibraryPage` | `/library` — search, filters, view toggle, lesson list |
| `CreateLessonPage` | `/lessons/create` — new lesson form + file upload |
| `EditLessonPage` | `/lessons/:id/edit` — edit form |
| `LessonDetailPage` | `/lessons/:id` — detail view, file tiles, tabs |
| `LessonQAPanel` | AI Q&A chat panel embedded in `LessonDetailPage` |
| `SettingsPage` | `/settings` — admin-only toggle controls |

### Custom Fixtures

[e2e/fixtures/test-fixtures.ts](fixtures/test-fixtures.ts) extends the base Playwright `test` with all page objects as auto-wired fixtures. Every spec imports `{ test, expect }` from this file — not directly from `@playwright/test`.

```ts
import { test, expect } from '../fixtures/test-fixtures';
```

### Admin Helpers

[e2e/helpers/supabase-admin.ts](helpers/supabase-admin.ts) exposes an `adminClient()` (using `SUPABASE_SERVICE_ROLE_KEY`) for seeding and tearing down test data outside the browser. Used in `beforeAll` / `afterAll` hooks.

| Helper | Purpose |
|---|---|
| `lesson-factory.ts` | `createLesson`, `createLessonWithFile`, `deleteLesson` — bypass RLS via service-role key |
| `share-factory.ts` | `shareLesson`, `revokeShare` — create/remove `lesson_shares` rows |
| `qa-helpers.ts` | `seedQAMessage`, `clearQAMessages` — seed `lesson_qa_messages` rows |
| `supabase-admin.ts` | `adminClient()`, `getUserIdByEmail` |

### Test Data

Constants (emails, passwords, tags) live in [e2e/fixtures/test-data.ts](fixtures/test-data.ts). Values are sourced from `e2e/.env.test` at runtime via [e2e/fixtures/global-setup.ts](fixtures/global-setup.ts).

### Test Assets

Binary fixtures used by upload tests are stored in [e2e/assets/](assets/):

| File | Used by |
|---|---|
| `test-document.pdf` | `lesson-crud.spec.ts`, `qa-panel.spec.ts`, `create-lesson-autofill.spec.ts` |
| `test-image.png` | `lesson-crud.spec.ts` |

---

## Playwright Projects (test profiles)

Defined in [playwright.config.ts](../playwright.config.ts):

| Project | Auth state | Runs |
|---|---|---|
| `setup` | none | `auth.setup.ts` — logs in both users and saves storage state |
| `chromium` | `e2e/.auth/regular-user.json` | All specs except `admin-settings` and `edge-function-metadata` |
| `chromium-admin` | `e2e/.auth/admin-user.json` | `admin-settings.spec.ts` only |
| `api` | none (no browser) | `edge-function-metadata.spec.ts` — pure HTTP tests against the deployed edge function |

`chromium` and `chromium-admin` both depend on `setup` completing first.

---

## Test Scenarios

### `auth.spec.ts` — Authentication

| # | Scenario |
|---|---|
| 1 | Register with valid credentials → lands on `/library` |
| 2 | Register with short password → shows password error |
| 3 | Register with duplicate email → shows form error |
| 4 | Login with invalid credentials → shows error message |
| 5 | Logout → lands on `/login`; `/library` redirects back to `/login` |

### `lesson-crud.spec.ts` — Lesson CRUD

| # | Scenario |
|---|---|
| 1 | Create lesson (metadata only) → detail page shows correct title |
| 2 | Create lesson with PDF file → files list shows 1 file; DB row verified |
| 3 | Read lesson → all fields visible on detail page |
| 4 | Edit metadata → updated title confirmed on detail page |
| 5 | Delete → redirected to `/library`; lesson absent from DB |
| 6 | Validation → empty title shows title-error; empty description shows desc-error |
| 7 | Cancel with unsaved changes → confirm dialog; leaving discards changes |

### `library.spec.ts` — Library Page

| # | Scenario |
|---|---|
| 1 | Library loads with seeded lessons → my-lessons heading visible |
| 2 | Empty state → empty-message visible when no lessons |
| 3 | Search by title → results-count updates; clear resets |
| 4 | Genre filter → results scoped to selected genre |
| 5 | Tag filter → results scoped to tag |
| 6 | File-size range filter → results update |
| 7 | Card/list view toggle → switches layout; preference persists |
| 8 | Shared lessons appear under shared-heading after factory share |

### `sharing.spec.ts` — Lesson Sharing

| # | Scenario |
|---|---|
| 1 | Share dialog opens on share-button click |
| 2 | Share with valid user → appears in users list |
| 3 | Share with self → shows share-error |
| 4 | Share with unknown email → shows share-error |
| 5 | Revoke share → user removed from list |
| 6 | RLS visibility — user B sees shared lesson; after revoke it is gone |
| 7 | Duplicate share → shows share-error |

### `qa-panel.spec.ts` — AI Q&A Panel

| # | Scenario |
|---|---|
| 1 | Panel absent from DOM when Q&A disabled |
| 2 | No-files state shown for lesson with no PDFs |
| 3 | Input enabled and panel fully rendered for indexed lesson |
| 4 | Ask a question → user bubble appears; assistant bubble appears `@slow` |
| 5 | Clear history → message list empty |
| 6 | Panel re-appears after Q&A re-enabled |

> `@slow` tests wait for a live Gemini response and may time out under network flakiness. They are expected to be the only non-deterministic tests in the suite.

### `admin-settings.spec.ts` — Admin Settings

| # | Scenario |
|---|---|
| 1 | Admin user sees settings-page-title and settings-qa-toggle |
| 2 | Settings button visible for admin; navigates to `/settings` |
| 3 | Q&A toggle: enabled → disabled; DB value verified |
| 4 | Q&A toggle: disabled → enabled; DB value verified |

### `regular-settings.spec.ts` — Non-Admin Settings Access

| # | Scenario |
|---|---|
| 1 | Regular user navigating to `/settings` is redirected to `/library` |
| 2 | Settings button absent for regular user |

### `create-lesson-autofill.spec.ts` — AI Metadata Autofill

| # | Scenario |
|---|---|
| 1 | Shimmer appears while autofill is in-flight |
| 2 | Fields populate from autofill response |
| 3 | Second file drop does not re-trigger autofill |
| 4 | Autofill does not overwrite a pre-filled title |

### `edge-function-metadata.spec.ts` — Edge Function API (`api` project)

Pure HTTP tests; no browser. Signs in via Supabase JS SDK, sends requests directly to the deployed `lesson-metadata-suggest` function.

| # | Scenario |
|---|---|
| 1 | Returns suggested title, description, tags, genre for a valid PDF |
| 2 | Works with an image MIME type |
| 3 | Missing `file` field returns 400 |
| 4 | Missing `mimeType` field returns 400 |
| 5 | Unauthenticated request returns 401 |
| 6 | Oversized payload (>5 MB) returns 413 |

### `error-states.spec.ts` — Error and Edge Cases

| # | Scenario |
|---|---|
| 1 | Navigating to non-existent lesson shows not-found state |
| 2 | Delete dialog cancel → lesson not deleted |
| 3 | Share dialog close button dismisses dialog without error |
| 4 | Cancel with no changes → no confirm dialog shown |

### `latex-rendering.spec.ts` — LaTeX / KaTeX Rendering

| # | Scenario |
|---|---|
| 1 | LaTeX in assistant response renders as KaTeX HTML |

---

## Configuration

### Environment File

Copy [e2e/.env.test.example](\.env.test.example) to `e2e/.env.test` and fill in all values. This file is gitignored — never commit it.

```dotenv
BASE_URL=http://localhost:5173

TEST_REGULAR_USER_EMAIL=
TEST_REGULAR_USER_PASSWORD=

TEST_ADMIN_USER_EMAIL=
TEST_ADMIN_USER_PASSWORD=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

| Variable | Purpose |
|---|---|
| `BASE_URL` | App origin under test (default: `http://localhost:5173`) |
| `TEST_REGULAR_USER_EMAIL/PASSWORD` | Credentials for the non-admin test account |
| `TEST_ADMIN_USER_EMAIL/PASSWORD` | Credentials for the admin test account |
| `SUPABASE_URL` | Supabase project URL (used by admin helpers for DB seeding) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for bypassing RLS in test setup |

### Playwright Config Highlights ([playwright.config.ts](../playwright.config.ts))

| Setting | Value | Notes |
|---|---|---|
| `testDir` | `./e2e/specs` | |
| `timeout` | 30 s | Per-test timeout |
| `expect.timeout` | 10 s | Per-assertion timeout |
| `fullyParallel` | `false` | Sequential — tests share DB state |
| `workers` | 1 | Single worker to avoid cross-test conflicts |
| `retries` | 1 on CI, 0 locally | |
| `trace` | `on-first-retry` | Playwright trace saved on retry |
| `screenshot` | `only-on-failure` | |

---

## Running the Tests

Start the dev server in a separate terminal before running locally:

```bash
npm run dev
```

### Headless (default)

```bash
# All projects
npm run test:e2e

# Specific project
npx playwright test --project=chromium
npx playwright test --project=chromium-admin
npx playwright test --project=api

# Single spec file
npx playwright test e2e/specs/library.spec.ts

# Auth setup only (re-saves .auth/*.json)
npm run test:e2e:setup
```

### UI Mode (interactive, headed)

```bash
npm run test:e2e:ui
# or
npx playwright test --ui
```

Opens the Playwright UI — browse specs, watch tests run step-by-step, inspect the DOM and network at each action.

### Debug Mode

```bash
npm run test:e2e:debug
# or
npx playwright test --debug
```

Pauses execution at each step; opens Playwright Inspector for step-through debugging.

### Video Capture

Video recording is controlled by the `RECORD_VIDEO` environment variable. When set, `playwright.config.ts` switches the `video` option to `'on'`; when absent, video is `'off'`.

```bash
# Record video for every test (all projects)
RECORD_VIDEO=1 npm run test:e2e

# Record video for a specific spec
RECORD_VIDEO=1 npx playwright test e2e/specs/qa-panel.spec.ts

# Record video for a specific project
RECORD_VIDEO=1 npx playwright test --project=chromium-admin
```

Videos are saved to `test-results/<test-name>/` as `.webm` files alongside any screenshots and traces. View them via the HTML report:

```bash
npx playwright show-report   # click any test → Attachments tab → video
```

### Against a Different Base URL

```bash
BASE_URL=https://staging.example.com npx playwright test
```

---

## Test Reports

### Local (list reporter)

By default locally, Playwright prints results inline in the terminal using the `list` reporter. No HTML file is generated.

### CI (HTML + list)

When `CI=true`, both reporters are active:

- **`list`** — inline output in the build log
- **`html`** — full HTML report written to `playwright-report/`. Open with:

```bash
npx playwright show-report
```

The report includes a test-by-test timeline, attached screenshots (failures only), and Playwright traces (first retry). The trace viewer lets you replay any action with DOM snapshots and network calls.

### Trace Viewer

Traces are saved to `test-results/` on the first retry of a failing test. To inspect:

```bash
npx playwright show-trace test-results/<trace-file>.zip
```
