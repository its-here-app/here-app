import { createClient } from "../supabase/client";
import { track } from "../analytics";
import { getDefaultCover } from "../playlist-covers";
import { formatCityDisplay } from "../cityDisplay";
import { resolveCityIdFromAddress } from "./cities";
import { toSlug } from "../playlistUrl";
import { createImageDerivatives } from "../imageResize";
import type { SearchResult, TodaysPick, Spot } from "@/types";

export async function getRecentFollowingPlaylists(
  userId: string
): Promise<(import("@/types").Playlist & { username: string; avatar_url: string | null })[]> {
  const supabase = createClient();
  const { data: followData } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  const followingIds = (followData ?? []).map((f: any) => f.following_id);
  if (!followingIds.length) return [];
  const { data, error } = await supabase
    .from("playlists")
    .select("*, profiles(username, avatar_url), cities!playlists_city_id_fkey(display_name, is_primary), playlist_spots(count)")
    .in("user_id", followingIds)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(9);
  if (error) return [];
  return data.map((p: any) => ({
    ...p,
    city: p.cities?.display_name
      ? formatCityDisplay(p.cities.display_name, p.cities.is_primary)
      : p.city,
    username: p.profiles?.username ?? "",
    avatar_url: p.profiles?.avatar_url ?? null,
    spot_count: p.playlist_spots?.[0]?.count ?? 0,
    cities: undefined,
    profiles: undefined,
    playlist_spots: undefined,
  }));
}

/**
 * Discovery feed of public playlists from people the user doesn't follow yet.
 *
 * When `cityId` is provided, the pool is strictly limited to public playlists
 * in that city — playlists authored by the user's 2nd-degree network (people
 * followed by people they follow) are ranked first as a tiebreak, but nothing
 * outside the city is ever included, and no cross-city filler is used.
 *
 * When `cityId` is omitted, falls back to the legacy behavior: pulled from
 * the user's own profile city, cities they already have playlists in, and
 * their 2nd-degree network, backfilling with random public playlists if the
 * pool is short of 8.
 */
export async function getExplorePlaylists(
  userId: string,
  cityId?: string | null
): Promise<(import("@/types").Playlist & { username: string; avatar_url: string | null })[]> {
  const supabase = createClient();

  const { data: myFollowing } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  const followingIds = (myFollowing ?? []).map((f: any) => f.following_id);
  const excludeIds = new Set([userId, ...followingIds]);

  let cityIds: string[];
  if (cityId) {
    cityIds = [cityId];
  } else {
    const [{ data: profile }, { data: ownPlaylists }] = await Promise.all([
      supabase.from("profiles").select("city_id").eq("id", userId).single(),
      supabase.from("playlists").select("city_id").eq("user_id", userId),
    ]);
    cityIds = [
      ...new Set(
        [profile?.city_id, ...(ownPlaylists ?? []).map((p: any) => p.city_id)].filter(Boolean)
      ),
    ];
  }

  let mutualAuthorIds: string[] = [];
  if (followingIds.length) {
    const { data: theirFollowing } = await supabase
      .from("follows")
      .select("following_id")
      .in("follower_id", followingIds);
    mutualAuthorIds = [
      ...new Set(
        (theirFollowing ?? [])
          .map((f: any) => f.following_id)
          .filter((id: string) => !excludeIds.has(id))
      ),
    ];
  }

  const selectClause =
    "*, profiles(username, avatar_url), cities!playlists_city_id_fkey(display_name, is_primary), playlist_spots(count)";

  const [cityResult, mutualResult] = await Promise.all([
    cityIds.length
      ? supabase
          .from("playlists")
          .select(selectClause)
          .in("city_id", cityIds)
          .eq("is_public", true)
          .limit(30)
      : Promise.resolve({ data: [] as any[] }),
    mutualAuthorIds.length
      ? (() => {
          let q = supabase
            .from("playlists")
            .select(selectClause)
            .in("user_id", mutualAuthorIds)
            .eq("is_public", true)
            .limit(30);
          if (cityId) q = q.eq("city_id", cityId);
          return q;
        })()
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const pool = new Map<string, any>();
  for (const p of [...(cityResult.data ?? []), ...(mutualResult.data ?? [])]) {
    if (excludeIds.has(p.user_id)) continue;
    pool.set(p.id, p);
  }

  // Backfill with playlists from anyone else if the targeted pool is short of
  // 8 — but only when we're not strictly city-scoped, since cross-city filler
  // would defeat the point of filtering by city.
  if (!cityId && pool.size < 8) {
    const { data: fillerPlaylists } = await supabase
      .from("playlists")
      .select(selectClause)
      .eq("is_public", true)
      .limit(60);
    for (const p of fillerPlaylists ?? []) {
      if (excludeIds.has(p.user_id) || pool.has(p.id)) continue;
      pool.set(p.id, p);
    }
  }

  const inNetwork = new Set((mutualResult.data ?? []).map((p: any) => p.id));
  const shuffled = [...pool.values()].sort((a, b) => {
    const netDiff = (inNetwork.has(a.id) ? 0 : 1) - (inNetwork.has(b.id) ? 0 : 1);
    return netDiff !== 0 ? netDiff : Math.random() - 0.5;
  });
  return shuffled.slice(0, 8).map((p: any) => ({
    ...p,
    city: p.cities?.display_name
      ? formatCityDisplay(p.cities.display_name, p.cities.is_primary)
      : p.city,
    username: p.profiles?.username ?? "",
    avatar_url: p.profiles?.avatar_url ?? null,
    spot_count: p.playlist_spots?.[0]?.count ?? 0,
    cities: undefined,
    profiles: undefined,
    playlist_spots: undefined,
  }));
}

export async function getPlaylistsByUser(userId: string): Promise<import("@/types").Playlist[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("playlists")
    .select("*, playlist_spots(count), cities!playlists_city_id_fkey(display_name, is_primary)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data.map((p: any) => ({
    ...p,
    city: p.cities?.display_name
      ? formatCityDisplay(p.cities.display_name, p.cities.is_primary)
      : p.city,
    cities: undefined,
    spot_count: p.playlist_spots?.[0]?.count ?? 0,
    playlist_spots: undefined,
  }));
}

