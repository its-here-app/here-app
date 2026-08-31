-- Admin access + launch metric views.
--
-- Views are owned by postgres and deliberately NOT security_invoker, so they
-- aggregate across all rows regardless of RLS. They are revoked from anon and
-- authenticated at the bottom of this file — the /admin page reads them with
-- the service-role key after checking profiles.is_admin on the session user.

-- ── Admin flag ───────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Profiles already allow users to update their own row, so without a
-- column-level revoke any user could self-promote through the REST API.
REVOKE UPDATE (is_admin) ON profiles FROM authenticated, anon;

COMMENT ON COLUMN profiles.is_admin IS
  'Grants access to /admin. Set from the Supabase dashboard; not updatable via the API.';

-- ── Events ───────────────────────────────────────────────────────────────────
-- Behavioural signal only (shares today, sessions later). Durable facts belong
-- on their own tables — this stream is best-effort and drops writes on failure.

CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_event_created_at ON events (event, created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_created_at ON events (user_id, created_at);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert their own events" ON events;
CREATE POLICY "Users insert their own events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No SELECT policy: events are write-only from the app. Reads go through the
-- service-role key on the admin page.

-- ── Helper views ─────────────────────────────────────────────────────────────

-- Proxy for "active user = any session with a place interaction". We have no
-- session data yet, so activity is any durable place/social action. Replace the
-- body with real session events when those land; dependents pick it up.
CREATE OR REPLACE VIEW admin_user_activity AS
  SELECT user_id, created_at FROM saved_spots
  UNION ALL
  SELECT user_id, created_at FROM playlists
  UNION ALL
  SELECT user_id, created_at FROM saved_playlists
  UNION ALL
  SELECT follower_id AS user_id, created_at FROM follows;

COMMENT ON VIEW admin_user_activity IS
  'Proxy for user activity: saves, list creates, playlist saves, follows. Not sessions.';

-- "High quality list" = 5 or more spots. Threshold lives here so it can be
-- retuned in one place once real lists exist.
CREATE OR REPLACE VIEW admin_playlist_quality AS
  SELECT
    p.id,
    p.user_id,
    p.city,
    p.city_id,
    p.is_public,
    p.created_at,
    count(ps.id) AS spot_count,
    (count(ps.id) >= 5) AS is_quality
  FROM playlists p
  LEFT JOIN playlist_spots ps ON ps.playlist_id = p.id
  GROUP BY p.id;

-- ── Overview ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_metrics_overview AS
WITH u AS (SELECT count(*)::numeric AS total_users FROM profiles),
saves_per_user AS (
  SELECT p.id AS user_id, count(s.id) AS saves
  FROM profiles p LEFT JOIN saved_spots s ON s.user_id = p.id
  GROUP BY p.id
),
lists_per_user AS (
  SELECT p.id AS user_id, count(pl.id) AS lists
  FROM profiles p LEFT JOIN playlists pl ON pl.user_id = p.id
  GROUP BY p.id
),
first_list AS (
  SELECT pr.id AS user_id,
         EXTRACT(EPOCH FROM (min(pl.created_at) - pr.created_at)) / 3600 AS hours_to_first
  FROM profiles pr JOIN playlists pl ON pl.user_id = pr.id
  GROUP BY pr.id, pr.created_at
)
SELECT
  (SELECT total_users FROM u)                                        AS total_users,
  (SELECT count(*) FROM profiles WHERE created_at > now() - interval '7 days')  AS new_users_7d,
  (SELECT count(*) FROM profiles WHERE created_at > now() - interval '28 days') AS new_users_28d,

  (SELECT count(*) FROM playlists)                                   AS total_lists,
  (SELECT count(*) FROM playlists WHERE is_public)                   AS public_lists,
  (SELECT count(*) FROM admin_playlist_quality WHERE is_quality)     AS quality_lists,

  -- City curators: people with at least one public, quality list.
  (SELECT count(DISTINCT user_id) FROM admin_playlist_quality
    WHERE is_quality AND is_public)                                  AS city_curators,

  (SELECT count(*) FROM lists_per_user WHERE lists > 0)              AS users_with_a_list,
  (SELECT round(100.0 * count(*) FILTER (WHERE lists > 0)
        / nullif(count(*), 0), 1) FROM lists_per_user)               AS pct_users_with_a_list,
  (SELECT round(avg(lists), 2) FROM lists_per_user)                  AS avg_lists_per_user,

  (SELECT count(*) FROM saved_spots)                                 AS total_spot_saves,
  (SELECT round(avg(saves), 2) FROM saves_per_user)                  AS avg_saves_per_user,
  (SELECT round(100.0 * count(*) FILTER (WHERE saves >= 20)
        / nullif(count(*), 0), 1) FROM saves_per_user)               AS pct_users_20plus_saves,

  -- Social saves are only measurable from 2026-08-16 onward.
  (SELECT count(*) FROM saved_spots WHERE discovered_from_user_id IS NOT NULL) AS total_social_saves,

  -- "% of users saving places from someone else's list" — user-level, not save-level.
  (SELECT count(DISTINCT user_id) FROM saved_spots
    WHERE discovered_from_user_id IS NOT NULL)                     AS users_with_social_save,
  (SELECT round(100.0 * count(DISTINCT user_id)
        / nullif((SELECT total_users FROM u), 0), 1)
     FROM saved_spots WHERE discovered_from_user_id IS NOT NULL)    AS pct_users_with_social_save,
  (SELECT round(count(*)::numeric / nullif((SELECT total_users FROM u), 0), 2)
     FROM saved_spots WHERE discovered_from_user_id IS NOT NULL)    AS avg_social_saves_per_user,

  (SELECT round(100.0 * count(*) FILTER (WHERE discovered_from_user_id IS NOT NULL)
        / nullif(count(*) FILTER (WHERE discovery_source IS NOT NULL), 0), 1)
     FROM saved_spots)                                               AS pct_saves_social,
  (SELECT count(*) FROM saved_spots WHERE discovery_source IS NULL)  AS unattributed_saves,

  (SELECT round(100.0 * count(DISTINCT user_id)
        / nullif((SELECT total_users FROM u), 0), 1)
     FROM playlists WHERE is_public)                                 AS pct_users_sharing,

  (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY hours_to_first)::numeric, 1)
     FROM first_list)                                                AS median_hours_to_first_list;

