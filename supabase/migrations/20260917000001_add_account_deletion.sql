-- Account deletion with a 14-day undo window.
--
-- "Delete account" is a soft delete: the app stamps profiles.deleted_at and
-- signs the user out. For the next 14 days the account is hidden from everyone
-- else but fully intact, and signing in clears the stamp ("Sign back in
-- within 14 days to undo"). Past 14 days it is permanent: a nightly app job —
-- or the next sign-in attempt, whichever comes first — hard-deletes it by
-- removing the auth.users row, and every public table hangs off that
-- (profiles, saved_spots, follows, blocks, saved_playlists cascade directly;
-- playlists cascade via profiles and take playlist_spots, playlist_items and
-- saved_playlists with them; events and saved_spots.discovered_from_user_id
-- set to NULL, so other people's saves are untouched).

-- ── Column ───────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN profiles.deleted_at IS
  'Set when the user deletes their account. Hidden from other users while set; cleared by signing back in; purged by purge_deleted_accounts() after 14 days.';

-- The only query that reads this is "who is past the window?", so index the
-- (rare) stamped rows only.
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── Protected columns ────────────────────────────────────────────────────────
-- deleted_at and is_admin must only ever be written with the service-role key
-- (server actions / cron), never by the user's own session through the REST
-- API. 20260816000002 tried to do this for is_admin with
-- `REVOKE UPDATE (is_admin) ON profiles FROM authenticated`, but Postgres
-- ignores a column-level revoke while the role still holds the table-level
-- UPDATE grant (see REVOKE docs), so any signed-in user could flip their own
-- is_admin. This trigger is the actual enforcement for both columns.
--
-- current_user is the role PostgREST switched to for the request (anon /
-- authenticated); service_role, postgres and the cron worker pass through.

CREATE OR REPLACE FUNCTION protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_admin := false;
      NEW.deleted_at := NULL;
    ELSIF NEW.is_admin IS DISTINCT FROM OLD.is_admin
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'profiles.is_admin and profiles.deleted_at are read-only'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_columns ON profiles;
CREATE TRIGGER protect_profile_columns
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_columns();

-- ── Hide soft-deleted users ──────────────────────────────────────────────────
-- The existing SELECT policies on these tables are permissive and OR together
-- (several are plain `USING (true)`), so hiding a row means adding a
-- RESTRICTIVE policy, which ANDs on top of all of them. The user themself can
-- still see their own rows: sign-in needs to read the profile to restore it.
--
-- Only profiles and playlists are covered. Everything user-facing reaches a
-- deleted user's content through one of those two (profile page, playlist
-- pages, search, feed sections, Today's Pick mentions via playlists!inner), so
-- hiding them hides the rest. follows rows are left alone: a deleted user's
-- follows still count toward other people's follower totals for up to 14
-- days, which self-corrects on purge.

DROP POLICY IF EXISTS "Soft-deleted profiles are hidden" ON profiles;
CREATE POLICY "Soft-deleted profiles are hidden"
  ON profiles AS RESTRICTIVE FOR SELECT
  USING (deleted_at IS NULL OR auth.uid() = id);

DROP POLICY IF EXISTS "Soft-deleted users' playlists are hidden" ON playlists;
CREATE POLICY "Soft-deleted users' playlists are hidden"
  ON playlists AS RESTRICTIVE FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = playlists.user_id AND p.deleted_at IS NULL
    )
  );

-- ── Aggregate counts survive ─────────────────────────────────────────────────
-- Policy: "how many people saved a place" outlives the account, with no link
-- back to anyone. Cross-user save counts today are computed live from public
-- playlist inclusions (getPopularSpotsForCity and the recommendation
-- fallback), which cascade away with the account. So at purge time each place
-- the person had in a public list gets one anonymous tick here, and those
-- queries add it to the live count. Private bookmarks (saved_spots) were never
-- visible to anyone else and are not carried over.

ALTER TABLE spots ADD COLUMN IF NOT EXISTS retained_save_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN spots.retained_save_count IS
  'Saves by accounts that have since been purged: one per (deleted person, public list inclusion), no link to who. Added to live counts in popularity rankings.';

-- ── Purge ────────────────────────────────────────────────────────────────────
-- Hard-deletes one account whose grace period has lapsed. Returns false and
-- does nothing if the account is not (or no longer) past the window, so a
-- caller racing a restore can never remove a live account. Runs as postgres
-- via SECURITY DEFINER, which has DELETE on auth.users; every public table
-- cascades from there.
--
-- Called per account from /api/cron/purge-deleted-accounts (Vercel Cron,
-- nightly) and from sign-in when an expired account authenticates. The app
-- side also removes the person's files (profile-photos/<id>-*,
-- playlist-covers/<id>/*) through the Storage API, which SQL cannot reach —
-- that is why the purge is driven from the app rather than pg_cron.

CREATE OR REPLACE FUNCTION purge_deleted_account(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND deleted_at < now() - interval '14 days'
  ) THEN
    RETURN false;
  END IF;

  UPDATE spots s
     SET retained_save_count = s.retained_save_count + 1
    FROM (
      SELECT DISTINCT ps.spot_id
      FROM playlist_spots ps
      JOIN playlists pl ON pl.id = ps.playlist_id
      WHERE pl.user_id = p_user_id AND pl.is_public
    ) kept
   WHERE s.id = kept.spot_id;

  DELETE FROM auth.users WHERE id = p_user_id;
  RETURN true;
END;
$$;

-- Service-role only: the app calls it over RPC with the secret key.
REVOKE ALL ON FUNCTION purge_deleted_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_deleted_account(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION purge_deleted_account(uuid) TO service_role;

-- ── Metrics ──────────────────────────────────────────────────────────────────
-- Accounts in their grace period drop out of every admin view, the same way
-- admins do — all metric views read users through this base view.

CREATE OR REPLACE VIEW admin_metrics_profiles AS
  SELECT * FROM profiles WHERE NOT is_admin AND deleted_at IS NULL;

COMMENT ON VIEW admin_metrics_profiles IS
  'profiles minus admin accounts and accounts pending deletion. Every metrics view reads users through here.';
