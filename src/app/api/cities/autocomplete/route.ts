import { NextRequest, NextResponse } from "next/server";

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
      return NextResponse.json(
        { error: "search failed" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Determine is_primary for each prediction. Google returns results ranked
    // by popularity, so the first occurrence of a base name is the most well-known city.

    const predictions = data.predictions ?? [];

    // First pass: find which base names (first term) appear more than once.
    // Normalize diacritics so "Los Angeles" and "Los Ángeles" are treated as the same base.
    const baseNameFirstSeen = new Map<string, number>();
    const baseNameDupes = new Set<string>();
    for (let i = 0; i < predictions.length; i++) {
      const base = normalizeBaseName(predictions[i].terms?.[0]?.value ?? "");
      if (baseNameFirstSeen.has(base)) {
        baseNameDupes.add(base);
      } else {
        baseNameFirstSeen.set(base, i);
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
      const isUS = terms[terms.length - 1]?.value === "USA";

      // Full canonical name: US cities drop "USA" suffix, others keep full description.
      const display_name = isUS
        ? terms.slice(0, -1).map((t) => t.value).join(", ")
        : (p.description ?? baseName);

      // Primary = the most popular city for this base name.
      // - If duplicates exist in results, the first one wins (Google ranks by popularity).
      // - If unique in results, only mark primary if the user's query is roughly
      //   just the city name (not qualified with a country/state like "los angeles chile").
      //   The +2 accounts for trailing spaces or 1-2 extra chars mid-typing.
      const queryIsGeneric = query.length <= baseKey.length + 2;
      const is_primary = baseNameDupes.has(baseKey)
        ? baseNameFirstSeen.get(baseKey) === i
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
    return NextResponse.json(
      { error: "failed to search cities" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
