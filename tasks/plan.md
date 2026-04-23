# Implementation Plan: KaTeX LaTeX Rendering in QA Panel

**Date:** 2026-04-23  
**Status:** Ready — implement after plan-important-fixes.md  
**Estimated effort:** ~2 hours

---

## Overview

Add LaTeX math rendering to assistant responses in the "Ask this lesson" QA panel
(`src/components/LessonQAPanel.tsx`). When Gemini returns an answer containing LaTeX syntax
— either inline (`$...$`) or display-block (`$$...$$`) — it should render as typeset math via
KaTeX rather than as raw `$` characters.

The QA panel already uses `react-markdown` with `rehype-sanitize`. This plan wires
`remark-math` (parses LaTeX syntax into AST nodes) and `rehype-katex` (renders those nodes to
KaTeX HTML) into the existing markdown pipeline.

---

## Architecture Decisions

### Decision 1 — remark-math + rehype-katex (not react-katex)

`react-katex` is a standalone component that doesn't integrate with `react-markdown`. Using
`remark-math` + `rehype-katex` keeps LaTeX rendering inside the unified/remark pipeline —
Gemini's full response is processed in one pass: markdown → LaTeX → sanitized HTML.

### Decision 2 — Extend rehype-sanitize schema rather than drop sanitization

The QA panel renders AI-generated content from Gemini. Sanitization stays on. The only
required extension is allowing `style` on `span` elements: KaTeX's HTML output (`output: 'html'`)
uses inline `style` for glyph positioning. Without it, math renders but glyphs overlap.

No other attributes are needed: `className` on `span` is already in the default schema.

### Decision 3 — `throwOnError: false` on rehype-katex

Malformed LaTeX in a Gemini response would otherwise throw and crash the renderer.
`throwOnError: false` falls back to displaying the raw LaTeX source, which is always
preferable to a blank or broken panel.

### Decision 4 — `output: 'html'` (not `mathml` or `htmlAndMathml`)

Simpler sanitize schema. MathML mode requires allowlisting ~20 MathML element types. HTML
mode requires only `span.style`. Accessibility tradeoff is acceptable for this app.

---

## Dependency Graph

```
Task 1: npm install remark-math rehype-katex → adds katex as transitive dep
    │
Task 2: src/lib/sanitizeSchema.ts — extended rehype-sanitize schema
    │
Task 3: LessonQAPanel.tsx — wire plugins + import KaTeX CSS
    │         (depends on Task 1 packages + Task 2 schema)
    │
── Checkpoint ──
    │
Task 4: e2e/specs/latex-rendering.spec.ts — one test, seeded message
    │
── Checkpoint ──
```

---

## Phase 1: Foundation

### Task 1 — Install remark-math and rehype-katex

**Description:** Add the two new packages. `katex` itself is a transitive dependency of
`rehype-katex` and will be installed automatically. Verify the build passes before wiring
anything.

**Acceptance criteria:**
- [ ] `remark-math` and `rehype-katex` appear in `package.json` dependencies
- [ ] `npm run build` exits 0 with no type errors
- [ ] `npm run typecheck` exits 0

**Verification:**
```bash
npm install remark-math rehype-katex
npm run typecheck
npm run build
```

**Files touched:**
- `package.json`
- `package-lock.json`

**Estimated scope:** XS

---

### Task 2 — Create extended sanitize schema

**Description:** Export a `katexSanitizeSchema` that extends `rehype-sanitize`'s `defaultSchema`
to allow `style` on `span` elements. KaTeX's HTML output uses inline `style` for glyph
positioning — without it, math renders but characters overlap.

**File:** `src/lib/sanitizeSchema.ts`

```ts
import { defaultSchema } from 'hast-util-sanitize';

export const katexSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      'style',
    ],
  },
};
```

**Acceptance criteria:**
- [ ] `src/lib/sanitizeSchema.ts` exists and exports `katexSanitizeSchema`
- [ ] `npm run typecheck` exits 0 (type must satisfy `Schema` from `hast-util-sanitize`)

**Verification:**
```bash
npm run typecheck
```

**Files touched:**
- `src/lib/sanitizeSchema.ts` ← new file

**Estimated scope:** XS — 1 file, ~12 lines

---

## Checkpoint: Phase 1

- [ ] `npm run build` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] No regressions: `npx playwright test e2e/specs/qa-panel.spec.ts`

---

## Phase 2: Integration

### Task 3 — Wire plugins into LessonQAPanel

**Description:** Import `remark-math`, `rehype-katex`, the new schema, and KaTeX's CSS.
Update the `<ReactMarkdown>` call in the messages area to use them. The plugin order is
critical: `rehype-katex` must run before `rehype-sanitize` so it transforms math AST nodes
into KaTeX HTML before the sanitizer sees it.

**File:** `src/components/LessonQAPanel.tsx`

Add imports at the top:
```ts
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { katexSanitizeSchema } from '../lib/sanitizeSchema';
```

Update `<ReactMarkdown>`:
```tsx
<ReactMarkdown
  remarkPlugins={[remarkMath]}
  rehypePlugins={[
    [rehypeKatex, { output: 'html', throwOnError: false }],
    [rehypeSanitize, katexSanitizeSchema],
  ]}
  components={{ /* existing a, code, pre overrides unchanged */ }}
>
  {msg.content}
</ReactMarkdown>
```

