-- Add is_active column to profiles table
ALTER TABLE profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Allow admins to update any profile (for toggling is_active)
-- Drop if exists to avoid conflicts
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );