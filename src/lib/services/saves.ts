import { createClient } from "../supabase/client";
import { upsertSpot } from "./playlists";
import { track } from "../analytics";
import { formatCityDisplay } from "../cityDisplay";
import type { SpotMention, SpotMentionSaver } from "../spotMentions";
import type { Spot, SearchResult } from "@/types";

export async function getSavedSpots(userId: string): Promise<Spot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("saved_spots")
    .select("spots (*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row: any) => row.spots);
}

export async function saveSpot(
  userId: string,
  place: SearchResult
): Promise<Spot> {
  const spot = await upsertSpot({
    google_place_id: place.spot_id,
    name: place.name,
    address: place.address,
    photo_url: place.photo_url,
    rating: place.rating,
    types: place.types,
  });

  const supabase = createClient();
  const { error } = await supabase
    .from("saved_spots")
    .insert({ user_id: userId, spot_id: spot.id });
  if (error) throw error;

  track(userId, "spot.saved", { spot_id: spot.id, name: spot.name });
  return spot;
}

export async function unsaveSpot(
  userId: string,
  spotId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("saved_spots")
    .delete()
    .eq("user_id", userId)
    .eq("spot_id", spotId);
  if (error) throw error;
  track(userId, "spot.unsaved", { spot_id: spotId });
}

export interface SavedPlaylist {
  id: number;
  playlist_id: string;
  playlist: {
    id: string;
    name: string;
    city: string;
    slug: string;
    cover_photo_url: string | null;
    spot_count: number;
    profiles: { username: string; full_name: string };
  };
}

