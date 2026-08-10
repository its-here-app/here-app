import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPlaylistByUsernameAndName } from "@/lib/queries/playlists";
import PlaylistOverlay from "./PlaylistOverlay";
import { playlistDocTitle } from "@/lib/playlistDocTitle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; city: string; slug: string }>;
}): Promise<Metadata> {
  const { username, city, slug } = await params;
  const playlist = await getPlaylistByUsernameAndName(username, slug, city);
  if (!playlist) return {};
  const title = playlistDocTitle(playlist.city, playlist.name, playlist.profiles?.username);
  const image = playlist.cover_photo_url ?? "/og.png";
  return {
    title,
    openGraph: { images: [{ url: image }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function PlaylistPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; city: string; slug: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ username, city, slug }, { from }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const [playlist, { data: { user } }] = await Promise.all([
    getPlaylistByUsernameAndName(username, slug, city),
    supabase.auth.getUser(),
  ]);

  if (!playlist) notFound();

  const isOwner = user?.id === playlist.user_id;

  if (!playlist.is_public && !isOwner) notFound();

  return (
    <PlaylistOverlay playlist={playlist} isOwner={isOwner} fromNew={from === "new"} />
  );
}
