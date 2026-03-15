/*
  # Add Automatic Profile Creation on User Signup

  ## Overview
  This migration adds a trigger to automatically create a profile record when a new user
  signs up via Supabase Auth. This ensures that the foreign key constraint on lessons.owner_id
  is always satisfied.

  ## Changes Made

  ### 1. Create Trigger Function
  - `handle_new_user()` - Creates a profile record when a new auth user is created
  - Uses the user's email from auth.users to populate the profile
  - Generates a username from the email (everything before @)
  - Sets SECURITY DEFINER with immutable search_path for security
  - Uses ON CONFLICT to prevent errors if profile already exists

  ### 2. Create Trigger
  - `on_auth_user_created` - Fires AFTER INSERT on auth.users
  - Automatically creates corresponding profile for new users

  ## Security Notes
  - Function uses SECURITY DEFINER to allow inserting into profiles table
  - Immutable search_path prevents search path manipulation attacks
  - ON CONFLICT clause prevents duplicate key errors
*/

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      split_part(NEW.email, '@', 1),
      'user_' || substring(NEW.id::text, 1, 8)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
