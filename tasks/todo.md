# Task List — Mobile-Friendly Library and Lesson Pages

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done

---

## Phase 1: Foundation

- [x] **Task 1** — Create `src/hooks/useIsMobile.ts` hook (breakpoint < 640px, resize listener, SSR-safe)
- [x] **Task 2** — Sidebar mobile drawer + Layout mobile top bar (hamburger, slide-in, overlay backdrop, close button)

### Checkpoint 1
- [x] `npm run typecheck` clean
- [x] `npm run build` clean
- [x] Manual 375px: drawer opens/closes; desktop unchanged
- [x] Human review ✋

---

## Phase 2: LibraryPage

- [x] **Task 3** — LibraryPage mobile padding (two-row top bar, icon-only buttons, smaller content padding, list-view mobile fixes)

### Checkpoint 2
- [x] `npm run typecheck` clean
- [x] `npm run build` clean
- [x] Manual 375px: top bar, cards, list, filters all usable
- [x] Human review ✋

---

## Phase 3: LessonDetailPage

- [x] **Task 4** — LessonDetailPage mobile tab bar ("Lesson" / "Ask AI") + icon-only action buttons on mobile

### Checkpoint 3 (Final)
- [x] `npm run typecheck` clean
- [x] `npm run build` clean
- [x] Manual 375px: full flow end-to-end
- [x] Manual 1024px: desktop unchanged
- [x] Spot-check all `data-testid` attributes
- [x] Update CLAUDE.md with any gotchas

---

## All tasks complete ✓

## New testids introduced in this work

| testid | Location | Notes |
|--------|----------|-------|
| `mobile-top-bar` | Layout.tsx | 52px top bar, mobile only |
| `mobile-menu-button` | Layout.tsx | Hamburger button |
| `mobile-sidebar-overlay` | Sidebar.tsx | Backdrop div |
| `mobile-sidebar-close-button` | Sidebar.tsx | X button in drawer header |
| `lesson-detail-tab-bar` | LessonDetailPage.tsx | Tab bar container |
| `lesson-detail-tab-lesson` | LessonDetailPage.tsx | "Lesson" tab button |
| `lesson-detail-tab-qa` | LessonDetailPage.tsx | "Ask AI" tab button |
