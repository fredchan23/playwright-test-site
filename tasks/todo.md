# AI Metadata Autofill — Task Checklist

## Phase 1: Foundation

- [x] Task 1: Write migration file `supabase/migrations/20260422000000_add_genre_other.sql`
- [ ] Task 1 (manual): Apply migration via Supabase SQL Editor — verify "Other" in genres table

## Phase 2: Edge Function

- [x] Task 2: Create `supabase/functions/lesson-metadata-suggest/index.ts`
- [x] Task 2: Deploy — `npx supabase functions deploy lesson-metadata-suggest --no-verify-jwt`
- [x] Task 2: API tests — `e2e/specs/edge-function-metadata.spec.ts` (6/6 passing)
- [x] Task 2 fix: `image/jpg` → normalise to `image/jpeg` for Gemini (was: 400 reject; now: accepted)
- [x] Task 2 note: Must deploy with `--no-verify-jwt` — gateway rejects ES256 tokens for new functions

## Phase 3: Client

- [ ] Task 3: Update `src/pages/CreateLessonPage.tsx` with autofill integration
- [ ] Task 3 (manual): Dev server walkthrough — drop PDF → shimmer → fields populated

## Phase 4: Tests

- [ ] Task 4: Create `e2e/specs/create-lesson-autofill.spec.ts`
- [ ] Task 4: Run tests locally — all 4 pass
