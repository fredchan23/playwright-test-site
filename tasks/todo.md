# Task List — Lesson Q&A Feature + Pre-Playwright Cleanup

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done

---

## Q&A Feature Status

- [x] **T1** DB migration (`20260414185905_lesson_qa_schema.sql`) applied
- [x] **T1a** *(manual)* Migration verified in Supabase dashboard
- [ ] **T2** *(manual)* Create GCP service account with `roles/aiplatform.user`, store JSON key as `GCP_VERTEX_SA_KEY` in Supabase secrets

---

### CHECKPOINT A — Foundation verified
> DB tables exist · GCP secret stored

---

- [x] **T3** Extend `AuthContext` to expose `isAdmin` (read `profiles.is_admin`)
- [x] **T3a** Create `SettingsPage.tsx` with Q&A enable/disable toggle (`settings-page-title`, `settings-qa-toggle`, `settings-qa-toggle-label`)
- [x] **T3b** Add `/settings` route to `App.tsx` (admin-only, redirect non-admins)
- [x] **T3c** Add Settings nav link (`library-settings-button`) to `LibraryPage.tsx` (admin only)
- [ ] **T3d** Verify: typecheck + lint pass, manual test with admin user ← **BLOCKED: typecheck + lint both fail (see cleanup tasks below)**

---

- [x] **T4** Implement `lesson-qa-index` edge function
- [ ] **T4a** Deploy and smoke-test `lesson-qa-index`
- [x] **T5** Implement `lesson-qa-ask` edge function
- [ ] **T5a** Deploy and smoke-test `lesson-qa-ask` with a real question
- [x] **T6** Implement `lesson-qa-clear` edge function
- [ ] **T6a** Deploy and smoke-test `lesson-qa-clear`

---

### CHECKPOINT B — All edge functions deployed and tested

---

- [x] **T7** Create `LessonQAPanel.tsx` component (all states + all `data-testid` attributes)
- [x] **T8** Integrate `<LessonQAPanel>` into `LessonDetailPage.tsx` below files section
- [x] **T8a** Existing functionality on LessonDetailPage unaffected

---

### CHECKPOINT C — Full E2E feature working
> Open lesson → index → ask → answer → persist → clear · Admin toggle hides panel

---

- [ ] **T9** Extend `lesson-qa-index` to process images via Gemma 4 multimodal (nice-to-have)
- [ ] **T9a** Smoke-test: ask question about an uploaded image

---

## Pre-Playwright Cleanup (must complete before Playwright phase)

Three issues currently block `npm run typecheck` and `npm run lint`:

### C1 — Fix missing `database.types` module (typecheck error)

**File:** `src/lib/supabase.ts:2`

**Error:** `TS2307: Cannot find module './database.types' or its corresponding type declarations.`

**Fix:** Remove the `Database` generic type parameter and the import — use an untyped `createClient` call until generated types are added.

**Before:**
```ts
import type { Database } from './database.types';
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```
**After:**
```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Acceptance criteria:**
- [ ] `npm run typecheck` no longer reports the `database.types` error
- [ ] `npm run build` still passes

---

### C2 — Remove unused `ImageIcon` import (typecheck error)

**File:** `src/pages/CreateLessonPage.tsx:5`

**Error:** `TS6133: 'ImageIcon' is declared but its value is never read.`

**Fix:** Remove `Image as ImageIcon` from the lucide-react import line.

**Acceptance criteria:**
- [ ] `npm run typecheck` no longer reports the `ImageIcon` error

---

### C3 — Upgrade `typescript-eslint` (lint crash)

**Error:** `TypeError: Cannot read properties of undefined (reading 'allowShortCircuit')` in `@typescript-eslint/no-unused-expressions`

**Root cause:** `typescript-eslint@8.8.1` (installed) has a bug with ESLint 9 flat config — fixed in `8.10.0`.

**Fix:** Upgrade in-place:
```bash
npm install --save-dev typescript-eslint@latest
```

**Acceptance criteria:**
- [ ] `npm run lint` exits 0 with no errors (or only expected warnings)
- [ ] `npm run typecheck` still passes after upgrade

---

### C4 — Organise docs: move to docs/, tighten README for public consumption

**Context:**
- `SPEC.md` and `DEPLOYMENT.md` are internal reference material (capstone project report / presentation). They should live in `docs/` and be gitignored — not scattered at the root.
- `docs/decisions/` already has two ADR files individually listed in `.gitignore`. A single `docs/` entry covers everything.
- `tasks/playwright-plan.md` and `tasks/playwright-todo.md` are also individually listed — `tasks/` consolidates those too.
- `README.md` is public-facing. It should describe the product, not be a deployment manual. The detailed deployment runbook belongs in `docs/DEPLOYMENT.md`.

**Fix:**
1. Create `docs/` directory; move `SPEC.md` → `docs/SPEC.md` and `DEPLOYMENT.md` → `docs/DEPLOYMENT.md`
2. Replace the scattered gitignore entries with two clean directory rules:
   - Remove individual lines: `SPEC.md`, `docs/decisions/ADR-001-lesson-qa-feature.md`, `docs/decisions/ADR-002-long-context-rag-pivot.md`, `tasks/playwright-plan.md`, `tasks/playwright-todo.md`
   - Add: `docs/` and `tasks/`
3. Trim README.md to public-facing content:
   - Keep: product description, what it does, tech stack, local dev setup, data-testid convention
   - Remove: detailed deployment runbook (now in `docs/DEPLOYMENT.md`), verbose schema section
   - Update: routes table (add `/settings`), features list (add Q&A panel)
   - Add one line pointing to `docs/` for internal reference: *"Internal docs (spec, deployment runbook, ADRs) are in `docs/` — gitignored, local only."*

**Acceptance criteria:**
- [ ] `docs/SPEC.md` and `docs/DEPLOYMENT.md` exist
- [ ] Root `SPEC.md` and `DEPLOYMENT.md` are deleted
- [ ] `.gitignore` has `docs/` and `tasks/` as directory rules (individual file entries removed)
- [ ] `README.md` describes the product clearly without being a deployment manual
- [ ] README routes table includes `/settings`

---

### C5 — Remove `.bolt/` directory

**Files:** `.bolt/config.json`, `.bolt/prompt` (delete both; remove directory)

**Context:** Bolt.new scaffolding artifacts — a template marker and a design-style system prompt. The project has long since diverged from the scaffold and these files serve no purpose.

**Fix:** Delete the `.bolt/` directory entirely.

**Acceptance criteria:**
- [ ] `.bolt/` directory no longer exists in the repo
- [ ] `npm run build` still passes after deletion

---

### CHECKPOINT PRE-PLAYWRIGHT — Repo is clean
- [ ] `npm run typecheck` exits 0 (zero errors)
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `DEPLOYMENT.md` deleted; `README.md` is up to date
- [ ] `.bolt/` directory deleted
- [ ] Ready to begin Playwright test suite (see `tasks/playwright-todo.md`)

---

## Next Phase: Playwright Regression Suite

See `tasks/playwright-todo.md` for the full Playwright task list (T1–T11).  
All Playwright tasks are pending — start only after CHECKPOINT PRE-PLAYWRIGHT passes.
