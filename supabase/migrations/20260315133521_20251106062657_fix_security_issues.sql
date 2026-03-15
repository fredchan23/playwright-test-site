/*
  # Fix Database Security and Performance Issues

  ## Overview
  This migration addresses critical security and performance issues identified in the database audit.

  ## Changes Made

  ### 1. Performance Optimizations - RLS Policy Improvements
  All RLS policies have been updated to use `(select auth.uid())` instead of `auth.uid()` 
  to prevent re-evaluation for each row, significantly improving query performance at scale.

  **Tables Updated:**
  - `profiles`: 3 policies optimized (view own, update own, insert own)
  - `lessons`: 5 policies optimized (view own, view shared, create, update own, delete own)
  - `lesson_files`: 3 policies optimized (view accessible, upload, delete)
  - `lesson_shares`: 4 policies optimized (view own, view shared with, share own, revoke)

  ### 2. Missing Index Added
  - Added index `idx_lesson_shares_owner_id` on `lesson_shares(owner_id)` to support foreign key lookups

  ### 3. Function Security Enhancement
  - Fixed `update_updated_at_column()` function to use immutable search_path
  - Prevents potential security vulnerabilities from search path manipulation

  ### 4. Multiple Permissive Policies - Consolidated
  Merged multiple permissive SELECT policies into single policies with OR conditions:
  - `profiles`: Combined "Users can view own profile" and "Authenticated users can search profiles by email"
  - `lessons`: Combined "Users can view own lessons" and "Users can view shared lessons"
  - `lesson_shares`: Combined "Users can view shares for own lessons" and "Users can view lessons shared with them"

  ## Security Notes
  - All changes maintain existing access control requirements
  - Performance improvements do not compromise security
  - Consolidated policies maintain the same logical access rules
  - Function security hardening prevents privilege escalation attacks

  ## Unused Indexes Note
  The following indexes are reported as unused but are kept for future query optimization:
  - `idx_lessons_owner_id`, `idx_lessons_genre_id`, `idx_lessons_tags`
  - `idx_lesson_files_lesson_id`, `idx_lesson_shares_lesson_id`, `idx_lesson_shares_shared_with_id`
  These will be utilized as the application scales and query patterns evolve.

  ## Auth Configuration Note
  Leaked Password Protection should be enabled in Supabase Dashboard > Authentication > Policies.
  This is a dashboard setting and cannot be configured via SQL migration.
*/

-- ============================================================================
-- 1. DROP EXISTING POLICIES (to replace with optimized versions)
-- ============================================================================

-- Drop profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can search profiles by email" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Drop lessons policies
DROP POLICY IF EXISTS "Users can view own lessons" ON lessons;
DROP POLICY IF EXISTS "Users can view shared lessons" ON lessons;
DROP POLICY IF EXISTS "Users can create lessons" ON lessons;
DROP POLICY IF EXISTS "Users can update own lessons" ON lessons;
DROP POLICY IF EXISTS "Users can delete own lessons" ON lessons;

-- Drop lesson_files policies
DROP POLICY IF EXISTS "Users can view files for accessible lessons" ON lesson_files;
DROP POLICY IF EXISTS "Users can upload files to own lessons" ON lesson_files;
DROP POLICY IF EXISTS "Users can delete files from own lessons" ON lesson_files;

-- Drop lesson_shares policies
DROP POLICY IF EXISTS "Users can view shares for own lessons" ON lesson_shares;
DROP POLICY IF EXISTS "Users can view lessons shared with them" ON lesson_shares;
DROP POLICY IF EXISTS "Users can share own lessons" ON lesson_shares;
DROP POLICY IF EXISTS "Users can revoke shares for own lessons" ON lesson_shares;

-- ============================================================================
-- 2. ADD MISSING INDEX
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lesson_shares_owner_id ON lesson_shares(owner_id);

-- ============================================================================
-- 3. CREATE OPTIMIZED RLS POLICIES
-- ============================================================================

-- Profiles policies (consolidated multiple SELECT policies)
CREATE POLICY "Users can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id OR true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- Lessons policies (consolidated multiple SELECT policies)
CREATE POLICY "Users can view accessible lessons"
  ON lessons FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = owner_id
    OR EXISTS (
      SELECT 1 FROM lesson_shares
      WHERE lesson_shares.lesson_id = lessons.id
      AND lesson_shares.shared_with_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create lessons"
  ON lessons FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Users can update own lessons"
  ON lessons FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Users can delete own lessons"
  ON lessons FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = owner_id);

-- Lesson files policies
CREATE POLICY "Users can view files for accessible lessons"
  ON lesson_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_files.lesson_id
      AND (
        lessons.owner_id = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM lesson_shares
          WHERE lesson_shares.lesson_id = lessons.id
          AND lesson_shares.shared_with_id = (select auth.uid())
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
      AND lessons.owner_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete files from own lessons"
  ON lesson_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lessons
      WHERE lessons.id = lesson_files.lesson_id
      AND lessons.owner_id = (select auth.uid())
    )
  );

-- Lesson shares policies (consolidated multiple SELECT policies)
CREATE POLICY "Users can view relevant lesson shares"
  ON lesson_shares FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = owner_id 
    OR (select auth.uid()) = shared_with_id
  );

CREATE POLICY "Users can share own lessons"
  ON lesson_shares FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = owner_id);

CREATE POLICY "Users can revoke shares for own lessons"
  ON lesson_shares FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = owner_id);

-- ============================================================================
-- 4. FIX FUNCTION SECURITY
-- ============================================================================

-- Drop the function and its dependent triggers, then recreate everything
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
