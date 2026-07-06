import { createClient } from "../supabase/client";
import { track } from "../analytics";
import { getDefaultCover } from "../playlist-covers";
import { formatCityDisplay } from "../cityDisplay";
import { toSlug } from "../playlistUrl";
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
    .select("*, profiles(username, avatar_url), cities!playlists_city_id_fkey(display_name, is_primary)")
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
    cities: undefined,
    profiles: undefined,
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

export async function getTodaysPick(): Promise<TodaysPick | null> {
  const supabase = createClient();

  const { data: psData } = await supabase
    .from("playlist_spots")
    .select(
      "spot_id, playlists!inner(name, city, city_id, is_public, profiles!playlists_user_id_fkey(username), cities!playlists_city_id_fkey(display_name, is_primary))"
    )
    .eq("playlists.is_public", true)
    .limit(50);

  if (!psData || psData.length === 0) return null;

  const spotIds = [...new Set(psData.map((r: any) => r.spot_id))];
  const { data: spots } = await supabase
    .from("spots")
    .select("*")
    .in("id", spotIds)
    .not("photo_url", "is", null);

  if (!spots || spots.length === 0) return null;

  // Deterministic daily pick using date as seed
  const seed = new Date()
    .toISOString()
    .slice(0, 10)
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const pick = spots[seed % spots.length] as Spot;

  // Find the playlist info for this spot
  const entry = psData.find((r: any) => r.spot_id === pick.id);
  const playlist = (entry as any)?.playlists;

  return {
    spot: pick,
    playlist_name: playlist?.name ?? "",
    playlist_city: playlist?.cities?.display_name
      ? formatCityDisplay(playlist.cities.display_name, playlist.cities.is_primary)
      : (playlist?.city ?? ""),
    username: playlist?.profiles?.username ?? "",
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
      const diff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
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
  const { data, error } = await supabase
    .from("spots")
    .upsert(spot, { onConflict: "google_place_id" })
    .select("id, google_place_id, name, address")
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

  // Remove old file from storage if it was a user upload (not a local default)
  if (currentUrl && currentUrl.startsWith("http")) {
    const storagePath = currentUrl.split("/playlist-covers/")[1];
    if (storagePath) {
      await supabase.storage.from("playlist-covers").remove([storagePath]);
    }
  }

  const fileExt = file.name.split(".").pop();
  // Path format: {userId}/{playlistId}-{timestamp}.{ext}
  // Putting userId first lets the storage policy check ownership without a table lookup
  const fileName = `${userId}/${playlistId}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("playlist-covers")
    .upload(fileName, file);
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("playlist-covers").getPublicUrl(fileName);

  await supabase
    .from("playlists")
    .update({ cover_photo_url: publicUrl })
    .eq("id", playlistId);

  return publicUrl;
}