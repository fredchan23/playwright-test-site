# Plan: Mobile E2E Test Coverage

**Date:** 2026-04-23  
**Status:** On Hold

---

## Context

The mobile responsive implementation shipped 2026-04-20 (see CLAUDE.md). It covers:
- 52px top bar with hamburger + SN badge + wordmark (Layout.tsx)
- Fixed-position sidebar drawer with overlay (Sidebar.tsx)
- Two-row LibraryPage header on mobile (search full-width; icon-only Filters + New Lesson)
- LessonDetailPage tab bar toggling Lesson/Ask AI views
- Icon-only Share/Edit/Delete action buttons

None of this is currently tested. Zero existing tests use a mobile viewport. The app detects
mobile via `window.innerWidth < 640` — no user-agent check — so a desktop Chrome browser with
a 375px-wide viewport correctly activates all mobile code paths.

Existing test infrastructure (factories, auth setup, fixtures) is reused as-is. No new helpers
or page objects needed.

---

## Scope

One new Playwright project (`mobile`) + one new spec file (`e2e/specs/mobile.spec.ts`) with
6 tests. Library hover-assertion concern from CLAUDE.md is moot — `library.spec.ts` has no
hover assertions to update.

---

## Dependency Graph

```
T1: Add `mobile` project to playwright.config.ts
    │
T2: Create e2e/specs/mobile.spec.ts (6 tests)
    │
T3: Verify full suite (npx playwright test) still passes
```

---

## Task 1 — Add `mobile` Playwright Project

**File:** `playwright.config.ts`

Add a new project entry:

```ts
{
  name: 'mobile',
  use: {
    ...devices['iPhone 12'],   // 390×844 viewport, isMobile:true, hasTouch:true
    storageState: 'e2e/.auth/regular-user.json',
  },
  dependencies: ['setup'],
  testMatch: /mobile\.spec\.ts/,
},
```

`devices['iPhone 12']` gives a 390px-wide viewport, which is < 640 and triggers all mobile
code paths. The `isMobile: true` flag also helps Playwright simulate touch correctly on
overlay/drawer elements.

**Acceptance criteria:**
- `npx playwright test --list --project=mobile` shows 0 tests (spec not yet created)
- Existing projects unchanged; full suite still passes

**Verification:** `npx playwright test --project=chromium` exits 0 before writing the spec.

---

## Task 2 — Create `e2e/specs/mobile.spec.ts`

**File:** `e2e/specs/mobile.spec.ts`

Six tests, all in `chromium`-style structure, using the `mobile` project viewport.

### Test 1 — Mobile top bar visible; sidebar drawer hidden on load

```
Given mobile viewport (390px) at /library
Then [data-testid="mobile-top-bar"] is visible
And  [data-testid="mobile-menu-button"] is visible
And  [data-testid="mobile-sidebar-overlay"] is NOT in DOM (sidebar closed)
```

### Test 2 — Hamburger opens sidebar; overlay click closes it

```
Given mobile viewport at /library
When  click [data-testid="mobile-menu-button"]
Then  [data-testid="mobile-sidebar-overlay"] is visible
When  click [data-testid="mobile-sidebar-overlay"]
Then  [data-testid="mobile-sidebar-overlay"] is NOT in DOM (drawer closed)
```

### Test 3 — Hamburger opens sidebar; X button closes it

```
Given mobile viewport at /library
When  click [data-testid="mobile-menu-button"]
Then  [data-testid="mobile-sidebar-close-button"] is visible
When  click [data-testid="mobile-sidebar-close-button"]
Then  [data-testid="mobile-sidebar-overlay"] is NOT in DOM
```

### Test 4 — Sidebar navigation: Library link navigates correctly

```
Given mobile viewport at /library
When  click [data-testid="mobile-menu-button"]
And   click [data-testid="sidebar-library-button"]
Then  URL is /library (stays on library)
And   [data-testid="mobile-sidebar-overlay"] is NOT in DOM (drawer auto-closes on nav)
```

### Test 5 — LessonDetailPage: tab bar; switching Lesson → Ask AI tab

```
Given mobile viewport and a seeded lesson at /lessons/{id}
Then  [data-testid="lesson-detail-tab-bar"] is visible
And   lesson content (lesson-detail-files-list or lesson-detail-description) is visible
When  click [data-testid="lesson-detail-tab-qa"]
Then  [data-testid="lesson-qa-panel"] is visible
When  click [data-testid="lesson-detail-tab-lesson"]
Then  lesson content is visible again
```

### Test 6 — LessonDetailPage: action buttons are icon-only (no text labels)

```
Given mobile viewport and a seeded lesson at /lessons/{id}
Then  [data-testid="lesson-detail-share-button"] is visible
And   button text does not contain "Share" (icon-only)
And   [data-testid="lesson-detail-edit-button"] visible; text does not contain "Edit"
And   [data-testid="lesson-detail-delete-button"] visible; text does not contain "Delete"
```

**Implementation notes:**
- Tests 5 and 6 use `createLesson(regularUserId)` + `deleteLesson` in `try/finally`
- Tests 1–4 do not create lessons — just navigate to `/library` (existing lessons may or may not exist)
- Use `regularUserId` resolved once in `beforeAll` via `getUserIdByEmail`
- No `@slow` tag needed — no live LLM calls

**Acceptance criteria:**
- All 6 tests pass in `npx playwright test --project=mobile`
- Tests are independent (parallel-safe, though workers=1)
- Teardown: no `[E2E]` lessons left after suite

---

## Task 3 — Full Suite Verification

Run complete suite with all projects:

```bash
npx playwright test
```

**Acceptance criteria:**
- All previously passing tests (44) still pass
- 6 new mobile tests pass
- Total: 50 tests passing (49 non-slow + 1 slow)
- `npx playwright test --grep-invert @slow` exits 0 (CI gate check)

---

## Checkpoint Summary

| After | Verify |
|-------|--------|
| T1 | `--list --project=mobile` shows 0 tests; `--project=chromium` still exits 0 |
| T2 | `--project=mobile` exits 0 with 6 new tests |
| T3 | Full `npx playwright test` exits 0; 50 total tests |

---

## Critical Files

| File | Action |
|------|--------|
| `playwright.config.ts` | Add `mobile` project entry |
| `e2e/specs/mobile.spec.ts` | Create (6 tests) |

---

## Non-Goals

- Testing LibraryPage two-row filter layout (no stable testid on the mobile filter row)
- Testing icon-only New Lesson button on mobile (same testid, same element — already covered by lesson-crud.spec.ts flow)
- Testing QA panel scroll behaviour on mobile
- Adding mobile viewport to existing specs (would double test time with low marginal value)
