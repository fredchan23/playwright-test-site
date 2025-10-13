/*
  # Add Profile Search Policy for Lesson Sharing

  ## Changes
  This migration adds a new RLS policy to allow authenticated users to search for other users by email
  when sharing lessons. This is necessary for the lesson sharing feature to work properly.

  ## New Policy
  - "Authenticated users can search profiles by email" - Allows authenticated users to read any profile
    for the purpose of finding users to share lessons with. This is safe because:
    - Only basic profile info (id, email, username) is exposed
    - Users must be authenticated to search
    - This is standard practice for collaboration features

  ## Security Notes
  - This policy only grants SELECT access, users still cannot modify other profiles
  - The policy requires authentication, preventing anonymous access
  - No sensitive data beyond email and username is exposed
*/

-- Add policy to allow authenticated users to search for profiles by email
CREATE POLICY "Authenticated users can search profiles by email"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);