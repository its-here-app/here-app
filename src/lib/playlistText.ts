import { playlistUrl } from "./playlistUrl";
import type { PlaylistSpot } from "@/types";

const FILTERED_TYPES = new Set(["point_of_interest", "establishment"]);

interface PlaylistForText {
  name: string;
  city: string;
  slug: string;
  profiles: { username: string };
  playlist_spots: PlaylistSpot[];
}

export function playlistToText(playlist: PlaylistForText): string {
  const { name, city, profiles, playlist_spots } = playlist;
  const username = profiles.username;

  const sorted = [...playlist_spots].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );

  const lines = sorted.map((ps) => {
    const spot = ps.spots;
    const type = spot.types
      ?.filter((t) => !FILTERED_TYPES.has(t))
      .map((t) => t.replace(/_/g, " "))[0];

    const description = ps.notes ? `, ${ps.notes}` : "";
    const typeLabel = type ? ` (${type})` : "";
    return `* ${spot.name}${description}${typeLabel}`;
  });

  const url = `${typeof window !== "undefined" ? window.location.origin : ""}${playlistUrl(username, city, name, playlist.slug)}`;

  return [
    `${city} — ${name} @${username}`,
    ...lines,
    "",
    url,
  ].join("\n");
}
