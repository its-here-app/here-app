-- Exclude admin accounts from launch metrics.
--
-- Admin/test accounts (profiles.is_admin) skew small-N launch numbers. Every
-- metric view now reads through a non-admin-filtered base view instead of the
-- raw table, so an admin signing up, saving, listing, or following never
-- shows up in the counts. Output columns are unchanged, so CREATE OR REPLACE
-- is safe for every existing view.

-- ── Non-admin base views ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_metrics_profiles AS
  SELECT * FROM profiles WHERE NOT is_admin;

COMMENT ON VIEW admin_metrics_profiles IS
  'profiles minus admin accounts. Every metrics view reads users through here.';

CREATE OR REPLACE VIEW admin_metrics_saved_spots AS
  SELECT s.* FROM saved_spots s
  JOIN admin_metrics_profiles p ON p.id = s.user_id;

CREATE OR REPLACE VIEW admin_metrics_playlists AS
  SELECT pl.* FROM playlists pl
  JOIN admin_metrics_profiles p ON p.id = pl.user_id;

CREATE OR REPLACE VIEW admin_metrics_follows AS
  SELECT f.* FROM follows f
  JOIN admin_metrics_profiles p ON p.id = f.follower_id;

CREATE OR REPLACE VIEW admin_metrics_saved_playlists AS
  SELECT sp.* FROM saved_playlists sp
  JOIN admin_metrics_profiles p ON p.id = sp.user_id;

-- events.user_id is nullable (ON DELETE SET NULL) — keep rows with no user
-- rather than dropping them, since we can't tell if they were an admin's.
CREATE OR REPLACE VIEW admin_metrics_events AS
  SELECT e.* FROM events e
  LEFT JOIN profiles p ON p.id = e.user_id
  WHERE p.id IS NULL OR NOT p.is_admin;

-- ── Helper views, repointed at the filtered base views ──────────────────────

CREATE OR REPLACE VIEW admin_user_activity AS
  SELECT user_id, created_at FROM admin_metrics_saved_spots
  UNION ALL
  SELECT user_id, created_at FROM admin_metrics_playlists
  UNION ALL
  SELECT user_id, created_at FROM admin_metrics_saved_playlists
  UNION ALL
  SELECT follower_id AS user_id, created_at FROM admin_metrics_follows;

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
  FROM admin_metrics_playlists p
  LEFT JOIN playlist_spots ps ON ps.playlist_id = p.id
  GROUP BY p.id, p.user_id, p.city, p.city_id, p.is_public, p.created_at;

-- ── Overview ─────────────────────────────────────────────────────────────────
-- Unchanged except: profiles → admin_metrics_profiles, and the handful of
-- standalone (unjoined) saved_spots/playlists reads → their filtered views.

CREATE OR REPLACE VIEW admin_metrics_overview AS
WITH u AS (SELECT count(*)::numeric AS total_users FROM admin_metrics_profiles),
saves_per_user AS (
  SELECT p.id AS user_id, count(s.id) AS saves
  FROM admin_metrics_profiles p LEFT JOIN saved_spots s ON s.user_id = p.id
  GROUP BY p.id
),
lists_per_user AS (
  SELECT p.id AS user_id, count(pl.id) AS lists
  FROM admin_metrics_profiles p LEFT JOIN playlists pl ON pl.user_id = p.id
  GROUP BY p.id
),
first_list AS (
  SELECT pr.id AS user_id,
         EXTRACT(EPOCH FROM (min(pl.created_at) - pr.created_at)) / 3600 AS hours_to_first
  FROM admin_metrics_profiles pr JOIN playlists pl ON pl.user_id = pr.id
  GROUP BY pr.id, pr.created_at
)
SELECT
  (SELECT total_users FROM u)                                        AS total_users,
  (SELECT count(*) FROM admin_metrics_profiles WHERE created_at > now() - interval '7 days')  AS new_users_7d,
  (SELECT count(*) FROM admin_metrics_profiles WHERE created_at > now() - interval '28 days') AS new_users_28d,

  (SELECT count(*) FROM admin_metrics_playlists)                     AS total_lists,
  (SELECT count(*) FROM admin_metrics_playlists WHERE is_public)     AS public_lists,
  (SELECT count(*) FROM admin_playlist_quality WHERE is_quality)     AS quality_lists,

  -- City curators: people with at least one public, quality list.
  (SELECT count(DISTINCT user_id) FROM admin_playlist_quality
    WHERE is_quality AND is_public)                                  AS city_curators,

  (SELECT count(*) FROM lists_per_user WHERE lists > 0)              AS users_with_a_list,
  (SELECT round(100.0 * count(*) FILTER (WHERE lists > 0)
        / nullif(count(*), 0), 1) FROM lists_per_user)               AS pct_users_with_a_list,
  (SELECT round(avg(lists), 2) FROM lists_per_user)                  AS avg_lists_per_user,

  (SELECT count(*) FROM admin_metrics_saved_spots)                   AS total_spot_saves,
  (SELECT round(avg(saves), 2) FROM saves_per_user)                  AS avg_saves_per_user,
  (SELECT round(100.0 * count(*) FILTER (WHERE saves >= 20)
        / nullif(count(*), 0), 1) FROM saves_per_user)               AS pct_users_20plus_saves,

  -- Social saves are only measurable from 2026-08-16 onward.
  (SELECT count(*) FROM admin_metrics_saved_spots WHERE discovered_from_user_id IS NOT NULL) AS total_social_saves,

  -- "% of users saving places from someone else's list" — user-level, not save-level.
  (SELECT count(DISTINCT user_id) FROM admin_metrics_saved_spots
    WHERE discovered_from_user_id IS NOT NULL)                     AS users_with_social_save,
  (SELECT round(100.0 * count(DISTINCT user_id)
        / nullif((SELECT total_users FROM u), 0), 1)
     FROM admin_metrics_saved_spots WHERE discovered_from_user_id IS NOT NULL) AS pct_users_with_social_save,
  (SELECT round(count(*)::numeric / nullif((SELECT total_users FROM u), 0), 2)
     FROM admin_metrics_saved_spots WHERE discovered_from_user_id IS NOT NULL) AS avg_social_saves_per_user,

  (SELECT round(100.0 * count(*) FILTER (WHERE discovered_from_user_id IS NOT NULL)
        / nullif(count(*) FILTER (WHERE discovery_source IS NOT NULL), 0), 1)
     FROM admin_metrics_saved_spots)                                 AS pct_saves_social,
  (SELECT count(*) FROM admin_metrics_saved_spots WHERE discovery_source IS NULL) AS unattributed_saves,

  (SELECT round(100.0 * count(DISTINCT user_id)
        / nullif((SELECT total_users FROM u), 0), 1)
     FROM admin_metrics_playlists WHERE is_public)                   AS pct_users_sharing,

  (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY hours_to_first)::numeric, 1)
     FROM first_list)                                                AS median_hours_to_first_list;

