/*
  # Create Storage Bucket for Lesson Files

  ## Overview
  Creates a Supabase Storage bucket for lesson files (PDFs and images) with proper access policies.

  ## Storage Setup
  - Bucket name: `lesson-files`
  - Public: false (files are private by default)
  - File size limit: 10MB per file
  - Allowed file types: PDF, JPG, JPEG, PNG, GIF

  ## Security
  - Users can upload files to their own lesson folders
  - Users can view files from lessons they own or have access to
  - Users can delete files from their own lessons only
*/

-- Create storage bucket for lesson files
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-files', 'lesson-files', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload files to their own lesson folders
CREATE POLICY "Users can upload files to own lessons"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM lessons WHERE owner_id = (select auth.uid())
    )
  );

-- Policy: Users can view files from accessible lessons
CREATE POLICY "Users can view files from accessible lessons"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lesson-files'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM lessons WHERE owner_id = (select auth.uid())
      )
      OR (storage.foldername(name))[1] IN (
        SELECT lesson_id::text FROM lesson_shares WHERE shared_with_id = (select auth.uid())
      )
    )
  );

-- Policy: Users can delete files from own lessons
CREATE POLICY "Users can delete files from own lessons"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lesson-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM lessons WHERE owner_id = (select auth.uid())
    )
  );
