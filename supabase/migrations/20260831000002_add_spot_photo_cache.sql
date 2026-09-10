-- Cache the resolved Google Places photo URL on the spot row.
--
-- Before this migration, /api/spots/photo resolved every single image render
-- through two billed Google calls: Place Details (fields=photos, $17/1k) and
-- Place Photo ($7/1k). Measured over August 2026 that was ~8,000 Details and
-- ~10,000 Photo calls, or $115 — from team testing alone, because the cost
-- scaled with page views rather than with the number of spots.
--
-- The resolved googleusercontent.com URL is now stored on the row alongside
-- the timestamp it was fetched at, so Google is only called when the entry is
-- missing or stale. Cost becomes a function of catalogue size (2,664 spots
-- with photos, both SKUs then sitting at or near their free tiers) instead of
-- traffic.
--
-- The 30-day ceiling is not arbitrary: the Google Maps Platform Service
-- Specific Terms §14.3 permit caching Places content for at most 30
-- consecutive calendar days, after which it must be deleted. Refresh-on-read
-- in the route handles rows that stay in circulation; purge_stale_spot_photo_cache()
-- below handles the deletion obligation for rows that stop being read.

ALTER TABLE spots
  ADD COLUMN IF NOT EXISTS photo_cdn_url text,
  ADD COLUMN IF NOT EXISTS photo_fetched_at timestamptz;

COMMENT ON COLUMN spots.photo_cdn_url IS
  'Resolved googleusercontent.com URL for this spot''s photo at maxwidth=800. Cache, not storage: must not outlive photo_fetched_at + 30 days (Maps Platform Service Specific Terms 14.3).';
COMMENT ON COLUMN spots.photo_fetched_at IS
  'When photo_cdn_url was resolved from the Places API. NULL means unresolved; the route resolves it on next read.';

-- The only query that matters is "which cached rows are past the ceiling?",
-- so the index is partial — rows with no cached URL get resolved on read
-- regardless and never need scanning.
CREATE INDEX IF NOT EXISTS idx_spots_photo_fetched_at
  ON spots (photo_fetched_at)
  WHERE photo_cdn_url IS NOT NULL;

-- Deletion half of the 30-day obligation, for rows nobody reads any more.
-- Returns the number of rows purged so a scheduled run can be logged.
CREATE OR REPLACE FUNCTION purge_stale_spot_photo_cache()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH purged AS (
    UPDATE spots
       SET photo_cdn_url = NULL,
           photo_fetched_at = NULL
     WHERE photo_cdn_url IS NOT NULL
       AND photo_fetched_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*)::integer FROM purged;
$$;

-- Service-role only, same posture as the admin metric views.
REVOKE ALL ON FUNCTION purge_stale_spot_photo_cache() FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_stale_spot_photo_cache() FROM anon, authenticated;

-- MANUAL STEP after applying: schedule the purge daily. With pg_cron enabled
-- (Supabase dashboard -> Database -> Extensions):
--
--   SELECT cron.schedule(
--     'purge-stale-spot-photo-cache',
--     '17 4 * * *',
--     $cron$ SELECT purge_stale_spot_photo_cache() $cron$
--   );
--
-- Left unscheduled here rather than enabling the extension from a migration,
-- which would fail on any environment that doesn't allow it. Refresh-on-read
-- already keeps every *served* photo inside the window, so the schedule covers
-- abandoned rows only — but it is required for the terms, not optional.
