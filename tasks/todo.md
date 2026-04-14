# Task List — Lesson Q&A Feature

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done

---

## Phase 1 — Foundation

- [ ] **T1** Write DB migration SQL (4 tables + is_admin + RLS + pgvector)
- [ ] **T1a** *(manual)* Apply migration via Supabase dashboard SQL editor and verify
- [ ] **T2** *(manual)* Create GCP service account with `roles/aiplatform.user`, store JSON key as `GCP_VERTEX_SA_KEY` in Supabase secrets

---

### CHECKPOINT A — Foundation verified
> DB tables exist · GCP secret stored

---

## Phase 2 — Feature Toggle (can run in parallel with Phase 3)

- [ ] **T3** Extend `AuthContext` to expose `isAdmin` (read `profiles.is_admin`)
- [ ] **T3a** Create `SettingsPage.tsx` with Q&A enable/disable toggle
- [ ] **T3b** Add `/settings` route to `App.tsx` (admin-only, redirect non-admins)
- [ ] **T3c** Add Settings nav link to `LibraryPage.tsx` (admin only)
- [ ] **T3d** Verify: typecheck + lint pass, manual test with admin user

---

## Phase 3 — Edge Functions

- [ ] **T4** Implement `lesson-qa-index` edge function (PDF chunking, embedding, status tracking)
- [ ] **T4a** Deploy and smoke-test `lesson-qa-index`
- [ ] **T5** Implement `lesson-qa-ask` edge function (guardrails, similarity search, RAG generation, persist messages)
- [ ] **T5a** Deploy and smoke-test `lesson-qa-ask` with a real question
- [ ] **T6** Implement `lesson-qa-clear` edge function (delete messages for user+lesson)
- [ ] **T6a** Deploy and smoke-test `lesson-qa-clear`

---

### CHECKPOINT B — All edge functions deployed and tested

---

## Phase 4 — Frontend

- [ ] **T7** Create `LessonQAPanel.tsx` component (all states: disabled/indexing/failed/ready, polling, history, clear)
- [ ] **T7a** Verify all required `data-testid` attributes are present
- [ ] **T7b** Run typecheck + lint
- [ ] **T8** Integrate `<LessonQAPanel>` into `LessonDetailPage.tsx` below files section
- [ ] **T8a** Verify existing functionality unaffected

---

### CHECKPOINT C — Full E2E feature working
> Open lesson → index → ask → answer → persist → clear · Admin toggle hides panel

---

## Phase 5 — Image Support (nice-to-have)

- [ ] **T9** Extend `lesson-qa-index` to process images via Gemma 4 multimodal
- [ ] **T9a** Smoke-test: ask question about an uploaded image

---

## Blocked / Waiting

_(nothing blocked at plan time)_
