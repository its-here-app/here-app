import { normalizeForMatch } from "./cityResolution";

export type AutocompleteTerm = { value: string };
export type AutocompletePrediction = {
  place_id?: string;
  description?: string;
  terms?: AutocompleteTerm[];
};

export type CitySuggestion = {
  google_place_id: string | undefined;
  display_name: string;
  is_primary: boolean;
};

/**
 * Turn Places autocomplete predictions into city suggestions: the canonical
 * `display_name` stored in `cities` plus the `is_primary` flag. Shared by the
 * autocomplete route and the city backfill script so both name cities the
 * same way.
 *
 * `query` is the normalized text the user typed (lowercased, trimmed).
 */
export function buildCitySuggestions(
  predictions: AutocompletePrediction[],
  query: string,
): CitySuggestion[] {
  // Determine is_primary for each prediction. Google returns results ranked
  // by popularity, so the first occurrence of a base name is the most well-known city.

  // First pass: find which base names (first term) appear more than once
  // *within the same country*. Scoping by country too (not just base name)
  // means "Brayton, UK" and "Brayton, Australia" each get to be primary
  // independently instead of competing — a same-named town on the other
  // side of the world shouldn't force a qualified "Brayton, NSW, Australia"
  // display. Real same-country collisions (e.g. "Portland, OR" vs
  // "Portland, ME", or "Woodside, SA" vs "Woodside, VIC" in Australia)
  // still disambiguate correctly since they share both base name and country.
  // Normalize diacritics so "Los Angeles" and "Los Ángeles" are treated as the same base.
  const baseNameFirstSeen = new Map<string, number>();
  const baseNameDupes = new Set<string>();
  for (let i = 0; i < predictions.length; i++) {
    const terms = predictions[i].terms ?? [];
    const base = normalizeForMatch(terms[0]?.value ?? "");
    const country = normalizeForMatch(terms[terms.length - 1]?.value ?? "");
    const key = `${base}|${country}`;
    if (baseNameFirstSeen.has(key)) {
      baseNameDupes.add(key);
    } else {
      baseNameFirstSeen.set(key, i);
    }
  }

  // Second pass: build each city's full canonical name and is_primary flag.
  //  - `display_name`: always the full qualified name for storage.
  //    UI display shortening is handled at render time via `formatCityDisplay(name, is_primary)`.
  //  - `is_primary`: determines whether to show the short base name in the UI.
  return predictions.map((p, i) => {
    const terms = p.terms ?? [];
    const baseName = terms[0]?.value ?? p.description ?? "";
    const baseKey = normalizeForMatch(baseName);
    const countryKey = normalizeForMatch(terms[terms.length - 1]?.value ?? "");
    const dedupeKey = `${baseKey}|${countryKey}`;
    const isUS = terms[terms.length - 1]?.value === "USA";

    // Full canonical name: built from Google's `terms` (already split into
    // city / region / country) rather than the raw `description` field.
    // `description` smashes some locales' city+region together with no
    // separator (e.g. Australia: "Sydney NSW, Australia" instead of
    // "Sydney, NSW, Australia"), while `terms` stays cleanly split for
    // every locale — joining it reproduces `description` exactly
    // everywhere else, and additionally fixes Australia/similar cases.
    // US cities drop the trailing "USA" term (stored as bare "City, ST").
    const display_name = isUS
      ? terms.slice(0, -1).map((t) => t.value).join(", ")
      : terms.length > 0
        ? terms.map((t) => t.value).join(", ")
        : (p.description ?? baseName);

    // Primary = the most popular city for this base name *within its country*.
    // - If same-country duplicates exist in results, the first one wins (Google ranks by popularity).
    // - If unique within its country, only mark primary if the user's query is roughly
    //   just the city name (not qualified with a country/state like "los angeles chile").
    //   The +2 accounts for trailing spaces or 1-2 extra chars mid-typing.
    const queryIsGeneric = query.length <= baseKey.length + 2;
    const is_primary = baseNameDupes.has(dedupeKey)
      ? baseNameFirstSeen.get(dedupeKey) === i
      : queryIsGeneric;

    return { google_place_id: p.place_id, display_name, is_primary };
  });
}