-- ── Daily time series ────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_metrics_daily AS
WITH days AS (
  SELECT generate_series(
    date_trunc('day', (SELECT min(created_at) FROM profiles)),
    date_trunc('day', now()),
    interval '1 day'
  )::date AS day
)
SELECT
  d.day,
  (SELECT count(*) FROM profiles p     WHERE p.created_at::date = d.day) AS signups,
  (SELECT count(*) FROM playlists pl   WHERE pl.created_at::date = d.day) AS lists_created,
  (SELECT count(*) FROM playlists pl   WHERE pl.created_at::date = d.day AND pl.is_public) AS public_lists_created,
  (SELECT count(*) FROM saved_spots s  WHERE s.created_at::date = d.day) AS spot_saves,
  (SELECT count(*) FROM saved_spots s  WHERE s.created_at::date = d.day
     AND s.discovered_from_user_id IS NOT NULL) AS social_saves,
  (SELECT count(*) FROM saved_playlists sp WHERE sp.created_at::date = d.day) AS playlist_saves,
  (SELECT count(*) FROM follows f      WHERE f.created_at::date = d.day) AS follows,
  (SELECT count(*) FROM events e       WHERE e.created_at::date = d.day
     AND e.event IN ('share.completed', 'share.link_copied')) AS shares,
  (SELECT count(DISTINCT a.user_id) FROM admin_user_activity a
     WHERE a.created_at::date = d.day) AS active_users
FROM days d
ORDER BY d.day;

-- ── North star: weekly trusted discoveries ───────────────────────────────────
-- Unique users per week who saved a place attributable to another person,
-- over weekly active users.

CREATE OR REPLACE VIEW admin_metrics_north_star AS
WITH activity AS (
  SELECT date_trunc('week', created_at)::date AS week, user_id
  FROM admin_user_activity
),
wau AS (
  SELECT week, count(DISTINCT user_id) AS weekly_active_users
  FROM activity GROUP BY week
),
td AS (
  SELECT date_trunc('week', created_at)::date AS week,
         count(DISTINCT user_id) AS trusted_discoverers
  FROM saved_spots
  WHERE discovered_from_user_id IS NOT NULL
  GROUP BY 1
)
SELECT
  w.week,
  w.weekly_active_users,
  coalesce(t.trusted_discoverers, 0) AS trusted_discoverers,
  round(100.0 * coalesce(t.trusted_discoverers, 0)
        / nullif(w.weekly_active_users, 0), 1) AS pct_of_wau
