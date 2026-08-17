import type { Spot } from "@/types";

/**
 * Build a Google Maps link for a spot.
 *
 * Uses the official Maps URLs API (`api=1`), which is the only format that
 * resolves consistently everywhere. The older `/maps/place/?q=place_id:...`
 * form works on desktop web but the mobile Google Maps app doesn't handle it,
 * so tapping a link on a phone opens an empty map.
 *
 * `query` is required by the API and is what the app falls back to when the
 * place id can't be resolved, so we always send the name/address too.
 */
export function mapsUrl(
  spot: Pick<Spot, "google_place_id" | "name" | "address">,
): string {
  const query = [spot.name, spot.address].filter(Boolean).join(" ");
  const params = new URLSearchParams({ api: "1", query });
  if (spot.google_place_id) params.set("query_place_id", spot.google_place_id);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