/**
 * Today's featured spot — pulled directly from `spots` (any seeded spot with
 * a photo), not gated on being in a public playlist. Excludes spots the
 * user already has a relationship with (saved directly, or added to one of
 * their own playlists), so it doesn't recommend something they already know.
 */
export async function getTodaysPick(
  userId?: string | null,
  cityId?: string | null
): Promise<TodaysPick | null> {
  const supabase = createClient();

  const excludeIds = new Set<string>();
  if (userId) {
    const [{ data: saved }, { data: mine }] = await Promise.all([
      supabase.from("saved_spots").select("spot_id").eq("user_id", userId),
      supabase
        .from("playlist_spots")
        .select("spot_id, playlists!inner(user_id)")
        .eq("playlists.user_id", userId),
    ]);
    for (const r of saved ?? []) excludeIds.add(r.spot_id);
    for (const r of (mine ?? []) as any[]) excludeIds.add(r.spot_id);
  }

  let query = supabase
    .from("spots")
    .select("*, cities!spots_city_id_fkey(display_name, is_primary)")
    .not("photo_url", "is", null)
    .limit(200);
  if (cityId) query = query.eq("city_id", cityId);
  const { data: spots } = await query;

  if (!spots || spots.length === 0) return null;

  const candidates = (spots as any[]).filter((s) => !excludeIds.has(s.id));
  if (candidates.length === 0) return null;

  // Deterministic daily pick using date as seed
  const seed = new Date()
    .toISOString()
    .slice(0, 10)
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const pick = candidates[seed % candidates.length];

  const { data: mentionRows } = await supabase
    .from("playlist_spots")
    .select(
      "playlists!inner(name, slug, city, city_id, user_id, is_public, profiles!playlists_user_id_fkey(username, avatar_url), cities!playlists_city_id_fkey(display_name, is_primary))"
    )
    .eq("spot_id", pick.id)
    .eq("playlists.is_public", true);

  const mentioners = new Map<
    string,
    { username: string; avatarUrl: string | null; playlistName: string; slug: string; city: string }
  >();
  for (const row of (mentionRows ?? []) as any[]) {
    const p = row.playlists;
    const username = p?.profiles?.username;
    const avatarUrl = p?.profiles?.avatar_url ?? null;
    const playlistName = p?.name;
    const slug = p?.slug;
    const city = p?.cities?.display_name
      ? formatCityDisplay(p.cities.display_name, p.cities.is_primary)
      : p?.city;
    const mentionUserId = p?.user_id;
    if (mentionUserId && username && playlistName && slug && city) {
      mentioners.set(mentionUserId, { username, avatarUrl, playlistName, slug, city });
    }
  }
  const mentionList = [...mentioners.values()];

  return {
    spot: { ...pick, cities: undefined } as Spot,
    mentionedBy:
      mentionList.length > 0
        ? {
            playlistName: mentionList[0].playlistName,
            username: mentionList[0].username,
            avatarUrl: mentionList[0].avatarUrl,
            slug: mentionList[0].slug,
            city: mentionList[0].city,
            count: mentionList.length,
          }
        : null,
    city: pick.cities?.display_name
      ? formatCityDisplay(pick.cities.display_name, pick.cities.is_primary)
      : "",
  };
}

