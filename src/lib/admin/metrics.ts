import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * Metric views are revoked from anon and authenticated, so they're read with the
 * service-role key. Every caller must clear `requireAdmin()` first.
 */
function metricsClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Returns the admin's user id, or null if the caller isn't an admin. */
export async function requireAdmin(): Promise<string | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user.id : null;
}

export interface Overview {
  total_users: number;
  new_users_7d: number;
  new_users_28d: number;
  total_lists: number;
  public_lists: number;
  quality_lists: number;
  city_curators: number;
  users_with_a_list: number;
  pct_users_with_a_list: number | null;
  avg_lists_per_user: number | null;
  total_spot_saves: number;
  avg_saves_per_user: number | null;
  pct_users_20plus_saves: number | null;
  total_social_saves: number;
  users_with_social_save: number;
  pct_users_with_social_save: number | null;
  avg_social_saves_per_user: number | null;
  pct_saves_social: number | null;
  unattributed_saves: number;
  pct_users_sharing: number | null;
  median_hours_to_first_list: number | null;
}

export interface DailyRow {
  day: string;
  signups: number;
  lists_created: number;
  public_lists_created: number;
  spot_saves: number;
  social_saves: number;
  playlist_saves: number;
  follows: number;
  shares: number;
  active_users: number;
}

export interface NorthStarRow {
  week: string;
  weekly_active_users: number;
  trusted_discoverers: number;
  pct_of_wau: number | null;
}

export interface ActivationRow {
  cohort_week: string;
  cohort_size: number;
  pct_following_3plus_in_24h: number | null;
  pct_social_save_week1: number | null;
  pct_created_a_list: number | null;
  median_minutes_to_first_social_save: number | null;
  median_hours_to_first_list: number | null;
}

export interface RetentionRow {
  cohort_month: string;
  cohort_size: number;
  eligible_m1: number;
  eligible_m3: number;
  eligible_m6: number;
  m1_retention_pct: number | null;
  m3_retention_pct: number | null;
  m6_retention_pct: number | null;
}

export interface SocialSplitRow {
  had_social_save_week1: boolean;
  users: number;
  m1_retention_pct: number | null;
}

export interface DiscoveryRow {
  source: string;
  saves: number;
  social_saves: number;
  pct_of_saves: number | null;
}

export interface CityRow {
  city_id: string;
  display_name: string;
  users: number;
  lists: number;
  quality_lists: number;
  curators: number;
  content_gap: boolean;
}

export interface MetricsSnapshot {
  overview: Overview | null;
  daily: DailyRow[];
  northStar: NorthStarRow[];
  activation: ActivationRow[];
  retention: RetentionRow[];
  socialSplit: SocialSplitRow[];
  discovery: DiscoveryRow[];
  cities: CityRow[];
  errors: string[];
}

export async function getMetrics(days = 60): Promise<MetricsSnapshot> {
  const db = metricsClient();
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [overview, daily, northStar, activation, retention, socialSplit, discovery, cities] =
    await Promise.all([
      db.from("admin_metrics_overview").select("*").maybeSingle(),
      db.from("admin_metrics_daily").select("*").gte("day", since).order("day"),
      db.from("admin_metrics_north_star").select("*").order("week"),
      db.from("admin_metrics_activation").select("*").limit(12),
      db.from("admin_metrics_retention_cohorts").select("*").limit(12),
      db.from("admin_metrics_social_cohort_split").select("*"),
      db.from("admin_metrics_discovery_mix").select("*"),
      db.from("admin_metrics_cities").select("*").limit(25),
    ]);

  // Surface failures on the page rather than rendering a confident zero — a
  // dashboard that silently shows 0 is worse than one that says it broke.
  const errors = [
    ["overview", overview.error],
    ["daily", daily.error],
    ["north star", northStar.error],
    ["activation", activation.error],
    ["retention", retention.error],
    ["social split", socialSplit.error],
    ["discovery mix", discovery.error],
    ["cities", cities.error],
  ]
    .filter(([, e]) => e)
    .map(([name, e]) => `${name}: ${(e as { message: string }).message}`);

  return {
    overview: (overview.data as Overview) ?? null,
    daily: (daily.data as DailyRow[]) ?? [],
    northStar: (northStar.data as NorthStarRow[]) ?? [],
    activation: (activation.data as ActivationRow[]) ?? [],
    retention: (retention.data as RetentionRow[]) ?? [],
    socialSplit: (socialSplit.data as SocialSplitRow[]) ?? [],
    discovery: (discovery.data as DiscoveryRow[]) ?? [],
    cities: (cities.data as CityRow[]) ?? [],
    errors,
  };
}
