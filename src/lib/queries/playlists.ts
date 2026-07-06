import { createClient } from "@/lib/supabase/server";
import { toSlug } from "@/lib/playlistUrl";
import { formatCityDisplay } from "@/lib/cityDisplay";
import type { Playlist, Spot } from "@/types";

export async function getPlaylistsByUser(
  userId: string,
  onlyPublic = false
): Promise<Playlist[]> {
  const supabase = await createClient();
  let query = supabase
    .from("playlists")
    .select("*, playlist_spots(count), cities!playlists_city_id_fkey(display_name, is_primary)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (onlyPublic) query = query.eq("is_public", true);
  const { data, error } = await query;
  if (error) return [];
  return data.map((p: any) => ({
    ...p,
    // Prefer the smart display name from the cities table over the
    // denormalized playlist.city string (which may be stale like "Los Angeles, CA").
    city: p.cities?.display_name
      ? formatCityDisplay(p.cities.display_name, p.cities.is_primary)
      : p.city,
    cities: undefined,
    spot_count: p.playlist_spots?.[0]?.count ?? 0,
    playlist_spots: undefined,
  }));
}

export async function getSpotsByUser(
  userId: string,
  onlyPublic = false
): Promise<Spot[]> {
  const supabase = await createClient();
  let query = supabase
    .from("playlists")
    .select("playlist_spots(spots(*))")
    .eq("user_id", userId);
  if (onlyPublic) query = query.eq("is_public", true);
  const { data, error } = await query;
  if (error || !data) return [];
  const seen = new Set<string>();
  const spots: Spot[] = [];
  for (const playlist of data) {
    for (const ps of (playlist as any).playlist_spots ?? []) {
      const spot = ps.spots;
      if (spot && !seen.has(spot.id)) {
        seen.add(spot.id);
        spots.push(spot);
      }
    }
  }
  return spots;
}

const PLAYLIST_SELECT = `
  *,
  cities!playlists_city_id_fkey (
    display_name,
    is_primary
  ),
  profiles!playlists_user_id_fkey (
    username,
    full_name,
    avatar_url
  ),
  playlist_spots (
    id,
    position,
    notes,
    created_at,
    spots (
      id,
      google_place_id,
      name,
      address,
      photo_url,
      rating,
      types
    )
  )
`;

export async function getPlaylistByUsernameAndName(
  username: string,
  nameSlug: string,
  citySlug?: string
) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .single();

  if (!profile) return null;

  const { data, error } = await supabase
    .from("playlists")
    .select(PLAYLIST_SELECT)
    .eq("user_id", profile.id);

  if (error || !data) return null;

  // Match by stored slug (unique per user, includes -2/-3 suffixes for duplicates)
  let match = data.find((p: any) => p.slug === nameSlug) ?? null;

  // Fall back to matching by derived slug from name (handles legacy playlists)
  if (!match) {
    const candidates = data.filter((p: any) => toSlug(p.name) === nameSlug);
    if (candidates.length === 1) {
      match = candidates[0];
    } else if (candidates.length > 1 && citySlug) {
      match = candidates.find((p: any) => {
        const raw = p.cities?.display_name ?? p.city ?? "";
        const formatted = p.cities?.display_name
          ? formatCityDisplay(raw, p.cities?.is_primary)
          : raw;
        return toSlug(formatted) === citySlug;
      }) ?? candidates[0];
    } else {
      match = candidates[0] ?? null;
    }
  }

  if (!match) return null;

  const m = match as any;
  if (m.cities?.display_name) {
    m.city = formatCityDisplay(m.cities.display_name, m.cities.is_primary);
  }
  return match;
}
