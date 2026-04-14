# Implementation Plan — Lesson Q&A: "Ask this lesson"

**Source spec:** SPEC.md  
**Date:** 2026-04-14  
**Status:** Awaiting human review

---

## 1. Dependency Graph

```
[Task 1: DB Migration]
        │
        ├──────────────────────────────────┐
        ▼                                  ▼
[Task 2: GCP SA Setup (manual)]    [Task 3: SettingsPage + Admin toggle]
        │
        ▼
[Task 4: lesson-qa-index edge fn]
        │
        ▼
[Task 5: lesson-qa-ask edge fn]
[Task 6: lesson-qa-clear edge fn]  (parallel with Task 5)
        │
        ▼
[Task 7: LessonQAPanel component]
        │
        ▼
[Task 8: Integrate panel into LessonDetailPage]
        │
        ▼
[CHECKPOINT: Full E2E working]
        │
        ▼
[Task 9: Image support (nice-to-have)]
```

Tasks 5 and 6 can run in parallel.  
Task 3 can run in parallel with Tasks 4–6 once the DB migration is applied.

---

## 2. Assumptions

1. Supabase CLI (Docker) is unavailable in this WSL environment — migrations are applied manually via the Supabase dashboard SQL editor.
2. GCP project `automatic-ace-488412-a7` already exists with billing enabled and Vertex AI API enabled.
3. `text-embedding-004` produces 768-dimension vectors (as specified in schema).
4. Gemma 4 is available on Vertex AI under the model ID the spec implies — we'll verify at integration time.
5. Edge Functions are deployed via `supabase functions deploy` CLI (Docker not needed for deploy-only).
6. The `lesson_files` table `storage_path` column holds the full path used with Supabase Storage.
7. Re-index is triggered when a new file is added: detect by comparing `lesson_files` count/updated_at against `lesson_index_status.indexed_at`.

---

## 3. Vertical Task Slices

Each task is a thin vertical slice that delivers a complete, testable path — not a horizontal layer.

---

### Task 1 — Database Foundation

**Files:** `supabase/migrations/<timestamp>_lesson_qa_schema.sql`

**What it delivers:** All new tables with RLS, the `is_admin` column, pgvector extension.

**SQL to write:**
```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- lesson_chunks
CREATE TABLE lesson_chunks ( ... );
CREATE INDEX ON lesson_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON lesson_chunks (lesson_id);

-- lesson_index_status
CREATE TABLE lesson_index_status ( ... );

-- lesson_qa_messages
CREATE TABLE lesson_qa_messages ( ... );
CREATE INDEX ON lesson_qa_messages (lesson_id, user_id, created_at);

-- app_config
CREATE TABLE app_config ( ... );
INSERT INTO app_config (key, value) VALUES ('qa_enabled', 'true');

-- profiles.is_admin
ALTER TABLE profiles ADD COLUMN is_admin boolean DEFAULT false NOT NULL;

-- All RLS policies (lesson_chunks, lesson_index_status, lesson_qa_messages, app_config)
```

**Acceptance criteria:**
- [ ] All 4 new tables exist in Supabase
- [ ] `profiles.is_admin` column exists, defaults to `false`
- [ ] pgvector extension is enabled (can run `SELECT '[1,2,3]'::vector`)
- [ ] Authenticated user can SELECT from `app_config`
- [ ] Authenticated user cannot SELECT `lesson_qa_messages` rows belonging to another user
- [ ] Authenticated user can only SELECT `lesson_chunks` for lessons they own or have been shared with

**Verification:**
```sql
-- In Supabase SQL editor (as an authenticated test user):
SELECT * FROM app_config WHERE key = 'qa_enabled';
-- Expected: 1 row, value = 'true'

SELECT vector_dims('[1,2,3]'::vector);
-- Expected: 3

SELECT is_admin FROM profiles WHERE id = auth.uid();
-- Expected: false
```

---

### Task 2 — GCP Service Account Setup *(manual)*

**What it delivers:** Supabase secret `GCP_VERTEX_SA_KEY` available to edge functions.

**Steps:**
1. In GCP console → IAM & Admin → Service Accounts → Create service account
   - Name: `supabase-vertex-ai`
   - Role: `Vertex AI User` (`roles/aiplatform.user`)
