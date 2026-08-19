-- Discovery source attribution for saves.
--
-- The north star metric is "unique users per week taking an intent action on a
-- place they first encountered through another person". A saved_spots row alone
-- can't answer that — it records the save, not where the place came from.
-- This is not backfillable, so every save from here on records its surface.
--
-- NOTE: this attributes at save time (the surface the save happened on), which
-- is an approximation of "first encountered". True first-touch would require
-- logging every place impression.

ALTER TABLE saved_spots
  ADD COLUMN IF NOT EXISTS discovery_source text,
  ADD COLUMN IF NOT EXISTS discovered_from_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Rows that predate attribution stay NULL and are excluded from social metrics
-- rather than being guessed at.
ALTER TABLE saved_spots
  DROP CONSTRAINT IF EXISTS saved_spots_discovery_source_check;

ALTER TABLE saved_spots
  ADD CONSTRAINT saved_spots_discovery_source_check
  CHECK (
    discovery_source IS NULL
    OR discovery_source IN (
      'search',         -- spot search panel
      'feed',           -- home page discovery sections
      'own_playlist',   -- a list the saver owns
      'other_playlist', -- someone else's list
      'other_profile',  -- someone else's profile saves tab
      'direct'          -- own saves page, undo re-save, unattributed surface
    )
  );

-- A "social save" is one attributable to another person. Sources like `search`
-- and algorithmic `feed` rows have no attributable person and are excluded.
CREATE INDEX IF NOT EXISTS idx_saved_spots_social
  ON saved_spots (user_id, created_at)
  WHERE discovered_from_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_saved_spots_created_at ON saved_spots (created_at);
CREATE INDEX IF NOT EXISTS idx_saved_spots_discovery_source ON saved_spots (discovery_source);

COMMENT ON COLUMN saved_spots.discovery_source IS
  'Surface the save happened on. NULL for rows predating attribution (2026-08-16).';
COMMENT ON COLUMN saved_spots.discovered_from_user_id IS
  'The user whose content surfaced this spot, when attributable. Non-null implies a social save.';
