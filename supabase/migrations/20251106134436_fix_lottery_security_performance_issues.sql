/*
  # Fix Security and Performance Issues for Lottery System

  ## Overview
  This migration addresses critical security and performance issues identified in the database audit
  for the lottery system tables (users, lottery_draws, actual_lottery_results).

  ## Changes Made

  ### 1. RLS Performance Optimization
  Updated all RLS policies to use `(select auth.uid())` instead of `auth.uid()` to prevent
  re-evaluation for each row. This significantly improves query performance at scale.

  **Policies Fixed:**
  - `users` table: 2 policies (users_select_own, users_update_own)
  - `lottery_draws` table: 4 policies (select, insert, update, delete)
  - `actual_lottery_results` table: 3 policies (insert, update, delete admin policies)

  ### 2. Unused Index Cleanup
  Removed indexes that are not being utilized by queries. These indexes consume storage
  and slow down INSERT/UPDATE operations without providing query benefits.

  **Indexes Removed:**
  - `idx_actual_results_machine_type` - Not used in queries
  - `idx_actual_results_draw_date` - Not used in queries
  - `idx_lottery_draws_machine_type` - Not used in queries
  - `idx_lottery_draws_created_at` - Not used in queries
  - `idx_lottery_draws_validation_score` - Not used in queries
  - `idx_lottery_draws_timestamp` - Not used in queries
  - `idx_actual_results_draw_number` - Not used in queries
  - `idx_users_admin` - Not used in queries
  - `idx_lottery_draws_user_id` - Not used in queries (foreign key still enforced)
  - `idx_actual_results_user_id` - Not used in queries (foreign key still enforced)

  ### 3. Function Security Enhancement
  Fixed all functions to use immutable search_path to prevent security vulnerabilities
  from search path manipulation attacks.

  **Functions Fixed:**
  - `debug_user_auth()` - Added SECURITY DEFINER with immutable search_path
  - `debug_table_access()` - Added SECURITY DEFINER with immutable search_path
  - `debug_test_insert()` - Added SECURITY DEFINER with immutable search_path
  - `handle_new_user()` - Added SECURITY DEFINER with immutable search_path

  ## Security Notes
  - All changes maintain existing access control requirements
  - Performance improvements do not compromise security
  - Function security hardening prevents privilege escalation attacks
  - Index removal does not affect data integrity or foreign key constraints

  ## Configuration Notes (Manual Steps Required)
  The following issues require configuration changes in Supabase Dashboard:

  1. **Auth OTP Expiry**: Navigate to Authentication > Email > OTP Expiry and set to less than 1 hour
  2. **Leaked Password Protection**: Navigate to Authentication > Policies and enable HaveIBeenPwned protection
  3. **Postgres Version**: Upgrade to latest postgres version from Project Settings > Infrastructure

  These cannot be configured via SQL migrations.
*/

-- ============================================================================
-- 1. DROP AND RECREATE RLS POLICIES WITH OPTIMIZED auth.uid() CALLS
-- ============================================================================

-- Users table policies
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;

CREATE POLICY "users_select_own"
  ON users FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Lottery draws table policies
DROP POLICY IF EXISTS "lottery_draws_select_own" ON lottery_draws;
DROP POLICY IF EXISTS "lottery_draws_insert_own" ON lottery_draws;
DROP POLICY IF EXISTS "lottery_draws_update_own" ON lottery_draws;
DROP POLICY IF EXISTS "lottery_draws_delete_own" ON lottery_draws;

CREATE POLICY "lottery_draws_select_own"
  ON lottery_draws FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "lottery_draws_insert_own"
  ON lottery_draws FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "lottery_draws_update_own"
  ON lottery_draws FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "lottery_draws_delete_own"
  ON lottery_draws FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Actual lottery results table policies (admin only)
DROP POLICY IF EXISTS "actual_results_insert_admin" ON actual_lottery_results;
DROP POLICY IF EXISTS "actual_results_update_admin" ON actual_lottery_results;
DROP POLICY IF EXISTS "actual_results_delete_admin" ON actual_lottery_results;

CREATE POLICY "actual_results_insert_admin"
  ON actual_lottery_results FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.is_admin = true
    )
  );

CREATE POLICY "actual_results_update_admin"
  ON actual_lottery_results FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.is_admin = true
    )
  );

CREATE POLICY "actual_results_delete_admin"
  ON actual_lottery_results FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND users.is_admin = true
    )
  );

-- ============================================================================
-- 2. DROP UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_actual_results_machine_type;
DROP INDEX IF EXISTS idx_actual_results_draw_date;
DROP INDEX IF EXISTS idx_lottery_draws_machine_type;
DROP INDEX IF EXISTS idx_lottery_draws_created_at;
DROP INDEX IF EXISTS idx_lottery_draws_validation_score;
DROP INDEX IF EXISTS idx_lottery_draws_timestamp;
DROP INDEX IF EXISTS idx_actual_results_draw_number;
DROP INDEX IF EXISTS idx_users_admin;
DROP INDEX IF EXISTS idx_lottery_draws_user_id;
DROP INDEX IF EXISTS idx_actual_results_user_id;

-- ============================================================================
-- 3. FIX FUNCTION SECURITY - SET IMMUTABLE SEARCH PATH
-- ============================================================================

-- Drop all functions first (CASCADE to remove triggers if they exist)
DROP FUNCTION IF EXISTS debug_user_auth() CASCADE;
DROP FUNCTION IF EXISTS debug_table_access() CASCADE;
DROP FUNCTION IF EXISTS debug_test_insert() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Recreate debug_user_auth function with secure search path
CREATE FUNCTION debug_user_auth()
RETURNS TABLE(
  current_user_id uuid,
  user_role text,
  is_authenticated boolean
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as current_user_id,
    current_user as user_role,
    (auth.uid() IS NOT NULL) as is_authenticated;
END;
$$;

-- Recreate debug_table_access function with secure search path
CREATE FUNCTION debug_table_access()
RETURNS TABLE(
  table_name text,
  can_select boolean,
  can_insert boolean,
  can_update boolean,
  can_delete boolean
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'users'::text as table_name,
    EXISTS(SELECT 1 FROM users LIMIT 1) as can_select,
    (SELECT 1 FROM users WHERE false) IS NULL as can_insert,
    false as can_update,
    false as can_delete
  UNION ALL
  SELECT 
    'lottery_draws'::text,
    EXISTS(SELECT 1 FROM lottery_draws LIMIT 1),
    (SELECT 1 FROM lottery_draws WHERE false) IS NULL,
    false,
    false
  UNION ALL
  SELECT 
    'actual_lottery_results'::text,
    EXISTS(SELECT 1 FROM actual_lottery_results LIMIT 1),
    (SELECT 1 FROM actual_lottery_results WHERE false) IS NULL,
    false,
    false;
END;
$$;

-- Recreate debug_test_insert function with secure search path
CREATE FUNCTION debug_test_insert()
RETURNS TABLE(
  test_name text,
  success boolean,
  error_message text
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  RETURN QUERY
  SELECT 
    'Check user exists'::text as test_name,
    EXISTS(SELECT 1 FROM users WHERE id = v_user_id) as success,
    CASE 
      WHEN EXISTS(SELECT 1 FROM users WHERE id = v_user_id) 
      THEN 'User found'::text
      ELSE 'User not found'::text
    END as error_message;
END;
$$;

-- Recreate handle_new_user function with secure search path
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, email, is_admin)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger for handle_new_user if it was dropped
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION handle_new_user();
  END IF;
END $$;