2. Create JSON key → download
3. In Supabase dashboard → Edge Functions → Secrets → Add secret:
   - Name: `GCP_VERTEX_SA_KEY`
   - Value: (paste entire JSON key content)

**Acceptance criteria:**
- [ ] Service account exists in project `automatic-ace-488412-a7`
- [ ] SA has `roles/aiplatform.user`
- [ ] `GCP_VERTEX_SA_KEY` secret is set in Supabase Edge Functions secrets

**Verification:** Edge function smoke test in Task 4.

---

### Task 3 — Feature Toggle: SettingsPage + Admin Nav

**Files:**
- `src/pages/SettingsPage.tsx` (new)
- `src/App.tsx` (add `/settings` route)
- `src/pages/LibraryPage.tsx` (add Settings nav link for admins)
- `src/contexts/AuthContext.tsx` (expose `isAdmin` flag, or read from `profiles`)

**What it delivers:** Admin can toggle Q&A on/off via UI; non-admins never see the Settings link.

**Behaviour:**
- SettingsPage reads `qa_enabled` from `app_config` on mount
- Toggle updates `app_config` via Supabase client (UPDATE ... WHERE key = 'qa_enabled')
- Route `/settings` is protected; if `profile.is_admin = false`, redirect to `/library`
- Admin nav link only renders when `profile.is_admin = true`

**data-testid attributes:**
```
settings-qa-toggle         (the toggle input)
settings-qa-toggle-label   (the label)
settings-page-title
```

**Acceptance criteria:**
- [ ] Non-admin user: no Settings link in nav, `/settings` redirects to `/library`
- [ ] Admin user: Settings link visible, toggle shows current `qa_enabled` value
- [ ] Toggling updates `app_config` in DB (verify in Supabase)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes

**Verification:** `npm run typecheck && npm run lint`, then manual browser test with an admin-flagged user.

---

**CHECKPOINT A — Foundation verified**  
Before proceeding to edge functions, confirm:
- [ ] DB migration applied and verified
- [ ] GCP SA key stored as Supabase secret
- [ ] SettingsPage working for admin users

---

### Task 4 — Edge Function: `lesson-qa-index`

**Files:** `supabase/functions/lesson-qa-index/index.ts`

**What it delivers:** Indexing pipeline — fetches lesson files, extracts PDF text, chunks, embeds via Vertex AI, stores in `lesson_chunks`.

**Implementation notes:**
- Deno TypeScript; use `@supabase/supabase-js` from esm.sh
- PDF extraction: `pdfjs-dist` Deno-compatible build (or `pdf-parse` equivalent)
- Chunking: 512-token window, 50-token overlap (approximate by character count ÷ 4 if token library unavailable)
- Vertex AI embedding call: `POST https://us-central1-aiplatform.googleapis.com/v1/projects/{project}/locations/us-central1/publishers/google/models/text-embedding-004:predict`
- Auth to GCP: parse `GCP_VERTEX_SA_KEY` secret → sign JWT → get access token
- Use service role key (via `SUPABASE_SERVICE_ROLE_KEY` env) to bypass RLS for reads/writes in the function
- Check `lesson_index_status`: if already `ready` and no new files since `indexed_at`, return early
- Delete existing `lesson_chunks` for lesson before re-inserting

**Error handling:**
- Catch per-file errors; log them; continue with remaining files
- On total failure: upsert `lesson_index_status` with `status = 'failed'`

**Acceptance criteria:**
- [ ] `POST /functions/v1/lesson-qa-index { lesson_id }` with valid JWT returns 200
- [ ] `lesson_index_status.status` = `'ready'` after successful run
- [ ] `lesson_chunks` rows exist for the lesson
- [ ] Embedding vectors have 768 dimensions
- [ ] Calling a second time with no new files returns early (idempotent)
- [ ] Invalid lesson_id returns 404
- [ ] Unauthorized user (no access to lesson) returns 403

