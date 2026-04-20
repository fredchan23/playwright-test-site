# Implementation Plan: Mobile-Friendly Library and Lesson Pages

## Overview

Add mobile responsiveness to StudyNode using `StudyNode.html` as the reference design. The desktop layout is untouched — all changes are additive via a `useIsMobile` hook (breakpoint: `< 640px`). Four vertical slices: shared hook, sidebar drawer, LibraryPage mobile layout, and LessonDetailPage tab switching.

## Architecture Decisions

- **Breakpoint: 640px (`sm`)** — matches the `useIsMobile` pattern in StudyNode.html and Tailwind's `sm:` breakpoint.
- **`useIsMobile` as a shared hook** (`src/hooks/useIsMobile.ts`) — single source of truth for all components. Avoids duplicating resize listeners.
- **Sidebar drawer in `Sidebar.tsx` itself** — keeps drawer logic co-located with sidebar markup; `Layout.tsx` only manages `sidebarOpen` state and passes it down.
- **Mobile top bar in `Layout.tsx`** — the bar renders above `{children}` on mobile; Sidebar receives `isMobile`, `open`, and `onClose` props.
- **No new routes** — LessonDetailPage adds a local `mobileTab` state; no routing changes needed.
- **Preserve all `data-testid` attributes** — do not rename or remove any existing testids. New testids follow `{page}-{element}` convention.

## Dependency Graph

```
src/hooks/useIsMobile.ts  (new — no deps)
        │
        ├── src/components/Sidebar.tsx  (needs: isMobile, open, onClose props)
        │         │
        │         └── src/components/Layout.tsx  (manages sidebarOpen state, renders MobileTopBar)
        │
        ├── src/pages/LibraryPage.tsx  (needs: mobile padding + compact top bar)
        │
        └── src/pages/LessonDetailPage.tsx  (needs: mobile tab bar + icon-only actions)
```

Implementation order must be: hook → Sidebar+Layout → LibraryPage → LessonDetailPage.

---

## Phase 1: Foundation — Shared Hook + Sidebar Drawer

### Task 1: Create `useIsMobile` hook

**Description:** Extract the mobile-detection pattern from StudyNode.html into a reusable React hook. The hook listens to `window.resize` and returns `true` when `window.innerWidth < 640`. SSR-safe (initialises from `window.innerWidth`).

**Acceptance criteria:**
- [ ] `src/hooks/useIsMobile.ts` exists and exports `useIsMobile` as default
- [ ] Hook initialises correctly (no flash) and updates on window resize
- [ ] Breakpoint is 640px (exclusive — `< 640`)

**Verification:**
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

**Dependencies:** None

**Files touched:**
- `src/hooks/useIsMobile.ts` (new)

**Estimated scope:** XS

---

### Task 2: Sidebar mobile drawer + Layout mobile top bar

**Description:** Convert `Sidebar.tsx` to support a slide-in drawer on mobile. `Layout.tsx` gains `sidebarOpen` state and renders a mobile top bar (52px height, hamburger + SN badge + "StudyNode" wordmark) above `{children}` only on mobile. On desktop, nothing changes. Sidebar receives three new props: `isMobile`, `open`, `onClose`.

**Behaviour spec (from StudyNode.html):**
- Mobile sidebar: `position: fixed`, `width: 270px`, slides in with `transform: translateX(0/-100%)`, `transition: 0.24s cubic-bezier(0.4,0,0.2,1)`, `box-shadow: var(--shadow-lg)`
- Backdrop: `position: fixed, inset: 0`, `background: rgba(0,0,0,0.4)`, `backdropFilter: blur(2px)`, click dismisses sidebar
- Sidebar header on mobile: includes an X close button on the right
- Desktop: identical to today — Sidebar renders as before, Layout renders no top bar

**New testids:**
- `mobile-top-bar` — the 52px header bar
- `mobile-menu-button` — hamburger button
- `mobile-sidebar-overlay` — the backdrop div
- `mobile-sidebar-close-button` — X button inside sidebar on mobile

**Acceptance criteria:**
- [ ] On viewport < 640px, mobile top bar is visible; sidebar is hidden off-screen
- [ ] Tapping hamburger opens sidebar with overlay
- [ ] Tapping overlay or X button closes sidebar
- [ ] All existing sidebar `data-testid` attributes preserved (`sidebar-library-button`, `library-settings-button`, `library-logout-button`)
- [ ] On desktop (≥ 640px), layout is pixel-identical to today

**Verification:**
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Manual: resize browser to 375px — top bar visible, tap hamburger, sidebar slides in, tap overlay, closes

**Dependencies:** Task 1

**Files touched:**
- `src/hooks/useIsMobile.ts`
- `src/components/Sidebar.tsx`
- `src/components/Layout.tsx`

**Estimated scope:** M

---

### Checkpoint: After Tasks 1–2

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — clean
- [ ] Manual test at 375px: sidebar drawer opens/closes correctly
- [ ] Manual test at 1024px: desktop layout unchanged
- [ ] **Human review before proceeding to Phase 2**

