import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import {
  isUsablePlacesStatus,
  placesCoolingDown,
  reportPlacesFailure,
} from "@/lib/placesStatus";

/**
 * Places Text Search proxy.
 *
 * Caching strategy:
 *  - Uses raw fetch() so Next's data cache applies (`next: { revalidate }`).
 *    The @googlemaps SDK uses axios and bypasses this, so we call the REST
 *    endpoint directly.
 *  - Query is normalized (lowercase / trimmed) so equivalent searches share
 *    a cache entry.
 *  - Response has a `Cache-Control` header so the Vercel edge + browsers
 *    also cache the JSON, reducing load on the Next server itself.
 *  - Places reports errors (OVER_QUERY_LIMIT, REQUEST_DENIED, ...) inside an
 *    HTTP 200, which Next's data cache stores like any ok response. Those
 *    entries are evicted on sight, or one failed search would keep failing
 *    for 24h after the quota recovers.
 *
 * Text Search is the most expensive Places endpoint we use ($32/1k), so
 * aggressive caching here is the biggest bang for the buck.
 *
 * Fallback: when Google can't answer (quota exhausted, key/billing problem,
 * network error), spots we already store are searched by name instead, so
 * search degrades to "spots someone has already added" rather than to an
 * error. Same approach as cities/autocomplete.
 */

const TEXT_SEARCH_URL =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";

// Cache identical searches for 24h. Restaurant/spot results change slowly.
const CACHE_TTL_SECONDS = 60 * 60 * 24;

const DB_FALLBACK_LIMIT = 20;

type GooglePhoto = { photo_reference: string };
type GooglePlace = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  photos?: GooglePhoto[];
  rating?: number;
  types?: string[];
};
type TextSearchResponse = {
  results?: GooglePlace[];
  status?: string;
  error_message?: string;
};

type SpotRow = {
  google_place_id: string;
  name: string;
  address: string | null;
  photo_url: string | null;
  rating: number | null;
  types: string[] | null;
};

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

/** Stored spots whose name contains the query, in the given city when known.
 *  Best first: exact name, then name prefix, then rating. */
async function searchDb(query: string, city: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
  let dbQuery = supabase
    .from("spots")
    .select("google_place_id, name, address, photo_url, rating, types")
    .ilike("name", `%${escapeLike(query)}%`);

  // "Portland, ME" -> "portland": addresses spell out the city name but not
  // necessarily our display suffix.
  const cityName = city.split(",")[0].trim();
  if (cityName) dbQuery = dbQuery.ilike("address", `%${escapeLike(cityName)}%`);

  const { data, error } = await dbQuery.limit(50);
  if (error) throw error;

  const rank = (s: SpotRow) => {
    const name = s.name.toLowerCase();
    return name === query ? 0 : name.startsWith(query) ? 1 : 2;
  };
  return ((data ?? []) as SpotRow[])
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (b.rating ?? -1) - (a.rating ?? -1) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, DB_FALLBACK_LIMIT)
    .map((s) => ({
      spot_id: s.google_place_id,
      name: s.name,
      address: s.address,
      photo_url: s.photo_url,
      rating: s.rating,
      types: s.types,
    }));
}

/** Answer from stored spots. Never cached at the edge: the next request
 *  should try Google again. Only errors if the DB is unavailable too. */
async function fallbackToDb(query: string, city: string) {
  try {
    const places = await searchDb(query, city);
    return NextResponse.json(
      { places, source: "db" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("spots/search: db fallback failed");
    return NextResponse.json(
      { error: "search unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get("query");
  const rawCity = request.nextUrl.searchParams.get("city") ?? "";

  if (!rawQuery || rawQuery.length > 200 || rawCity.length > 200) {
    return NextResponse.json(
      { error: "invalid query" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const query = normalizeQuery(rawQuery);
  const city = normalizeQuery(rawCity);
  if (query.length < 2) {
    return NextResponse.json(
      { places: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("spots/search: GOOGLE_PLACES_API_KEY is not set");
    return fallbackToDb(query, city);
  }

  if (placesCoolingDown()) return fallbackToDb(query, city);

  try {
    // Same string the client used to send as one `query`, so existing cache
    // entries still match.
    const googleQuery = city ? `${query}, ${city}` : query;
    const upstream =
      `${TEXT_SEARCH_URL}?query=${encodeURIComponent(googleQuery)}&key=${apiKey}`;

    // Use Next's fetch cache keyed on the normalized URL. Identical queries
    // from any user share the same cache entry for 24h.
    const cacheTag = `spots-search:${googleQuery}`;
    const res = await fetch(upstream, {
      next: { revalidate: CACHE_TTL_SECONDS, tags: [cacheTag] },
    });

    if (!res.ok) {
      console.error("spots/search: upstream non-ok", res.status);
      return fallbackToDb(query, city);
    }

    const data = (await res.json()) as TextSearchResponse;

    if (!isUsablePlacesStatus(data.status)) {
      reportPlacesFailure("spots/search", data.status, data.error_message);
      revalidateTag(cacheTag, { expire: 0 });
      return fallbackToDb(query, city);
    }

    // Format results. We return a stable proxy URL for photos instead of a
    // raw Google URL to avoid leaking the API key and to survive photo_reference
    // rotation (see src/app/api/spots/photo/route.ts).
    const places = (data.results ?? []).map((place) => {
      const hasPhoto = !!place.photos?.[0]?.photo_reference;
      const photo_url =
        hasPhoto && place.place_id
          ? `/api/spots/photo?place_id=${encodeURIComponent(place.place_id)}`
          : null;

      return {
        spot_id: place.place_id,
        name: place.name,
        address: place.formatted_address,
        photo_url,
        rating: place.rating ?? null,
        types: place.types ?? null,
      };
    });

    return NextResponse.json(
      { places },
      {
        headers: {
          // Cache on the edge / browser as well. s-maxage = shared cache (CDN).
          // stale-while-revalidate keeps hot queries instant while refreshing.
          "Cache-Control":
            "public, s-maxage=86400, max-age=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    // Log the error type only, not the full error (which could contain URL/key).
    console.error(
      "spots/search: fetch threw",
      error instanceof Error ? error.name : "unknown",
    );
    return fallbackToDb(query, city);
  }
}