**Verification:**
```bash
curl -X POST https://<project>.supabase.co/functions/v1/lesson-qa-index \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"lesson_id": "<known-lesson-id>"}'
# Expected: {"status":"ok"} or similar

# Check DB:
SELECT status, chunk_count FROM lesson_index_status WHERE lesson_id = '<id>';
SELECT COUNT(*) FROM lesson_chunks WHERE lesson_id = '<id>';
```

---

### Task 5 — Edge Function: `lesson-qa-ask`

**Files:** `supabase/functions/lesson-qa-ask/index.ts`

**What it delivers:** Full RAG Q&A — guardrails, embed question, similarity search, build prompt, generate answer, persist messages.

**Implementation notes:**
- Check `app_config qa_enabled`; return 403 if false
- Guardrails: max 500 chars; reject obvious prompt injection patterns (e.g., "ignore previous instructions", "system:")
- Vertex AI similarity search uses pgvector `<=>` operator via RPC or direct SQL
- Gemma 4 generation call: `POST .../publishers/google/models/gemma-4:generateContent`
- Conversation context: last 6 rows from `lesson_qa_messages` (3 user + 3 assistant turns)
- System prompt enforces grounding: answer ONLY from provided context
- No-match signal: if Gemma returns a response indicating it cannot find the answer, return the canned refusal (do not persist as a real answer)
- Persist both user message and assistant message in `lesson_qa_messages`

**Acceptance criteria:**
- [ ] Valid question about lesson content returns a grounded answer
- [ ] Question not in lesson content returns refusal ("I can't find an answer to that in this lesson")
- [ ] Question > 500 chars returns 400
- [ ] Prompt injection attempt returns 400 with polite refusal
- [ ] `qa_enabled = false` → returns 403
- [ ] Messages are persisted to `lesson_qa_messages`
- [ ] Answer does not contain general knowledge not in the files

**Verification:** Manual curl test with a question about a known PDF in the lesson.

---

### Task 6 — Edge Function: `lesson-qa-clear`

**Files:** `supabase/functions/lesson-qa-clear/index.ts`

**What it delivers:** Delete all conversation messages for the authenticated user + lesson.

**Implementation notes:**
- Simple: DELETE FROM lesson_qa_messages WHERE lesson_id = $1 AND user_id = auth.uid()
- Use user's JWT (RLS handles the user_id = auth.uid() constraint)
- Return 204 on success

**Acceptance criteria:**
- [ ] `DELETE /functions/v1/lesson-qa-clear { lesson_id }` returns 204
- [ ] Messages for that user + lesson are gone from DB
- [ ] Messages for other users for the same lesson are untouched
- [ ] Invalid lesson_id still returns 204 (idempotent)

**Verification:** Insert test messages, call clear, verify DB.

---

**CHECKPOINT B — Edge Functions deployed and tested**  
Before building the frontend panel, confirm:
- [ ] All 3 edge functions deployed (`supabase functions deploy lesson-qa-index`)
- [ ] lesson-qa-index smoke test passes
- [ ] lesson-qa-ask returns a real answer for a seeded lesson
- [ ] lesson-qa-clear empties messages

---

### Task 7 — Frontend: `LessonQAPanel` Component

**Files:** `src/components/LessonQAPanel.tsx` (new)

**Props:** `{ lessonId: string }`

**States and transitions:**
```
mount
  → read qa_enabled from app_config
  → if false: render nothing (hidden)
  → if true: GET lesson_index_status
      → 'ready': load history → show chat UI
      → 'indexing': show spinner, poll every 3s
      → 'failed': show error + retry button
      → null / 'pending': POST lesson-qa-index → show spinner, poll
```

**Implementation notes:**
- `app_config` read: `supabase.from('app_config').select('value').eq('key', 'qa_enabled').single()`
- Status poll: `useEffect` with `setInterval` (3s), clear on unmount / status change to `ready`
- Optimistic update: append user bubble immediately, replace `…` with real answer on response
- Clear conversation: browser `confirm()` dialog → call lesson-qa-clear → empty local message array
- Load history on mount: `supabase.from('lesson_qa_messages').select('*').eq('lesson_id', lessonId).order('created_at', { ascending: true })`
- Re-index trigger: after `lesson_files` change (handled by checking if `lesson_index_status.indexed_at` is older than newest `lesson_files.uploaded_at`)

