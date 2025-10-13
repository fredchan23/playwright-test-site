/*
  # Initial Schema for Learning Management System

  ## Overview
  This migration creates the foundational database structure for a Learning Management System
  designed for engineers learning Playwright automation scripting.

  ## New Tables

  ### 1. `profiles`
  - `id` (uuid, primary key, references auth.users)
  - `email` (text, unique, not null)
  - `username` (text, unique, not null)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
  
  User profile information extending Supabase auth.users.

  ### 2. `genres`
  - `id` (uuid, primary key)
  - `name` (text, unique, not null)
  - `created_at` (timestamptz, default now())
  
  Predefined lesson categories (Programming, Design, Business, Language, Science, Mathematics, Arts).

  ### 3. `lessons`
  - `id` (uuid, primary key)
  - `owner_id` (uuid, references profiles, not null)
  - `title` (text, not null)
  - `description` (text, not null)
  - `genre_id` (uuid, references genres)
  - `tags` (text array, default empty array)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
  
  Main lesson content metadata.

  ### 4. `lesson_files`
  - `id` (uuid, primary key)
  - `lesson_id` (uuid, references lessons, cascade delete)
  - `filename` (text, not null)
  - `file_type` (text, not null)
  - `file_size` (bigint, not null)
  - `storage_path` (text, not null)
  - `uploaded_at` (timestamptz, default now())
  
  Stores metadata for files uploaded to lessons.

  ### 5. `lesson_shares`
  - `id` (uuid, primary key)
  - `lesson_id` (uuid, references lessons, cascade delete)
  - `owner_id` (uuid, references profiles, not null)
  - `shared_with_id` (uuid, references profiles, not null)
  - `shared_at` (timestamptz, default now())
  - Unique constraint on (lesson_id, shared_with_id)
  
  Tracks which lessons are shared with which users.

  ## Security

  ### Row Level Security (RLS)
  - All tables have RLS enabled
  - Users can only read their own profile
  - Users can update their own profile
  - Users can read all genres
  - Users can create lessons (must be owner)
  - Users can read their own lessons and lessons shared with them
  - Users can update/delete only their own lessons
  - Users can manage files for their own lessons
  - Users can view files for lessons they have access to
  - Users can share their own lessons
  - Users can view shares for their own lessons

  ## Notes
  - All IDs use UUID for security and scalability
  - Timestamps use timestamptz for timezone awareness
  - Cascade deletes ensure data consistency
  - RLS policies enforce strict access control
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create genres table
CREATE TABLE IF NOT EXISTS genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  genre_id uuid REFERENCES genres(id) ON DELETE SET NULL,
  tags text[] DEFAULT '{}' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create lesson_files table
CREATE TABLE IF NOT EXISTS lesson_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  filename text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text NOT NULL,
  uploaded_at timestamptz DEFAULT now() NOT NULL
);

-- Create lesson_shares table
CREATE TABLE IF NOT EXISTS lesson_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  shared_with_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  shared_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(lesson_id, shared_with_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lessons_owner_id ON lessons(owner_id);
CREATE INDEX IF NOT EXISTS idx_lessons_genre_id ON lessons(genre_id);
CREATE INDEX IF NOT EXISTS idx_lessons_tags ON lessons USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_lesson_files_lesson_id ON lesson_files(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_shares_lesson_id ON lesson_shares(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_shares_shared_with_id ON lesson_shares(shared_with_id);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_shares ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Genres policies (public read for all authenticated users)
CREATE POLICY "All users can view genres"
  ON genres FOR SELECT
  TO authenticated
  USING (true);

-- Lessons policies
CREATE POLICY "Users can view own lessons"
  ON lessons FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can view shared lessons"
  ON lessons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lesson_shares
      WHERE lesson_shares.lesson_id = lessons.id
      AND lesson_shares.shared_with_id = auth.uid()
    )
  );

CREATE POLICY "Users can create lessons"
  ON lessons FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own lessons"
  ON lessons FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own lessons"
  ON lessons FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Lesson files policies
CREATE POLICY "Users can view files for accessible lessons"
  ON lesson_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_files.lesson_id
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

CREATE POLICY "Users can upload files to own lessons"
  ON lesson_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_files.lesson_id
      AND lessons.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete files from own lessons"
  ON lesson_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_files.lesson_id
      AND lessons.owner_id = auth.uid()
    )
  );

-- Lesson shares policies
CREATE POLICY "Users can view shares for own lessons"
  ON lesson_shares FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can view lessons shared with them"
  ON lesson_shares FOR SELECT
  TO authenticated
  USING (auth.uid() = shared_with_id);

CREATE POLICY "Users can share own lessons"
  ON lesson_shares FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can revoke shares for own lessons"
  ON lesson_shares FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Insert predefined genres
INSERT INTO genres (name) VALUES
  ('Programming'),
  ('Design'),
  ('Business'),
  ('Language'),
  ('Science'),
  ('Mathematics'),
  ('Arts')
ON CONFLICT (name) DO NOTHING;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();