# Plan: AI Metadata Autofill — `lesson-metadata-suggest`

## Context

Users creating lessons must manually enter title, description, tags, and genre even when the content is obvious from the uploaded file. The AI Metadata Autofill feature sends the first uploaded file to a new Gemini 2.5 Flash edge function and uses the response to pre-fill the form fields. Spec: `docs/SPEC-ai-metadata-autofill.md`.

## Dependency Graph

```
Task 1: DB Migration (independent — add "Other" genre)
    │
Task 2: Edge Function lesson-metadata-suggest (independent of client; deploy before Task 3)
    │
Task 3: Client integration in CreateLessonPage.tsx (depends on Tasks 1 + 2)
    │
Task 4: Playwright E2E tests (depends on Task 3)
```

## Task 1 — DB Migration: Add "Other" Genre

**File:** `supabase/migrations/20260422000000_add_genre_other.sql`

Apply via Supabase SQL Editor (not CLI push — per spec).

**Verification:** `SELECT * FROM genres ORDER BY name;` shows "Other"

## Task 2 — Edge Function: `lesson-metadata-suggest`

**File:** `supabase/functions/lesson-metadata-suggest/index.ts`

- Pattern: copy from `lesson-qa-ask/index.ts` — CORS_HEADERS, json(), getGcpAccessToken, toBase64
- GCP_PROJECT = 'automatic-ace-488412-a7', GCP_LOCATION = 'asia-southeast1', GEMINI_MODEL = 'gemini-2.5-flash'
- Request: POST `{ file_data: string, mime_type: string }`
- Single-turn Gemini call, generationConfig: { temperature: 0.1 }
- Parse JSON response → return `{ title?, description?, tags?, genre? }`, tags capped at 3
- Deploy: `npx supabase functions deploy lesson-metadata-suggest`

## Task 3 — Client Integration: `CreateLessonPage.tsx`

- Add `autofillTriggered` ref + `autofilling` state
- `runAutofill(file)`: base64 encode → POST to edge function → populate empty fields
- Trigger in `handleFileSelect`: first valid file ≤5MB only
- While `autofilling`: all four fields + submit disabled, shimmer overlay per field
- Hidden `<div data-testid="create-lesson-autofill-loading">` inside form when autofilling

## Task 4 — E2E Tests: `create-lesson-autofill.spec.ts`

Four tests using `page.route()` to mock the edge function:
1. Shimmer appears + fields disabled on first file upload
2. Fields populate after response
3. Second file does not re-trigger
4. Pre-filled title is not overwritten

## Checkpoint Summary

| After | Verify |
|-------|--------|
| Task 1 | SQL Editor: "Other" in genres table |
| Task 2 | curl test returns { title, description, ... } |
| Task 3 | Dev server: drop PDF → shimmer → fields fill |
| Task 4 | All 4 E2E tests pass locally |

## Critical Files

| File | Action |
|------|--------|
| `supabase/migrations/20260422000000_add_genre_other.sql` | Create |
| `supabase/functions/lesson-metadata-suggest/index.ts` | Create |
| `src/pages/CreateLessonPage.tsx` | Modify |
| `e2e/specs/create-lesson-autofill.spec.ts` | Create |
