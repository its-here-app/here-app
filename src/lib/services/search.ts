import { createClient } from "../supabase/client";
import { formatCityDisplay } from "../cityDisplay";
import type { Profile, Playlist } from "@/types";

export interface SearchResultPerson extends Profile {
  mutualCount: number;
}

export interface SearchResultPlaylist extends Playlist {
  username: string;
  avatar_url: string | null;
}

export async function searchPeople(
  query: string,
  currentUserId?: string,
): Promise<SearchResultPerson[]> {
  const supabase = createClient();
  const pattern = `%${query}%`;

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .or(`full_name.ilike.${pattern},username.ilike.${pattern}`)
    .limit(10);

  if (error || !profiles) return [];

  // Filter out incomplete profiles (no username = unfinished signup)
  const validProfiles = profiles.filter((p: Profile) => p.username);

  if (!currentUserId) {
    return sortPeopleResults(
      validProfiles.map((p: Profile) => ({ ...p, mutualCount: 0 })),
      query,
    );
  }

  // Filter out the current user
  const filtered = validProfiles.filter((p: Profile) => p.id !== currentUserId);

  // Get who the current user follows
  const { data: myFollowing } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", currentUserId);
  const followingIds = new Set(
    (myFollowing ?? []).map((r: { following_id: string }) => r.following_id),
  );

  // Get who each person follows, to count mutuals
  const ids = filtered.map((p: Profile) => p.id);
  if (ids.length === 0) return [];

  const { data: theirFollows } = await supabase
    .from("follows")
    .select("follower_id, following_id")
    .in("follower_id", ids);

  const mutualCounts = new Map<string, number>();
  for (const row of theirFollows ?? []) {
    if (followingIds.has(row.following_id)) {
      mutualCounts.set(
        row.follower_id,
        (mutualCounts.get(row.follower_id) ?? 0) + 1,
      );
    }
  }

  const results = filtered.map((p: Profile) => ({
    ...p,
    mutualCount: mutualCounts.get(p.id) ?? 0,
  }));

  return sortPeopleResults(results, query);
}

export async function searchPlaylists(
  query: string,
  currentUserId?: string,
): Promise<SearchResultPlaylist[]> {
  const supabase = createClient();
  const pattern = `%${query}%`;

  // Search public playlists + user's own playlists
  // City matches first, then name matches
  let baseQuery = supabase
    .from("playlists")
    .select("*, profiles!playlists_user_id_fkey(username, avatar_url), cities!playlists_city_id_fkey(display_name, is_primary)")
    .ilike("city", pattern)
    .order("created_at", { ascending: false })
    .limit(10);

  if (currentUserId) {
    baseQuery = baseQuery.or(`is_public.eq.true,user_id.eq.${currentUserId}`);
  } else {
    baseQuery = baseQuery.eq("is_public", true);
  }

  let nameQuery = supabase
    .from("playlists")
    .select("*, profiles!playlists_user_id_fkey(username, avatar_url), cities!playlists_city_id_fkey(display_name, is_primary)")
    .ilike("name", pattern)
    .order("created_at", { ascending: false })
    .limit(10);

  if (currentUserId) {
    nameQuery = nameQuery.or(`is_public.eq.true,user_id.eq.${currentUserId}`);
  } else {
    nameQuery = nameQuery.eq("is_public", true);
  }

  const [cityRes, nameRes] = await Promise.all([baseQuery, nameQuery]);

  const cityPlaylists = sortByRelevance(
    (cityRes.data ?? []).map(formatPlaylist),
    query,
    "city",
  );
  const namePlaylists = sortByRelevance(
    (nameRes.data ?? []).map(formatPlaylist),
    query,
    "name",
  );

  // Deduplicate: city matches first, then name matches
  const seen = new Set<string>();
  const results: SearchResultPlaylist[] = [];

  for (const p of [...cityPlaylists, ...namePlaylists]) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      results.push(p);
    }
  }

  return results;
}

// Prefers matches where the field starts with the query over matches where
// the query merely appears mid-string (e.g. "n" -> "New York" before "San Diego").
function sortByRelevance(
  playlists: SearchResultPlaylist[],
  query: string,
  field: "city" | "name",
): SearchResultPlaylist[] {
  const q = query.toLowerCase();
  return [...playlists].sort((a, b) => {
    const aStarts = (a[field] ?? "").toLowerCase().startsWith(q);
    const bStarts = (b[field] ?? "").toLowerCase().startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return 0;
  });
}

function formatPlaylist(p: any): SearchResultPlaylist {
  const profile = p.profiles;
  return {
    ...p,
    city: p.cities?.display_name
      ? formatCityDisplay(p.cities.display_name, p.cities.is_primary)
      : p.city,
    username: profile?.username ?? "",
    avatar_url: profile?.avatar_url ?? null,
    cities: undefined,
    profiles: undefined,
  };
}

function sortPeopleResults(
  results: SearchResultPerson[],
  query: string,
): SearchResultPerson[] {
  const q = query.toLowerCase();
  return results.sort((a, b) => {
    const aName = (a.full_name ?? "").toLowerCase();
    const aUser = (a.username ?? "").toLowerCase();
    const bName = (b.full_name ?? "").toLowerCase();
    const bUser = (b.username ?? "").toLowerCase();

    // Prioritize: starts with query in name or username
    const aStarts =
      aName.startsWith(q) ||
      aName.split(" ").some((w) => w.startsWith(q)) ||
      aUser.startsWith(q);
    const bStarts =
      bName.startsWith(q) ||
      bName.split(" ").some((w) => w.startsWith(q)) ||
      bUser.startsWith(q);

    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    // Then sort by mutual count descending
    return b.mutualCount - a.mutualCount;
  });
}
