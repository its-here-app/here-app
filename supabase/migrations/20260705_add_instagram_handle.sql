-- Add optional Instagram handle to profiles.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_handle text;
