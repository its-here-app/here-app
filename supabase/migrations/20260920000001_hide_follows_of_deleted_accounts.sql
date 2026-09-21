-- Hide follows that involve an account pending deletion.
--
-- 20260917000001 hid a soft-deleted user's profile and playlists but left
-- follows alone, on the theory that a follower count being off by one for
-- up to 14 days was cosmetic. In practice it reads as a bug: the profile
-- header says "1 following", the modal behind it says "Not following anyone
-- yet" (the person's profile is hidden, so the list can't render them).
--
-- Same mechanism as the other two: a RESTRICTIVE policy ANDed onto the
-- existing `USING (true)` read policy. A row is visible only while both
-- parties are live — except that each party can always see their own side,
-- so a pending user with a live session (the restore flow) still sees their
-- own follows. The subqueries read profiles under that table's own RLS,
-- which already hides pending accounts from everyone else, so "hidden" and
-- "deleted_at IS NOT NULL" agree. Rows are never touched: they reappear on
-- restore and cascade away on purge.

DROP POLICY IF EXISTS "Follows of soft-deleted users are hidden" ON follows;
CREATE POLICY "Follows of soft-deleted users are hidden"
  ON follows AS RESTRICTIVE FOR SELECT
  USING (
    (
      auth.uid() = follower_id
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = follows.follower_id AND p.deleted_at IS NULL)
    )
    AND (
      auth.uid() = following_id
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = follows.following_id AND p.deleted_at IS NULL)
    )
  );
