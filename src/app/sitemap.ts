import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { CANONICAL_HOST } from "./robots";
import { toSlug } from "@/lib/playlistUrl";

const BASE = `https://${CANONICAL_HOST}`;

// Public profiles and playlists. The marketing zone's pages live in its own
// sitemap, served at /marketing-sitemap.xml; robots.txt lists both.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  // Accounts pending deletion keep their username reserved but shouldn't be
  // advertised to crawlers.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username, updated_at")
    .is("deleted_at", null)
    .not("username", "is", null);

  const { data: playlists } = await supabase
    .from("playlists")
    .select("name, slug, updated_at, profiles!inner(username, deleted_at), cities!playlists_city_id_fkey(display_name)")
    .eq("is_public", true)
    .is("profiles.deleted_at", null);

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    ...(profiles ?? []).map((p: any) => ({
      url: `${BASE}/${p.username}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...(playlists ?? [])
      .filter((p: any) => p.profiles?.username && p.cities?.display_name)
      .map((p: any) => ({
        url: `${BASE}/${p.profiles.username}/${toSlug(p.cities.display_name)}/${p.slug ?? toSlug(p.name)}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
  ];
}