**Acceptance criteria:**
- [ ] `remarkPlugins` and `rehypePlugins` arrays updated as above
- [ ] KaTeX CSS is imported (either in this file or in `src/index.css`)
- [ ] `rehypeKatex` appears before `rehypeSanitize` in the rehype plugins array
- [ ] Existing `a`, `code`, `pre` component overrides are preserved unchanged
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] Manual smoke test passes (see Verification below)

**Manual smoke test:** Use the Supabase dashboard SQL Editor to insert a test message:
```sql
INSERT INTO lesson_qa_messages (lesson_id, user_id, role, content)
SELECT id, owner_id, 'assistant',
  'Inline: $x^2 + y^2 = z^2$

Display:
$$s_n = \sqrt{\frac{1}{n-1}\sum_{i=1}^{n}(x_i-\overline{x}_n)^2}$$'
FROM lessons LIMIT 1;
```
Navigate to that lesson → Ask AI tab. Verify both formulas render as typeset math (not raw `$` text).

**Verification:**
```bash
npm run typecheck
npm run build
npx playwright test e2e/specs/qa-panel.spec.ts  # existing tests still pass
```

**Files touched:**
- `src/components/LessonQAPanel.tsx`
- `src/lib/sanitizeSchema.ts` (read only — imported here)

**Estimated scope:** S — 4 import lines + update one JSX block

---

## Checkpoint: Phase 2

- [ ] LaTeX renders correctly in the QA panel (manual smoke test passed)
- [ ] Existing markdown rendering unaffected: links, code blocks, pre blocks still styled
- [ ] Existing 5 qa-panel tests pass: `npx playwright test e2e/specs/qa-panel.spec.ts`
- [ ] Build and typecheck clean

---

## Phase 3: Test Coverage

### Task 4 — Write Playwright test for LaTeX rendering

**Description:** One automated test that seeds an assistant message containing inline LaTeX,
navigates to the QA panel, and asserts the rendered DOM contains KaTeX-generated elements
(`.katex` class). Uses the same seeding pattern as `qa-panel.spec.ts` (adminClient insert).
No live Gemini call needed — the message is seeded directly into `lesson_qa_messages`.

**File:** `e2e/specs/latex-rendering.spec.ts`

```ts
test('LaTeX in assistant response renders as KaTeX HTML', async ({
  page, lessonDetailPage,
}) => {
  const lesson = await createLesson(regularUserId, {
    title: e2eTitle(`LaTeX-${Date.now()}`),
  });
  try {
    await ensureQaEnabled();
    await adminClient()
      .from('lesson_qa_messages')
      .insert({
        lesson_id: lesson.id,
        user_id: regularUserId,
        role: 'assistant',
        content: 'The formula is $x^2 + y^2 = z^2$ and the sum is $\\sum_{i=1}^{n} x_i$.',
      });

    await lessonDetailPage.goto(lesson.id);

    const message = page.locator('[data-testid="lesson-qa-message-0"]');
    await expect(message).toBeVisible({ timeout: 15_000 });

    // KaTeX-rendered math has class="katex" on the root span
    const katexEl = message.locator('.katex').first();
    await expect(katexEl).toBeAttached();
  } finally {
    await deleteLesson(lesson.id);
  }
});
```

**Acceptance criteria:**
- [ ] Test file exists at `e2e/specs/latex-rendering.spec.ts`
- [ ] Test passes: `npx playwright test e2e/specs/latex-rendering.spec.ts`
- [ ] No `[E2E]` lessons left in DB after test (teardown in `finally` block)
- [ ] Test is not tagged `@slow` (no live LLM call)

**Verification:**
```bash
npx playwright test e2e/specs/latex-rendering.spec.ts
```

**Files touched:**
- `e2e/specs/latex-rendering.spec.ts` ← new file

**Estimated scope:** S — ~50 lines

---

## Checkpoint: Phase 3 — Complete

- [ ] All new tests pass: `npx playwright test e2e/specs/latex-rendering.spec.ts`
- [ ] Full suite (non-slow) still passes: `npx playwright test --grep-invert @slow`
- [ ] Build clean: `npm run build`
- [ ] Typecheck clean: `npm run typecheck`

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| rehype-sanitize strips KaTeX `style` attrs → broken math layout | High | `katexSanitizeSchema` in Task 2 explicitly allows `span.style` |
| Plugin order wrong (sanitize before katex) → math nodes stripped | High | Enforce in Task 3: `[rehypeKatex, ...]` must precede `[rehypeSanitize, ...]` |
| Malformed Gemini LaTeX crashes renderer | Medium | `throwOnError: false` on rehypeKatex — falls back to raw source |
| KaTeX CSS conflicts with Tailwind | Low | KaTeX CSS uses specific class selectors; Tailwind purges unused classes — no conflict expected. Verify visually. |
| katex bundle size (~200KB) impacts Lighthouse | Low | Acceptable for a learning app. katex is code-split with the QA panel component. |

---

## Open Questions

None — dependencies are known, approach is proven, scope is well-bounded.

---

## Non-Goals

- Rendering LaTeX in user messages (user input is plain text, no markdown)
- Rendering LaTeX in lesson descriptions (different component, different scope)
- MathML accessibility output (requires larger sanitize schema change; low ROI)
- Adding a LaTeX editor to the question input field
