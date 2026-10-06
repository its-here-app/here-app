import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import {
  buildCitySuggestions,
  type AutocompletePrediction,
} from "@/lib/cityAutocomplete";
import { normalizeForMatch } from "@/lib/cityResolution";

/**
 * Place Autocomplete proxy for city selection.
 *
 * Caching strategy:
 *  - Raw fetch() so Next's data cache applies. The @googlemaps SDK uses
 *    axios and bypasses this.
 *  - Queries are normalized so equivalent prefixes share a cache entry.
 *  - City lists change extremely slowly, so we cache aggressively (7 days).
 *  - Client-side this route is already debounced at 300ms.
 *
 * Quota: Places autocomplete is billed per request, so `cities` is searched
 * first and Google is only called when the typed text isn't a complete name
 * we already know (see `searchDb` / `isConfidentDbMatch`).
 */

// Shorter queries are too ambiguous to be worth a billed Places call.
const MIN_QUERY_LENGTH = 3;

const AUTOCOMPLETE_URL =
  "https://maps.googleapis.com/maps/api/place/autocomplete/json";

// Cache autocomplete prefixes for 7 days. City lists are effectively static.
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

type AutocompleteResponse = {
  predictions?: AutocompletePrediction[];
  status?: string;
  error_message?: string;
};

// Places reports errors (REQUEST_DENIED, OVER_QUERY_LIMIT, ...) inside an HTTP
// 200, and Next's data cache stores any ok response. Only these two statuses
// are real answers worth caching.
const isUsable = (d: AutocompleteResponse) =>
  !d.status || d.status === "OK" || d.status === "ZERO_RESULTS";

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

type CityRow = {
  google_place_id: string;
  display_name: string;
  is_primary: boolean;
};

const baseName = (c: CityRow) => normalizeForMatch(c.display_name.split(",")[0]);

/** Known cities matching the text, best first: exact base-name matches, then
 *  base-name prefixes, then primary cities, then alphabetical. */
async function searchDb(query: string): Promise<CityRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
  const { data } = await supabase
    .from("cities")
    .select("google_place_id, display_name, is_primary")
    .ilike("display_name", `%${escapeLike(query)}%`)
    .limit(30);

  const q = normalizeForMatch(query);
  const rank = (c: CityRow) =>
    baseName(c) === q ? 0 : baseName(c).startsWith(q) ? 1 : 2;
  return ((data ?? []) as CityRow[]).sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Number(b.is_primary) - Number(a.is_primary) ||
      a.display_name.localeCompare(b.display_name),
  );
}

/** The text is a complete city name we already store ("stockholm"), not a
 *  half-typed prefix or a qualified query ("portland, me") — safe to answer
 *  without asking Google. Rows on other prefixes could be missing cities. */
function isConfidentDbMatch(query: string, rows: CityRow[]): boolean {
  const q = normalizeForMatch(query);
  return rows.some((c) => baseName(c) === q);
}

async function dbResponse(rows: CityRow[]) {
  return NextResponse.json(
    { cities: rows.slice(0, 5) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function fallbackToDb(query: string) {
  try {
    return dbResponse(await searchDb(query));
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

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get("query");

  if (!rawQuery || rawQuery.length > 200) {
    return NextResponse.json(
      { cities: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const query = normalizeQuery(rawQuery);
  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(
      { cities: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const known = await searchDb(query);
    if (isConfidentDbMatch(query, known)) return dbResponse(known);
  } catch {
    // DB unavailable: fall through to Google.
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

    const cacheTag = `cities-autocomplete:${query}`;
    const res = await fetch(upstream, {
      next: { revalidate: CACHE_TTL_SECONDS, tags: [cacheTag] },
    });

    if (!res.ok) {
      console.error("cities/autocomplete: upstream non-ok", res.status);
      return NextResponse.json(
        { error: "upstream error" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const data = (await res.json()) as AutocompleteResponse;

    if (!isUsable(data)) {
      // A bad answer may have been cached for this prefix (up to 7 days).
      // Evict it so the next request asks Google again, and answer this one
      // from the DB. No retry here: on a quota error it would just burn more.
      console.error(
        "cities/autocomplete: places status",
        data.status,
        data.error_message ?? "",
      );
      revalidateTag(cacheTag, { expire: 0 });
      return fallbackToDb(query);
    }

    const cities = buildCitySuggestions(data.predictions ?? [], query);

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