**data-testid attributes (all required):**
```
lesson-qa-panel
lesson-qa-input
lesson-qa-submit-button
lesson-qa-message-{index}
lesson-qa-clear-button
lesson-qa-indexing-indicator
```

**Acceptance criteria:**
- [ ] Panel hidden when `qa_enabled = false`
- [ ] Indexing spinner visible with `data-testid="lesson-qa-indexing-indicator"` when status is `indexing`
- [ ] Input disabled during indexing
- [ ] Input enabled when `ready`
- [ ] Submitting a question appends optimistic user bubble, then assistant bubble on response
- [ ] Submit button disabled while awaiting response
- [ ] Clear button triggers confirm, empties chat on confirm
- [ ] Conversation history loads on mount
- [ ] All data-testid attributes present
- [ ] `npm run typecheck` passes

**Verification:** `npm run typecheck && npm run lint`, then `npm run dev` + manual browser test.

---

### Task 8 — Integrate Panel into `LessonDetailPage`

**Files:** `src/pages/LessonDetailPage.tsx` (modify)

**What it delivers:** `<LessonQAPanel lessonId={lesson.id} />` rendered below the files section.

**Change is surgical:**
```tsx
// After the closing </div> of the files section card, add:
<LessonQAPanel lessonId={lesson.id} />
```

**Acceptance criteria:**
- [ ] Q&A panel appears on lesson detail page below the files card
- [ ] Existing functionality (edit, delete, share, file download) unaffected
- [ ] All existing `data-testid` attributes still present
- [ ] `npm run typecheck` passes

**Verification:** `npm run dev`, open a lesson, verify panel renders.

---

**CHECKPOINT C — Full E2E feature working**  
Verify the complete user journey:
- [ ] Open lesson → panel appears, indexing starts
- [ ] After indexing completes, input enables
- [ ] Ask a question → grounded answer appears
- [ ] Reload page → conversation history loads
- [ ] Click "Clear conversation" → history deleted
- [ ] Admin disables Q&A in Settings → panel hidden for all users

---

### Task 9 — Image Support (Nice-to-have, US-5)

**Files:** `supabase/functions/lesson-qa-index/index.ts` (extend)

**What it delivers:** JPG/PNG/GIF files processed via Gemma 4 multimodal to generate text description, then embedded alongside PDF text.

**Implementation notes:**
- In the per-file loop: if `file_type` starts with `image/`, fetch the file bytes, base64-encode
- Call Vertex AI Gemma 4 multimodal: `generateContent` with inline image part + text prompt
  - Prompt: "Describe all text and visual content in this image for a Q&A system. Be thorough and specific."
- Treat the response text as a single chunk (or split if > 512 tokens)
- Embed via text-embedding-004 same as PDF chunks
- On image processing failure: log error, skip file, do not fail the whole indexing run

**Acceptance criteria:**
- [ ] Indexing a lesson with images produces `lesson_chunks` rows from image content
- [ ] Asking a question about image content returns a relevant answer
- [ ] Indexing still completes if image processing fails (graceful degradation)

---

## 4. Files Created / Modified Summary

| File | Action |
|---|---|
| `supabase/migrations/<ts>_lesson_qa_schema.sql` | Create |
| `supabase/functions/lesson-qa-index/index.ts` | Create |
| `supabase/functions/lesson-qa-ask/index.ts` | Create |
| `supabase/functions/lesson-qa-clear/index.ts` | Create |
| `src/components/LessonQAPanel.tsx` | Create |
| `src/pages/SettingsPage.tsx` | Create |
| `src/pages/LessonDetailPage.tsx` | Modify (add panel) |
| `src/pages/LibraryPage.tsx` | Modify (add admin nav link) |
| `src/App.tsx` | Modify (add /settings route) |
| `src/contexts/AuthContext.tsx` | Modify (expose is_admin) |

---

## 5. Out of Scope (v1)

Per SPEC.md §10:
- Citations / source references
- Streaming responses
- Cross-lesson search
- File types beyond PDF, JPG, PNG, GIF
- Per-lesson or per-user Q&A toggle
- Conversation sharing between users
