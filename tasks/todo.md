# Active Tasks

No tasks in progress. Four plans queued, listed in recommended implementation order:

---

## Queue (recommended order)

### 1. Important fixes — `plan-important-fixes.md` · Ready · ~1 hour
Two structural/security items from the 2026-04-23 code review. Do this first — Task 1
(processFiles refactor) unblocks the S-2 suggestion in plan-suggestions.md.

- [ ] T1: Refactor `handleDrop` → shared `processFiles(File[])` helper (`CreateLessonPage.tsx`)
- [ ] T2: Add `file_data` size cap (7 MB) in `lesson-metadata-suggest` edge function + redeploy

**Gate:** `npm run typecheck` + all 10 autofill + API tests pass.

---

### 2. KaTeX LaTeX rendering — `plan.md` · Ready · ~2 hours
New feature: typeset math in QA panel assistant responses.

- [ ] T1: `npm install remark-math rehype-katex`; verify build
- [ ] T2: Create `src/lib/sanitizeSchema.ts` — extended rehype-sanitize schema allowing `span.style`
- [ ] T3: Wire `remarkMath` + `rehypeKatex` into `LessonQAPanel.tsx` + import KaTeX CSS; manual smoke test
- [ ] T4: Write `e2e/specs/latex-rendering.spec.ts` — seed LaTeX message, assert `.katex` DOM element

**Gate:** manual smoke test (display + inline LaTeX renders) + `npx playwright test --grep-invert @slow` passes.

---

### 3. Suggestion fixes — `plan-suggestions.md` · Low priority · ~1.5 hours
Seven cleanup items from the 2026-04-23 review in three independent clusters.

**Cluster A — Code quality** (do after plan-important-fixes T1):
- [ ] S-1: Replace `waitForTimeout(600)` with deterministic gate in autofill spec
- [ ] S-2: Replace `autofillFile` forEach mutation with `find()` in `processFiles`
- [ ] S-3: Replace inline `<style>` shimmer with CSS in `src/index.css`

**Cluster B — Edge function config** (requires redeploy):
- [ ] S-4: `GCP_PROJECT`/`GCP_LOCATION`/`GEMINI_MODEL` → `Deno.env.get()` with defaults
- [ ] S-5: Add `sa.client_email`/`sa.private_key` presence guard after `JSON.parse`

**Cluster C — CORS + test env**:
- [ ] S-6: Restrict `Access-Control-Allow-Origin` to app origin (check local dev first)
- [ ] S-7: Remove hardcoded `SUPABASE_URL` fallback from `edge-function-metadata.spec.ts`

---

### 4. Mobile E2E — `archive/plan-mobile-e2e.md` · On Hold
6 Playwright tests for mobile drawer, tabs, icon-only buttons. Awaiting go-ahead.

- [ ] T1: Add `mobile` project to `playwright.config.ts`
- [ ] T2: Create `e2e/specs/mobile.spec.ts` (6 tests)
- [ ] T3: Full suite verification (target: 50 tests passing)