/**
 * Spots already saved into (public) playlists for a city, ranked by how many
 * playlists include them, then alphabetically for ties. "Saved" here means
 * "added to a playlist" — spots have no direct city column of their own, so
 * city association only exists via playlist_spots -> playlists.city_id.
 */
export async function getPopularSpotsForCity(
  cityId: string,
  limit: number,
): Promise<SearchResult[]> {
  const supabase = createClient();
  const { data: psData, error } = await supabase
    .from("playlist_spots")
    .select("spot_id, playlists!inner(city_id, is_public)")
    .eq("playlists.city_id", cityId)
    .eq("playlists.is_public", true);

  if (error || !psData || psData.length === 0) return [];

  const counts = new Map<string, number>();
  for (const row of psData as { spot_id: string }[]) {
    counts.set(row.spot_id, (counts.get(row.spot_id) ?? 0) + 1);
  }

  const { data: spots } = await supabase
    .from("spots")
    .select("*")
    .in("id", [...counts.keys()]);

  if (!spots) return [];

  return (spots as Spot[])
    .sort((a, b) => {
      const countDiff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
      if (countDiff !== 0) return countDiff;
      const ratingDiff = (b.rating ?? -1) - (a.rating ?? -1);
      if (ratingDiff !== 0) return ratingDiff;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map((spot) => ({
      spot_id: spot.google_place_id,
      name: spot.name,
      address: spot.address,
      photo_url: spot.photo_url,
      rating: spot.rating,
      types: spot.types,
    }));
}

export async function searchSpots(
  query: string,
  city?: string
): Promise<SearchResult[]> {
  const q = city ? `${query}, ${city}` : query;
  const response = await fetch(
    `/api/spots/search?query=${encodeURIComponent(q)}`
  );
  if (!response.ok) throw new Error("Failed to search spots");
  const data = await response.json();
  return data.places ?? [];
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function nameOverlapScore(query: string, name: string): number {
  const queryWords = normalize(query).split(/\s+/).filter((w) => w.length > 1);
  const nameWords = normalize(name).split(/\s+/).filter((w) => w.length > 1);
  if (queryWords.length === 0) return 1;

  let matches = 0;
  for (const qw of queryWords) {
    if (nameWords.some((nw) => nw === qw || nw.startsWith(qw) || qw.startsWith(nw))) {
      matches++;
    }
  }
  return matches / queryWords.length;
}

function isGoodMatch(query: string, name: string, address: string, city: string): boolean {
  const score = nameOverlapScore(query, name);
  // Accept if at least one query word matches the result name
  return score > 0;
}

export async function resolveSpot(
  name: string,
  city: string
): Promise<SearchResult | null> {
  const results = await searchSpots(name, city);

  if (results.length === 0) {
    console.warn(`[resolveSpot] "${name}" in "${city}" — Google returned 0 results`);
    return null;
  }

  const match = results.find((r) => isGoodMatch(name, r.name, r.address, city));

  if (!match) {
    console.warn(
      `[resolveSpot] "${name}" in "${city}" — ${results.length} results, none passed isGoodMatch:`,
      results.slice(0, 3).map((r) => ({ name: r.name, address: r.address }))
    );
  }

  return match ?? null;
}

// Returns a slug unique to this user, appending -2, -3, etc. if needed.
export async function resolveUniqueSlug(userId: string, name: string): Promise<string> {
  const baseSlug = toSlug(name);
  const supabase = createClient();
  const { data } = await supabase
    .from("playlists")
    .select("slug")
    .eq("user_id", userId)
    .like("slug", `${baseSlug}%`);

  const existing = new Set((data ?? []).map((p: any) => p.slug));
  if (!existing.has(baseSlug)) return baseSlug;

  let n = 2;
  while (existing.has(`${baseSlug}-${n}`)) n++;
  return `${baseSlug}-${n}`;
}

export async function upsertSpot(spot: {
  google_place_id: string;
  name: string;
  address: string;
  photo_url?: string | null;
  rating?: number | null;
  types?: string[] | null;
}) {
  const supabase = createClient();
  const city_id = await resolveCityIdFromAddress(spot.address);
  const { data, error } = await supabase
    .from("spots")
    .upsert({ ...spot, ...(city_id ? { city_id } : {}) }, { onConflict: "google_place_id" })
    .select("id, google_place_id, name, address, photo_url, rating, types, city_id")
    .single();
  if (error) throw error;
  return data;
}

export async function addSpotToPlaylist(
  playlistId: string,
  spotId: string,
  position: number,
  userId: string
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("playlist_spots")
    .insert({ playlist_id: playlistId, spot_id: spotId, position })
    .select("id, notes, position")
    .single();
  if (error) throw error;
  track(userId, "spot.added_to_playlist", { playlist_id: playlistId, spot_id: spotId });
  return data;
}

export async function removeSpotFromPlaylist(playlistSpotId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("playlist_spots")
    .delete()
    .eq("id", playlistSpotId);
  if (error) throw error;
}

export async function reorderPlaylistSpots(
  reordered: { id: string; position: number }[]
) {
  const supabase = createClient();
  await Promise.all(
    reordered.map(({ id, position }) =>
      supabase.from("playlist_spots").update({ position }).eq("id", id)
    )
  );
}

export async function createPlaylist(params: {
  user_id: string;
  name: string;
  city: string;
  slug: string;
  description: string;
  is_public: boolean;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("playlists")
    .insert({ ...params, cover_photo_url: getDefaultCover(params.city, params.name) })
    .select()
    .single();
  if (error) throw error;
  track(params.user_id, "playlist.created", {
    playlist_id: data.id,
    city: params.city,
    is_public: params.is_public,
  });
  return data;
}

export async function touchPlaylist(playlistId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("playlists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", playlistId);
  if (error) throw error;
}

export async function updatePlaylistName(
  playlistId: string,
  name: string
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("playlists")
    .update({ name })
    .eq("id", playlistId);
  if (error) throw error;
}

export async function updatePlaylistDescription(
  playlistId: string,
  description: string
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("playlists")
    .update({ description })
    .eq("id", playlistId);
  if (error) throw error;
}

export async function updatePlaylistVisibility(
  playlistId: string,
  isPublic: boolean
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("playlists")
    .update({ is_public: isPublic })
    .eq("id", playlistId);
  if (error) throw error;
}

export async function updateSpotNotes(playlistSpotId: string, notes: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("playlist_spots")
    .update({ notes })
    .eq("id", playlistSpotId);
  if (error) throw error;
}

export async function uploadPlaylistCover(
  playlistId: string,
  userId: string,
  file: File,
  currentUrl?: string | null
): Promise<string> {
  const supabase = createClient();

  // Remove old files from storage if they were a user upload (not a local default).
  // Best-effort: also try the sibling -thumb file from the current naming scheme;
  // an orphaned -original from a previous upload is a small, acceptable storage cost.
  if (currentUrl && currentUrl.startsWith("http")) {
    const storagePath = currentUrl.split("/playlist-covers/")[1];
    if (storagePath) {
      const thumbPath = storagePath.replace(/-full\.([a-z0-9]+)$/i, "-thumb.$1");
      const pathsToRemove =
        thumbPath !== storagePath ? [storagePath, thumbPath] : [storagePath];
      await supabase.storage.from("playlist-covers").remove(pathsToRemove);
    }
  }

  const derivatives = await createImageDerivatives(file);
  const originalExt = file.name.split(".").pop() || "jpg";
  // Path format: {userId}/{playlistId}-{timestamp}-{variant}.{ext}
  // Putting userId first lets the storage policy check ownership without a table lookup
  const base = `${userId}/${playlistId}-${Date.now()}`;
  const originalName = `${base}-original.${originalExt}`;
  const fullName = `${base}-full.${derivatives.ext}`;
  const thumbName = `${base}-thumb.${derivatives.ext}`;

  const [originalUpload, fullUpload, thumbUpload] = await Promise.all([
    supabase.storage.from("playlist-covers").upload(originalName, derivatives.original),
    supabase.storage.from("playlist-covers").upload(fullName, derivatives.full),
    supabase.storage.from("playlist-covers").upload(thumbName, derivatives.thumb),
  ]);
  if (originalUpload.error) throw originalUpload.error;
  if (fullUpload.error) throw fullUpload.error;
  if (thumbUpload.error) throw thumbUpload.error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("playlist-covers").getPublicUrl(fullName);

  await supabase
    .from("playlists")
    .update({ cover_photo_url: publicUrl })
    .eq("id", playlistId);

  return publicUrl;
}