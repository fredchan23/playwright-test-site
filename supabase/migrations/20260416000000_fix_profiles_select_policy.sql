/*
  # Fix profiles SELECT policy clarity

  ## Problem
  The "Users can view profiles" policy used `USING ((select auth.uid()) = id OR true)`,
  which is logically equivalent to `USING (true)` but reads like a bug.

  ## Intent
  All authenticated users are intentionally allowed to read all profiles.
  This is required for the lesson sharing feature, where users must search
  for other users by email to grant access to a lesson.

  ## Change
  Replace the misleading `OR true` form with a plain `USING (true)` and
  rename the policy to make the access level self-documenting.
*/

DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);
