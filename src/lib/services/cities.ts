import { createClient } from "../supabase/client";
import { parseAddressLocation, normalizeForMatch, canonicalizeCountry } from "../cityResolution";

/** Read-only lookup — does not create the city if it doesn't exist yet. */
export async function getCityIdByGooglePlaceId(
  googlePlaceId: string,
): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("cities")
    .select("id")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Resolve a `cities` row id from a spot's (Google-formatted) address.
 * Does not create the city if it doesn't exist yet.
 *
 * Matching always requires both a city AND a disambiguator (US state, or
 * country for everything else) — city name alone is not safe, since the
 * `cities` table has many same-name entries across different states/
 * countries (e.g. "Brooklyn, IA", "Brooklyn, OH", "Brooklyn, MI" all exist,
 * with no "Brooklyn, NY" at all). Matching is done client-side (fetches the
 * whole, modestly-sized `cities` table) rather than via `ilike`, since some
 * extracted city names contain diacritics that a raw prefix match on the
 * stored (unaccented) `display_name` would silently fail to find.
 */
export async function resolveCityIdFromAddress(address: string): Promise<string | null> {
  const parsed = parseAddressLocation(address);
  if (!parsed) return null;

  const supabase = createClient();
  const { data } = await supabase.from("cities").select("id, display_name");
  if (!data) return null;

  if (parsed.kind === "us") {
    const match = data.find((c: any) => {
      const segments = c.display_name.split(",").map((s: string) => s.trim());
      if (segments.length !== 2) return false;
      const [cityPart, statePart] = segments;
      return (
        normalizeForMatch(cityPart) === normalizeForMatch(parsed.city) &&
        statePart.toUpperCase() === parsed.state
      );
    });
    return match?.id ?? null;
  }

  const match = data.find((c: any) => {
    const segments = c.display_name.split(",").map((s: string) => s.trim());
    const cityPart = segments[0];
    const countryPart = segments[segments.length - 1];
    return (
      normalizeForMatch(cityPart) === normalizeForMatch(parsed.citySegment) &&
      canonicalizeCountry(countryPart) === parsed.country
    );
  });
  return match?.id ?? null;
}