-- ── Daily time series ────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_metrics_daily AS
WITH days AS (
  SELECT generate_series(
    date_trunc('day', (SELECT min(created_at) FROM admin_metrics_profiles)),
    date_trunc('day', now()),
    interval '1 day'
  )::date AS day
)
SELECT
  d.day,
  (SELECT count(*) FROM admin_metrics_profiles p WHERE p.created_at::date = d.day) AS signups,
  (SELECT count(*) FROM admin_metrics_playlists pl WHERE pl.created_at::date = d.day) AS lists_created,
  (SELECT count(*) FROM admin_metrics_playlists pl WHERE pl.created_at::date = d.day AND pl.is_public) AS public_lists_created,
  (SELECT count(*) FROM admin_metrics_saved_spots s WHERE s.created_at::date = d.day) AS spot_saves,
  (SELECT count(*) FROM admin_metrics_saved_spots s WHERE s.created_at::date = d.day
     AND s.discovered_from_user_id IS NOT NULL) AS social_saves,
  (SELECT count(*) FROM admin_metrics_saved_playlists sp WHERE sp.created_at::date = d.day) AS playlist_saves,
  (SELECT count(*) FROM admin_metrics_follows f WHERE f.created_at::date = d.day) AS follows,
  (SELECT count(*) FROM admin_metrics_events e WHERE e.created_at::date = d.day
     AND e.event IN ('share.completed', 'share.link_copied')) AS shares,
  (SELECT count(DISTINCT a.user_id) FROM admin_user_activity a
     WHERE a.created_at::date = d.day) AS active_users
FROM days d
ORDER BY d.day;

-- ── North star: weekly trusted discoveries ───────────────────────────────────

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
  FROM admin_metrics_saved_spots
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

-- ── Activation funnel by signup cohort ───────────────────────────────────────
-- follows/saved_spots/playlists here are joined to an already-filtered cohort
-- (c.user_id comes from admin_metrics_profiles), so they don't need swapping.

CREATE OR REPLACE VIEW admin_metrics_activation AS
WITH cohort AS (
  SELECT id AS user_id, created_at, date_trunc('week', created_at)::date AS cohort_week
  FROM admin_metrics_profiles
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

-- ── Retention cohorts ────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_metrics_retention_cohorts AS
WITH cohort AS (
  SELECT id AS user_id, created_at, date_trunc('month', created_at)::date AS cohort_month
  FROM admin_metrics_profiles
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

CREATE OR REPLACE VIEW admin_metrics_social_cohort_split AS
WITH cohort AS (
  SELECT id AS user_id, created_at FROM admin_metrics_profiles
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
FROM admin_metrics_saved_spots
GROUP BY 1
ORDER BY saves DESC;

-- ── Cities ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW admin_metrics_cities AS
WITH city_users AS (
  SELECT city_id, count(*) AS users FROM admin_metrics_profiles WHERE city_id IS NOT NULL GROUP BY city_id
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

-- ── Lock the new base views down too ────────────────────────────────────────

REVOKE ALL ON admin_metrics_profiles       FROM anon, authenticated;
REVOKE ALL ON admin_metrics_saved_spots    FROM anon, authenticated;
REVOKE ALL ON admin_metrics_playlists      FROM anon, authenticated;
REVOKE ALL ON admin_metrics_follows        FROM anon, authenticated;
REVOKE ALL ON admin_metrics_saved_playlists FROM anon, authenticated;
REVOKE ALL ON admin_metrics_events         FROM anon, authenticated;
