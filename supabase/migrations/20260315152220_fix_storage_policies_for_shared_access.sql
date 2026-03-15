/*
  # Fix Storage Policies for Shared Lesson Access

  ## Overview
  Updates storage bucket policies to ensure users with shared access to lessons
  can properly view and download image thumbnails and files.

  ## Changes Made
  1. Drop existing storage policies for lesson-files bucket
  2. Recreate policies with optimized auth.uid() pattern matching table RLS policies
  3. Ensure SELECT policy properly checks both owner and shared access

  ## Security
  - Maintains strict access control
  - Users can only access files from lessons they own or have been shared with
  - No changes to upload or delete permissions
*/

-- Drop existing storage policies
DROP POLICY IF EXISTS "Users can upload files to own lessons" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files from accessible lessons" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files from own lessons" ON storage.objects;

-- Recreate upload policy (unchanged, for completeness)
CREATE POLICY "Users can upload files to own lessons"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM lessons WHERE owner_id = (SELECT auth.uid())
    )
  );

-- Recreate view policy with optimized pattern
CREATE POLICY "Users can view files from accessible lessons"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lesson-files'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM lessons WHERE owner_id = (SELECT auth.uid())
      )
      OR (storage.foldername(name))[1] IN (
        SELECT lesson_id::text FROM lesson_shares WHERE shared_with_id = (SELECT auth.uid())
      )
    )
  );

-- Recreate delete policy (unchanged, for completeness)
CREATE POLICY "Users can delete files from own lessons"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lesson-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM lessons WHERE owner_id = (SELECT auth.uid())
    )
  );
