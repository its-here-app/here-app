import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Place Autocomplete proxy for city selection.
 *
 * Caching strategy:
 *  - Raw fetch() so Next's data cache applies. The @googlemaps SDK uses
 *    axios and bypasses this.
 *  - Queries are normalized so equivalent prefixes share a cache entry.
 *  - City lists change extremely slowly, so we cache aggressively (7 days).
 *  - Client-side this route is already debounced at 300ms.
 */

const AUTOCOMPLETE_URL =
  "https://maps.googleapis.com/maps/api/place/autocomplete/json";

// Cache autocomplete prefixes for 7 days. City lists are effectively static.
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

type AutocompleteTerm = { value: string };
type AutocompletePrediction = {
  place_id?: string;
  description?: string;
  terms?: AutocompleteTerm[];
};
type AutocompleteResponse = {
  predictions?: AutocompletePrediction[];
  status?: string;
};

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

async function fallbackToDb(query: string) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
    );
    const { data } = await supabase
      .from("cities")
      .select("google_place_id, display_name, is_primary")
      .ilike("display_name", `%${escapeLike(query)}%`)
      .limit(5);

    return NextResponse.json(
      { cities: data ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { cities: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Strip diacritics + lowercase for base-name comparison.
 * e.g. "Los Ángeles" and "Los Angeles" both become "los angeles" */
function normalizeBaseName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get("query");

  if (!rawQuery || rawQuery.length > 200) {
    return NextResponse.json(
      { cities: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const query = normalizeQuery(rawQuery);
  if (query.length < 2) {
    return NextResponse.json(
      { cities: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("cities/autocomplete: GOOGLE_PLACES_API_KEY is not set");
    return NextResponse.json(
      { error: "server misconfigured" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const upstream =
      `${AUTOCOMPLETE_URL}` +
      `?input=${encodeURIComponent(query)}` +
      `&types=(cities)` +
      `&key=${apiKey}`;

    const res = await fetch(upstream, {
      next: { revalidate: CACHE_TTL_SECONDS },
    });

    if (!res.ok) {
      console.error("cities/autocomplete: upstream non-ok", res.status);
      return NextResponse.json(
        { error: "upstream error" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const data = (await res.json()) as AutocompleteResponse;

    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("cities/autocomplete: places status", data.status);
      return fallbackToDb(query);
    }

    // Determine is_primary for each prediction. Google returns results ranked
    // by popularity, so the first occurrence of a base name is the most well-known city.

    const predictions = data.predictions ?? [];

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
      const base = normalizeBaseName(terms[0]?.value ?? "");
      const country = normalizeBaseName(terms[terms.length - 1]?.value ?? "");
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
    const cities = predictions.map((p, i) => {
      const terms = p.terms ?? [];
      const baseName = terms[0]?.value ?? p.description ?? "";
      const baseKey = normalizeBaseName(baseName);
      const countryKey = normalizeBaseName(terms[terms.length - 1]?.value ?? "");
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

      return {
        google_place_id: p.place_id,
        display_name,
        is_primary,
      };
    });

    return NextResponse.json(
      { cities },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=604800, max-age=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    console.error(
      "cities/autocomplete: fetch threw",
      error instanceof Error ? error.name : "unknown",
    );
    return fallbackToDb(query);
  }
}
