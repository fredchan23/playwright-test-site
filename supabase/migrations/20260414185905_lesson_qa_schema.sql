/*
  # Lesson Q&A Schema

  ## Overview
  Adds the database foundation for the "Ask this lesson" Q&A feature:
  RAG-powered conversational Q&A grounded in each lesson's uploaded files.

  ## Changes

  ### New extension
  - `vector` (pgvector) — for storing and searching embedding vectors

  ### New tables

  #### `lesson_chunks`
  Stores text chunks extracted from lesson files, with their embeddings.
  - `id` (uuid, primary key)
  - `lesson_id` (uuid, references lessons, cascade delete)
  - `file_id` (uuid, references lesson_files, cascade delete)
  - `chunk_index` (integer) — position within the file
  - `content` (text) — the extracted text chunk
  - `embedding` (vector(768)) — text-embedding-004 output
  - `created_at` (timestamptz)

  #### `lesson_index_status`
  Tracks the indexing pipeline state per lesson.
  - `lesson_id` (uuid, primary key, references lessons, cascade delete)
  - `status` (text) — one of: pending, indexing, ready, failed
  - `indexed_at` (timestamptz) — when indexing last completed successfully
  - `error` (text) — last error message if status = failed
  - `updated_at` (timestamptz)

  #### `lesson_qa_messages`
  Stores per-user per-lesson conversation history.
  - `id` (uuid, primary key)
  - `lesson_id` (uuid, references lessons, cascade delete)
  - `user_id` (uuid, references profiles, cascade delete)
  - `role` (text) — one of: user, assistant
  - `content` (text)
  - `created_at` (timestamptz)

  #### `app_config`
  Global key/value configuration.
  - `key` (text, primary key)
  - `value` (text)
  Seeded with `qa_enabled = 'true'`.

  ### Modified tables
  - `profiles` — adds `is_admin boolean DEFAULT false NOT NULL`

  ## Security
  - `lesson_chunks`: SELECT for authenticated users who own or have been shared the lesson
  - `lesson_index_status`: same access rule as lesson_chunks
  - `lesson_qa_messages`: user sees and manages only their own messages
  - `app_config`: all authenticated users can SELECT; writes enforced in Edge Functions only
  - `profiles.is_admin`: no additional policy needed (existing profile policies cover it)
*/

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- lesson_chunks
-- ---------------------------------------------------------------------------

CREATE TABLE lesson_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   uuid REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  file_id     uuid REFERENCES lesson_files(id) ON DELETE CASCADE NOT NULL,
  chunk_index integer NOT NULL,
  content     text NOT NULL,
  embedding   vector(768) NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- ivfflat index for approximate nearest-neighbour cosine search
CREATE INDEX idx_lesson_chunks_embedding ON lesson_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_lesson_chunks_lesson_id ON lesson_chunks (lesson_id);

-- ---------------------------------------------------------------------------
-- lesson_index_status
-- ---------------------------------------------------------------------------

CREATE TABLE lesson_index_status (
  lesson_id  uuid PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  status     text NOT NULL CHECK (status IN ('pending', 'indexing', 'ready', 'failed')),
  indexed_at timestamptz,
  error      text,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ---------------------------------------------------------------------------
-- lesson_qa_messages
-- ---------------------------------------------------------------------------

CREATE TABLE lesson_qa_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id  uuid REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_lesson_qa_messages_lookup ON lesson_qa_messages (lesson_id, user_id, created_at);

-- ---------------------------------------------------------------------------
-- app_config
-- ---------------------------------------------------------------------------

CREATE TABLE app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Default: Q&A feature is enabled
INSERT INTO app_config (key, value) VALUES ('qa_enabled', 'true');

-- ---------------------------------------------------------------------------
-- profiles: add is_admin column
-- ---------------------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN is_admin boolean DEFAULT false NOT NULL;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- lesson_chunks: readable if the user can access the parent lesson
ALTER TABLE lesson_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_chunks_select"
  ON lesson_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_chunks.lesson_id
        AND (
          lessons.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM lesson_shares
            WHERE lesson_shares.lesson_id = lessons.id
              AND lesson_shares.shared_with_id = auth.uid()
          )
        )
    )
  );

-- lesson_index_status: same lesson-access rule
ALTER TABLE lesson_index_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_index_status_select"
  ON lesson_index_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_index_status.lesson_id
        AND (
          lessons.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM lesson_shares
            WHERE lesson_shares.lesson_id = lessons.id
              AND lesson_shares.shared_with_id = auth.uid()
          )
        )
    )
  );

-- lesson_qa_messages: users see and manage only their own messages
ALTER TABLE lesson_qa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_qa_messages_select"
  ON lesson_qa_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "lesson_qa_messages_insert"
  ON lesson_qa_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "lesson_qa_messages_delete"
  ON lesson_qa_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- app_config: all authenticated users can read; writes handled in Edge Functions
-- (service role key bypasses RLS in edge functions — no INSERT/UPDATE policy needed here)
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_config_select"
  ON app_config FOR SELECT
  TO authenticated
  USING (true);