FROM wau w
LEFT JOIN td t USING (week)
ORDER BY w.week;

COMMENT ON VIEW admin_metrics_north_star IS
  'Weekly trusted discoveries. Target >40% of WAU; below ~20% the social layer is not the primary mode.';

-- ── Activation funnel by signup cohort ───────────────────────────────────────

CREATE OR REPLACE VIEW admin_metrics_activation AS
WITH cohort AS (
  SELECT id AS user_id, created_at, date_trunc('week', created_at)::date AS cohort_week
  FROM profiles
),
follows_24h AS (
  SELECT c.user_id, count(*) AS n
  FROM cohort c
  JOIN follows f ON f.follower_id = c.user_id
   AND f.created_at < c.created_at + interval '24 hours'
  GROUP BY c.user_id
),
first_social_save AS (
  SELECT c.user_id, min(s.created_at) AS at
  FROM cohort c
  JOIN saved_spots s ON s.user_id = c.user_id AND s.discovered_from_user_id IS NOT NULL
  GROUP BY c.user_id
),
first_list AS (
  SELECT user_id, min(created_at) AS at FROM playlists GROUP BY user_id
)
SELECT
  c.cohort_week,
  count(*) AS cohort_size,
  round(100.0 * count(*) FILTER (WHERE coalesce(f.n, 0) >= 3)
        / nullif(count(*), 0), 1) AS pct_following_3plus_in_24h,
  round(100.0 * count(*) FILTER (WHERE s.at < c.created_at + interval '7 days')
        / nullif(count(*), 0), 1) AS pct_social_save_week1,
  round(100.0 * count(*) FILTER (WHERE l.at IS NOT NULL)
        / nullif(count(*), 0), 1) AS pct_created_a_list,
  round(percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (s.at - c.created_at)) / 60)::numeric, 1)
        AS median_minutes_to_first_social_save,
  round(percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (l.at - c.created_at)) / 3600)::numeric, 1)
        AS median_hours_to_first_list
FROM cohort c
LEFT JOIN follows_24h f ON f.user_id = c.user_id
LEFT JOIN first_social_save s ON s.user_id = c.user_id
LEFT JOIN first_list l ON l.user_id = c.user_id
GROUP BY c.cohort_week
ORDER BY c.cohort_week DESC;

COMMENT ON VIEW admin_metrics_activation IS
  'Targets: following 3+ in 24h >=70%, social save week 1 >=40%, time to first social save <5 min.';

-- ── Retention cohorts ────────────────────────────────────────────────────────
-- Percentages are computed only over users old enough to have reached the
-- milestone, so a fresh cohort reads NULL rather than a misleading 0%.

CREATE OR REPLACE VIEW admin_metrics_retention_cohorts AS
WITH cohort AS (
  SELECT id AS user_id, created_at, date_trunc('month', created_at)::date AS cohort_month
  FROM profiles
),
joined AS (
  SELECT c.cohort_month, c.user_id, c.created_at, a.created_at AS active_at
  FROM cohort c
  LEFT JOIN admin_user_activity a ON a.user_id = c.user_id
)
SELECT
  cohort_month,
  count(DISTINCT user_id) AS cohort_size,

  count(DISTINCT user_id) FILTER (WHERE created_at < now() - interval '60 days')  AS eligible_m1,
  count(DISTINCT user_id) FILTER (WHERE created_at < now() - interval '120 days') AS eligible_m3,
  count(DISTINCT user_id) FILTER (WHERE created_at < now() - interval '210 days') AS eligible_m6,

  round(100.0 * count(DISTINCT user_id) FILTER (
      WHERE created_at < now() - interval '60 days'
        AND active_at >= created_at + interval '30 days'
        AND active_at <  created_at + interval '60 days')
    / nullif(count(DISTINCT user_id) FILTER (
      WHERE created_at < now() - interval '60 days'), 0), 1) AS m1_retention_pct,

  round(100.0 * count(DISTINCT user_id) FILTER (
      WHERE created_at < now() - interval '120 days'
        AND active_at >= created_at + interval '90 days'
        AND active_at <  created_at + interval '120 days')
    / nullif(count(DISTINCT user_id) FILTER (
      WHERE created_at < now() - interval '120 days'), 0), 1) AS m3_retention_pct,

  round(100.0 * count(DISTINCT user_id) FILTER (
      WHERE created_at < now() - interval '210 days'
        AND active_at >= created_at + interval '180 days'
        AND active_at <  created_at + interval '210 days')
    / nullif(count(DISTINCT user_id) FILTER (
      WHERE created_at < now() - interval '210 days'), 0), 1) AS m6_retention_pct