---

## Phase 2: LibraryPage Mobile Layout

### Task 3: LibraryPage mobile responsiveness

**Description:** Make LibraryPage comfortable on mobile. The card grid already has `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` — no change needed there. Reduce padding (`px-7 py-5` → `px-4 py-3` in top bar; `px-7 py-6` → `px-4 py-4` in scrollable area) on mobile using `useIsMobile`.

**Behaviour spec:**
- Top bar: smaller horizontal padding on mobile; all buttons remain visible (the "New Lesson" label fits at 375px)
- Scrollable content area: `px-4 py-4` on mobile vs `px-7 py-6` on desktop
- Filters panel: inherits smaller padding from the content area
- No layout changes to card grid, list view, section headers, or filter pills

**Acceptance criteria:**
- [ ] At 375px, top bar items don't overflow or clip
- [ ] Content padding is visibly narrower on mobile than desktop
- [ ] All existing `data-testid` attributes preserved

**Verification:**
- [ ] `npm run typecheck` passes
- [ ] Manual: 375px — check top bar, card view, list view, filters panel

**Dependencies:** Task 2

**Files touched:**
- `src/pages/LibraryPage.tsx`

**Estimated scope:** S

---

### Checkpoint: After Task 3

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — clean
- [ ] Manual at 375px: LibraryPage correct in card and list views; filters panel usable
- [ ] Manual at 1024px: desktop layout unchanged
- [ ] **Human review before proceeding to Phase 3**

---

## Phase 3: LessonDetailPage Mobile Tab Switching

### Task 4: LessonDetailPage mobile tab bar + icon-only top bar actions

**Description:** On mobile, the side-by-side two-column layout (main content + 360px Q&A panel) collapses into a tabbed view. A tab bar below the top bar lets users switch between "Lesson" and "Ask AI". The top bar action buttons (Share, Edit, Delete) show icons only on mobile. On desktop, everything is identical to today.

**Behaviour spec (from StudyNode.html):**
- Tab bar: two equal-width buttons; active tab → `color: var(--accent)`, `borderBottom: 2px solid var(--accent)`, `font-weight: 600`
- Tabs: "Lesson" (BookOpen icon) and "Ask AI" (Sparkles icon from Lucide)
- Body: whichever tab is active fills `flex-1`; the other is not rendered
- `LessonQAPanel`: receives `lessonId`; on mobile omit `columnMode` so it fills full width
- Action buttons on mobile: icon only (no text span); same `data-testid` values

**New testids:**
- `lesson-detail-tab-bar` — tab bar container
- `lesson-detail-tab-lesson` — Lesson tab button
- `lesson-detail-tab-qa` — Ask AI tab button

**Acceptance criteria:**
- [ ] At < 640px: tab bar visible, clicking "Ask AI" shows Q&A panel, clicking "Lesson" shows lesson content
- [ ] Action buttons (Share, Edit, Delete) show icon only on mobile — same testids
- [ ] `LessonQAPanel` renders and functions correctly in both mobile tab and desktop column
- [ ] At ≥ 640px: desktop two-column layout unchanged, all existing testids intact

**Verification:**
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Manual at 375px: tab switching works; Q&A panel scrollable and usable
- [ ] Manual at 1024px: desktop layout unchanged

**Dependencies:** Tasks 1, 2

**Files touched:**
- `src/pages/LessonDetailPage.tsx`

**Estimated scope:** M

---

### Checkpoint: Final

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — clean
- [ ] Manual at 375px: full flow — log in, browse library, open lesson, switch tabs, use Q&A
- [ ] Manual at 1024px: desktop flow unchanged, no regressions
- [ ] Spot-check testids: `sidebar-library-button`, `library-search-input`, `library-lesson-card-*`, `lesson-detail-back-button`, `lesson-detail-tab-lesson`, `lesson-detail-tab-qa`
- [ ] CLAUDE.md updated with any mobile gotchas encountered

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `LessonQAPanel` `columnMode` prop controls height/flex layout — removing it on mobile may break scroll | Med | Inspect `LessonQAPanel.tsx` before Task 4; add `fullHeight` or `tabMode` prop if needed |
| Sidebar z-index conflicts with modals (delete/share dialogs, image lightbox at z-50) | Low | Set sidebar overlay to `z-40`, sidebar drawer to `z-41` — below dialogs |
| Mobile top bar height shifts viewport — existing `h-screen` calculations off | Low | Top bar slots into the `flex flex-col` on Layout — already correct |
| `onMouseEnter/onMouseLeave` hover state stuck on touch devices | Low | Touch devices ignore mouse events; existing hover logic is safe |

## Open Questions

- Should the mobile top bar appear on LessonDetailPage too? (Plan: yes — it's in `Layout.tsx`, which wraps all protected routes.)
- Should the "Shared with Me" section respect `viewMode` on mobile? (Plan: yes — no change to existing logic.)
