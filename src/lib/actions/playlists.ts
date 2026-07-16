"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getDefaultCover } from "@/lib/playlist-covers";
import { toSlug } from "@/lib/playlistUrl";
import type { DraftSpot } from "@/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function resolveUniqueSlug(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<string> {
  const baseSlug = toSlug(name);
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

export async function createPlaylistAction(params: {
  name: string;
  city: string;
  city_id?: string;
  description: string;
  is_public: boolean;
  coverUrl?: string;
  spots: DraftSpot[];
}): Promise<{ id: string; slug: string; username: string; city: string; name: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();
  if (!profile?.username) throw new Error("Profile not found");

  const slug = await resolveUniqueSlug(supabase, user.id, params.name);

  const { data: playlist, error } = await supabase
    .from("playlists")
    .insert({
      user_id: user.id,
      name: params.name,
      city: params.city,
      city_id: params.city_id ?? null,
      slug,
      description: params.description,
      is_public: params.is_public,
      cover_photo_url: params.coverUrl ?? getDefaultCover(params.city, params.name),
    })
    .select()
    .single();
  if (error) throw error;

  for (let i = 0; i < params.spots.length; i++) {
    const spot = params.spots[i];
    const { data: upserted, error: spotErr } = await supabase
      .from("spots")
      .upsert(
        {
          google_place_id: spot.google_place_id,
          name: spot.name,
          address: spot.address,
          photo_url: spot.photo_url ?? null,
          rating: spot.rating ?? null,
          types: spot.types ?? null,
          ...(params.city_id ? { city_id: params.city_id } : {}),
        },
        { onConflict: "google_place_id" }
      )
      .select("id")
      .single();
    if (spotErr) throw spotErr;

    const { data: ps, error: psErr } = await supabase
      .from("playlist_spots")
      .insert({ playlist_id: playlist.id, spot_id: upserted.id, position: i })
      .select("id")
      .single();
    if (psErr) throw psErr;

    if (spot.notes) {
      await supabase
        .from("playlist_spots")
        .update({ notes: spot.notes })
        .eq("id", ps.id);
    }
  }

  revalidatePath(`/${profile.username}`);

  return {
    id: playlist.id,
    slug,
    username: profile.username,
    city: params.city,
    name: params.name,
  };
}

export async function revalidateProfileAction(username: string): Promise<void> {
  revalidatePath(`/${username}`);
}

export async function deletePlaylistAction(
  playlistId: string,
  username: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase
    .from("playlist_spots")
    .delete()
    .eq("playlist_id", playlistId);

  const { error } = await supabase
    .from("playlists")
    .delete()
    .eq("id", playlistId);
  if (error) throw error;

  revalidatePath(`/${username}`);
}