FROM joined
GROUP BY cohort_month
ORDER BY cohort_month DESC;

-- ── Social cohort split ──────────────────────────────────────────────────────
-- Settles the cold-start thesis: do users who get a social save in week 1
-- retain better than those who don't?

CREATE OR REPLACE VIEW admin_metrics_social_cohort_split AS
WITH cohort AS (
  SELECT id AS user_id, created_at FROM profiles
  WHERE created_at < now() - interval '60 days'
),
tagged AS (
  SELECT c.user_id, c.created_at,
    EXISTS (
      SELECT 1 FROM saved_spots s
      WHERE s.user_id = c.user_id
        AND s.discovered_from_user_id IS NOT NULL
        AND s.created_at < c.created_at + interval '7 days'
    ) AS had_social_save_week1
  FROM cohort c
)
SELECT
  t.had_social_save_week1,
  count(*) AS users,
  round(100.0 * count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM admin_user_activity a
      WHERE a.user_id = t.user_id
        AND a.created_at >= t.created_at + interval '30 days'
        AND a.created_at <  t.created_at + interval '60 days'))
    / nullif(count(*), 0), 1) AS m1_retention_pct
FROM tagged t
GROUP BY t.had_social_save_week1;

-- ── Discovery mix ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_metrics_discovery_mix AS
SELECT
  coalesce(discovery_source, 'unattributed') AS source,
  count(*) AS saves,
  count(*) FILTER (WHERE discovered_from_user_id IS NOT NULL) AS social_saves,
  round(100.0 * count(*) / nullif(sum(count(*)) OVER (), 0), 1) AS pct_of_saves
FROM saved_spots
GROUP BY 1
ORDER BY saves DESC;

-- ── Cities ───────────────────────────────────────────────────────────────────
-- Where the user base actually is, so content can be buffed where it is thin.

CREATE OR REPLACE VIEW admin_metrics_cities AS
WITH city_users AS (
  SELECT city_id, count(*) AS users FROM profiles WHERE city_id IS NOT NULL GROUP BY city_id
),
city_lists AS (
  SELECT city_id,
         count(*) AS lists,
         count(*) FILTER (WHERE is_quality) AS quality_lists,
         count(DISTINCT user_id) FILTER (WHERE is_quality AND is_public) AS curators
  FROM admin_playlist_quality WHERE city_id IS NOT NULL GROUP BY city_id
)
SELECT
  c.id AS city_id,
  c.display_name,
  coalesce(cu.users, 0) AS users,
  coalesce(cl.lists, 0) AS lists,
  coalesce(cl.quality_lists, 0) AS quality_lists,
  coalesce(cl.curators, 0) AS curators,
  -- Demand with no supply behind it: the empty-feed risk, by city.
  (coalesce(cu.users, 0) > 0 AND coalesce(cl.quality_lists, 0) = 0) AS content_gap
FROM cities c
LEFT JOIN city_users cu ON cu.city_id = c.id
LEFT JOIN city_lists cl ON cl.city_id = c.id
WHERE coalesce(cu.users, 0) > 0 OR coalesce(cl.lists, 0) > 0
ORDER BY users DESC, lists DESC;

-- ── Lock the views down ──────────────────────────────────────────────────────
-- Read exclusively through the service-role key, after an is_admin check.

REVOKE ALL ON admin_user_activity              FROM anon, authenticated;
REVOKE ALL ON admin_playlist_quality           FROM anon, authenticated;
REVOKE ALL ON admin_metrics_overview           FROM anon, authenticated;
REVOKE ALL ON admin_metrics_daily              FROM anon, authenticated;
REVOKE ALL ON admin_metrics_north_star         FROM anon, authenticated;
REVOKE ALL ON admin_metrics_activation         FROM anon, authenticated;
REVOKE ALL ON admin_metrics_retention_cohorts  FROM anon, authenticated;
REVOKE ALL ON admin_metrics_social_cohort_split FROM anon, authenticated;
REVOKE ALL ON admin_metrics_discovery_mix      FROM anon, authenticated;
REVOKE ALL ON admin_metrics_cities             FROM anon, authenticated;