export async function getSavedPlaylists(userId: string): Promise<SavedPlaylist[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("saved_playlists")
    .select(`
      id,
      playlist_id,
      playlists!saved_playlists_playlist_id_fkey (
        id, name, city, city_id, slug, cover_photo_url,
        profiles!playlists_user_id_fkey (username, full_name),
        cities!playlists_city_id_fkey (display_name, is_primary),
        playlist_spots (id)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    playlist_id: row.playlist_id,
    playlist: {
      ...row.playlists,
      city: row.playlists.cities?.display_name
        ? formatCityDisplay(row.playlists.cities.display_name, row.playlists.cities.is_primary)
        : row.playlists.city,
      cities: undefined,
      spot_count: row.playlists.playlist_spots?.length ?? 0,
    },
  }));
}

export async function isPlaylistSaved(
  userId: string,
  playlistId: string
): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("saved_playlists")
    .select("id")
    .eq("user_id", userId)
    .eq("playlist_id", playlistId)
    .maybeSingle();
  return !!data;
}

export async function savePlaylist(
  userId: string,
  playlistId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("saved_playlists")
    .insert({ user_id: userId, playlist_id: playlistId });
  if (error) throw error;
  track(userId, "playlist.saved", { playlist_id: playlistId });
}

export async function unsavePlaylist(
  userId: string,
  playlistId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("saved_playlists")
    .delete()
    .eq("user_id", userId)
    .eq("playlist_id", playlistId);
  if (error) throw error;
  track(userId, "playlist.unsaved", { playlist_id: playlistId });
}

// ── Home page section queries ────────────────────────────────────────────────

export async function getTodaysMostSavedSpots(): Promise<
  { spot: Spot; save_count: number }[]
> {
  const supabase = createClient();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("saved_spots")
    .select("spot_id")
    .gte("created_at", today.toISOString());

  if (!data || data.length === 0) return [];

  // Group by spot_id and count
  const counts = new Map<string, number>();
  for (const row of data) {
    counts.set(row.spot_id, (counts.get(row.spot_id) ?? 0) + 1);
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const spotIds = sorted.map(([id]) => id);
  const { data: spots } = await supabase
    .from("spots")
    .select("*")
    .in("id", spotIds);

  if (!spots) return [];

  const spotMap = new Map(spots.map((s: Spot) => [s.id, s]));
  return sorted
    .map(([id, count]) => ({
      spot: spotMap.get(id)!,
      save_count: count,
    }))
    .filter((r) => r.spot);
}

export async function getWantedToGoSpots(
  userId: string
): Promise<{ spot: Spot; saved_at: string }[]> {
  const supabase = createClient();

  const [savedRes, playlistSpotsRes] = await Promise.all([
    supabase
      .from("saved_spots")
      .select("spot_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("playlist_spots")
      .select("spot_id, playlists!inner(user_id)")
      .eq("playlists.user_id", userId),
  ]);

  const saved = savedRes.data ?? [];
  const inPlaylists = new Set(
    (playlistSpotsRes.data ?? []).map((r: any) => r.spot_id)
  );

  const wanted = saved
    .filter((r: any) => !inPlaylists.has(r.spot_id))
    .slice(0, 5);

  if (wanted.length === 0) return [];

  const spotIds = wanted.map((r: any) => r.spot_id);
  const { data: spots } = await supabase
    .from("spots")
    .select("*")
    .in("id", spotIds);

  if (!spots) return [];

  const spotMap = new Map(spots.map((s: Spot) => [s.id, s]));
  return wanted
    .map((r: any) => ({
      spot: spotMap.get(r.spot_id)!,
      saved_at: r.created_at,
    }))
    .filter((r) => r.spot);
}

export async function getOldFavoriteSpots(
  userId: string
): Promise<{ spot: Spot; playlist_name: string }[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("playlist_spots")
    .select("spot_id, created_at, playlists!inner(user_id, name)")
    .eq("playlists.user_id", userId)
    .order("created_at", { ascending: true })
    .limit(30);

  if (!data || data.length === 0) return [];

  // Deduplicate by spot_id, keep earliest
  const seen = new Map<string, { spot_id: string; playlist_name: string }>();
  for (const row of data as any[]) {
    if (!seen.has(row.spot_id)) {
      seen.set(row.spot_id, {
        spot_id: row.spot_id,
        playlist_name: row.playlists?.name ?? "",
      });
    }
  }

  const entries = [...seen.values()].slice(0, 5);
  const spotIds = entries.map((e) => e.spot_id);
  const { data: spots } = await supabase
    .from("spots")
    .select("*")
    .in("id", spotIds);

  if (!spots) return [];

  const spotMap = new Map(spots.map((s: Spot) => [s.id, s]));
  return entries
    .map((e) => ({
      spot: spotMap.get(e.spot_id)!,
      playlist_name: e.playlist_name,
    }))
    .filter((r) => r.spot);
}

// A followed user counts as "having" a spot if they've bookmarked it directly
// (saved_spots) or added it to one of their public playlists (playlist_spots).
async function getSaversBySpot(
  supabase: ReturnType<typeof createClient>,
  followingIds: string[],
  spotIds: string[]
): Promise<Map<string, Set<string>>> {
  const [savesRes, playlistSpotsRes] = await Promise.all([
    supabase
      .from("saved_spots")
      .select("spot_id, user_id")
      .in("spot_id", spotIds)
      .in("user_id", followingIds),
    supabase
      .from("playlist_spots")
      .select("spot_id, playlists!inner(user_id, is_public)")
      .in("spot_id", spotIds)
      .in("playlists.user_id", followingIds)
      .eq("playlists.is_public", true),
  ]);

  const saversBySpot = new Map<string, Set<string>>();
  const addSaver = (spotId: string, saverId: string) => {
    const set = saversBySpot.get(spotId);
    if (set) set.add(saverId);
    else saversBySpot.set(spotId, new Set([saverId]));
  };

  for (const row of (savesRes.data ?? []) as { spot_id: string; user_id: string }[]) {
    addSaver(row.spot_id, row.user_id);
  }
  for (const row of (playlistSpotsRes.data ?? []) as any[]) {
    addSaver(row.spot_id, row.playlists.user_id);
  }

  return saversBySpot;
}

export async function getSpotMentionsFromFollowing(
  userId: string,
  spotId: string
): Promise<SpotMention> {
  const result = await getSpotMentionsForSpots(userId, [spotId]);
  return result.get(spotId) ?? { count: 0, savers: [] };
}

export async function getSpotMentionsForSpots(
  userId: string,
  spotIds: string[]
): Promise<Map<string, SpotMention>> {
  const empty = new Map<string, SpotMention>();
  if (spotIds.length === 0) return empty;

  const supabase = createClient();

  const { data: followData } = await supabase
    .from("follows")
    .select("following_id, created_at")
    .eq("follower_id", userId);

  if (!followData || followData.length === 0) return empty;

  const followedAt = new Map<string, string>(
    followData.map((f: any) => [f.following_id, f.created_at])
  );
  const followingIds = [...followedAt.keys()];

  const saversBySpot = await getSaversBySpot(supabase, followingIds, spotIds);
  if (saversBySpot.size === 0) return empty;

  const allSaverIds = [
    ...new Set([...saversBySpot.values()].flatMap((ids) => [...ids])),
  ];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", allSaverIds);

  const usernameById = new Map(
    (profiles ?? []).map((p: any) => [p.id, p.username as string])
  );

  const result = new Map<string, SpotMention>();
  for (const [spotId, saverIds] of saversBySpot) {
    const savers: SpotMentionSaver[] = [...saverIds]
      .map((id) => {
        const username = usernameById.get(id);
        return username
          ? { username, followedAt: followedAt.get(id) ?? "" }
          : null;
      })
      .filter((s): s is SpotMentionSaver => s !== null);

    result.set(spotId, { count: saverIds.size, savers });
  }
  return result;
}

export async function getRecommendedSpots(userId: string): Promise<Spot[]> {
  const supabase = createClient();

  // Step 1: Get followed user IDs
  const { data: followData } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  const followingIds = (followData ?? []).map((f: any) => f.following_id);
  if (followingIds.length === 0) return [];

  // Step 2: In parallel, get user's spots (to exclude) and followed users' spots
  const [savedRes, myPlaylistSpotsRes, theirSpotsRes] = await Promise.all([
    supabase.from("saved_spots").select("spot_id").eq("user_id", userId),
    supabase
      .from("playlist_spots")
      .select("spot_id, playlists!inner(user_id)")
      .eq("playlists.user_id", userId),
    supabase
      .from("playlist_spots")
      .select("spot_id, created_at, playlists!inner(user_id, is_public)")
      .in("playlists.user_id", followingIds)
      .eq("playlists.is_public", true)
      .limit(200),
  ]);

  // Build exclusion set
  const excluded = new Set<string>();
  for (const r of savedRes.data ?? []) excluded.add(r.spot_id);
  for (const r of (myPlaylistSpotsRes.data ?? []) as any[])
    excluded.add(r.spot_id);

  // Step 3: Score spots
  const spotScores = new Map<
    string,
    { users: Set<string>; latestDate: string }
  >();
  for (const row of (theirSpotsRes.data ?? []) as any[]) {
    if (excluded.has(row.spot_id)) continue;
    const existing = spotScores.get(row.spot_id);
    if (existing) {
      existing.users.add(row.playlists.user_id);
      if (row.created_at > existing.latestDate)
        existing.latestDate = row.created_at;
    } else {
      spotScores.set(row.spot_id, {
        users: new Set([row.playlists.user_id]),
        latestDate: row.created_at,
      });
    }
  }

  if (spotScores.size === 0) return [];

  const now = Date.now();
  const scored = [...spotScores.entries()]
    .map(([spotId, { users, latestDate }]) => {
      const daysSince =
        (now - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24);
      const score = users.size * 3 + Math.max(0, 10 - daysSince / 7);
      return { spotId, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const spotIds = scored.map((s) => s.spotId);
  const { data: spots } = await supabase
    .from("spots")
    .select("*")
    .in("id", spotIds);

  if (!spots) return [];

  // Preserve score ordering
  const spotMap = new Map(spots.map((s: Spot) => [s.id, s]));
  return scored.map((s) => spotMap.get(s.spotId)!).filter(Boolean);
}
