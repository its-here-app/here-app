import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * Stable photo proxy for Google Places.
 *
 * Why this exists:
 *  - Google's `photo_reference` values rotate/expire over time, so storing
 *    a raw Google photo URL in our DB leads to broken images.
 *  - Raw Google URLs also embed our API key, which would leak to every browser.
 *
 * We store `/api/spots/photo?place_id={google_place_id}` in the DB, and this
 * route resolves it to a key-less googleusercontent.com URL.
 *
 * Caching strategy:
 *   Resolving a photo costs two billed Google calls — Place Details
 *   (`fields=photos`, $17/1k) then Place Photo ($7/1k). Doing that per render
 *   cost $115 in August 2026 from team testing alone, because the bill scaled
 *   with page views. The resolved CDN URL is now cached on the spot row, so
 *   Google is called once per spot per cache period instead of once per view,
 *   and the bill scales with the size of the spot catalogue instead.
 *
 *   The 30-day TTL is the ceiling in the Maps Platform Service Specific Terms
 *   §14.3, which is also where the cost curve flattens — there is no tradeoff
 *   between the compliant TTL and the cheap one. Rows that stop being read are
 *   cleared by `purge_stale_spot_photo_cache()` (see the migration).
 *
 *   `?refresh=1` bypasses the cache and re-resolves. `SpotCard` calls it once
 *   on image error, which is what makes a TTL this long safe: if a CDN URL
 *   expires early, the next viewer repairs the row instead of seeing a
 *   placeholder until the TTL runs out.
 *
 * Security posture:
 *   - API key never leaves the server
 *   - Proxy only serves photos for place IDs in our `spots` table
 *   - Redirect host is validated against an allow-list, before caching
 *   - Errors are logged without URLs to avoid leaking the key
 */

// Google place IDs are URL-safe base64-ish strings. Restrict the charset to
// prevent injection into the upstream URL and give a cheap pre-DB filter.
const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,255}$/;

// Google serves resolved place photos from these hosts.
const ALLOWED_REDIRECT_HOSTS = new Set([
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
  "maps.gstatic.com",
]);

const PLACEHOLDER_PATH = "/images/playlist-default.jpg";

// Ceiling from the Maps Platform Service Specific Terms §14.3. Do not raise.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Only the default width is cached — the resolved CDN URL is width-specific,
// and one column can only hold one width. Nothing in the app currently
// requests another size, so in practice every request takes the cached path.
const DEFAULT_MAXWIDTH = 800;

// Collapses concurrent misses for the same spot into one upstream resolve, so
// a page rendering the same spot twice (or a burst after a purge) doesn't pay
// for it twice. Per-instance and best-effort — correctness never depends on it.
const inFlight = new Map<string, Promise<string | null>>();

function placeholderRedirect(request: NextRequest) {
  const base = request.nextUrl.origin;
  return NextResponse.redirect(`${base}${PLACEHOLDER_PATH}`, {
    status: 302,
    headers: { "Cache-Control": "public, max-age=60" },
  });
}

function errorResponse(status: number, message: string) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/** 302 to a resolved CDN URL. Cached responses get a long browser/CDN TTL —
 *  the underlying row is stable for 30 days, and every proxy hit we avoid is
 *  a Supabase query saved. Forced refreshes are never cached, so the
 *  error-retry path always reaches us. */
function photoRedirect(url: string, { cacheable }: { cacheable: boolean }) {
  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      "Cache-Control": cacheable
        ? "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800"
        : "no-store",
    },
  });
}

/** Validate that Google sent us back a real Google CDN URL. Prevents this
 *  route being used as an open redirect, and stops a junk value being written
 *  into the cache column. */
function validCdnUrl(candidate: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    !ALLOWED_REDIRECT_HOSTS.has(parsed.hostname)
  ) {
    console.error("photo proxy: unexpected redirect host", parsed.hostname);
    return null;
  }
  return parsed.toString();
}

/** Place Details -> current photo_reference -> Place Photo -> CDN URL.
 *  Two billed Google calls; everything above exists to call this rarely. */
async function resolveFromGoogle(
  placeId: string,
  maxwidth: number,
  apiKey: string,
): Promise<string | null> {
  let photoRef: string | undefined;
  try {
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${encodeURIComponent(placeId)}` +
        `&fields=photos` +
        `&key=${apiKey}`,
      // No `next: { revalidate }` here any more. A 24h fetch cache ran at a
      // ~19% hit rate against this access pattern (~269 distinct place IDs
      // viewed per day out of 2,664 — almost every request was for a spot
      // that had aged out overnight). The row-level 30-day cache above
      // replaces it and spans the actual re-visit interval.
      { cache: "no-store" },
    );

    if (!detailsRes.ok) {
      console.error("photo proxy: details upstream non-ok", detailsRes.status);
      return null;
    }

    const details = (await detailsRes.json()) as {
      result?: { photos?: { photo_reference: string }[] };
      status?: string;
    };
    if (details.status && details.status !== "OK") {
      console.error("photo proxy: places API status", details.status);
      return null;
    }
    photoRef = details.result?.photos?.[0]?.photo_reference;
  } catch {
    console.error("photo proxy: details fetch threw");
    return null;
  }

  if (!photoRef) return null;

  // The Photo endpoint 302s to a key-less googleusercontent.com URL. We follow
  // the redirect server-side so the API key never hits the browser.
  try {
    const photoRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/photo` +
        `?maxwidth=${maxwidth}` +
        `&photo_reference=${encodeURIComponent(photoRef)}` +
        `&key=${apiKey}`,
      { redirect: "manual", cache: "no-store" },
    );
    const location = photoRes.headers.get("location");
    return location ? validCdnUrl(location) : null;
  } catch {
    console.error("photo proxy: photo fetch threw");
    return null;
  }
}

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("place_id");
  const rawMaxwidth = request.nextUrl.searchParams.get("maxwidth");
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  // --- 1. Input validation -------------------------------------------------

  if (!placeId || !PLACE_ID_RE.test(placeId)) {
    return errorResponse(400, "invalid place_id");
  }

  // Bound maxwidth to Google's supported range (1..1600). Default 800.
  let maxwidth = DEFAULT_MAXWIDTH;
  if (rawMaxwidth) {
    const parsed = Number.parseInt(rawMaxwidth, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 1600) {
      return errorResponse(400, "invalid maxwidth");
    }
    maxwidth = parsed;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("photo proxy: GOOGLE_PLACES_API_KEY is not set");
    return errorResponse(500, "server misconfigured");
  }

  const cacheable = maxwidth === DEFAULT_MAXWIDTH;

  // --- 2. Authorization + cache read (one query) ---------------------------
  // The place_id must exist in our spots table, which prevents anonymous
  // callers burning our Google quota with arbitrary place IDs. The cached URL
  // rides along on the same query, so the fast path costs one DB read and no
  // Google calls at all.

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  let cachedUrl: string | null = null;
  let fetchedAt: string | null = null;
  try {
    const { data: spot, error: spotErr } = await supabase
      .from("spots")
      .select("google_place_id, photo_cdn_url, photo_fetched_at")
      .eq("google_place_id", placeId)
      .maybeSingle();

    if (spotErr) {
      console.error("photo proxy: db lookup failed");
      return errorResponse(500, "lookup failed");
    }
    if (!spot) {
      return errorResponse(404, "not found");
    }
    cachedUrl = spot.photo_cdn_url;
    fetchedAt = spot.photo_fetched_at;
  } catch {
    console.error("photo proxy: db lookup threw");
    return errorResponse(500, "lookup failed");
  }

  // --- 3. Fast path: serve the cached URL ----------------------------------

  const isFresh =
    !!fetchedAt && Date.now() - new Date(fetchedAt).getTime() < CACHE_TTL_MS;

  if (cacheable && !forceRefresh && cachedUrl && isFresh) {
    return photoRedirect(cachedUrl, { cacheable: true });
  }

  // --- 4. Slow path: resolve from Google -----------------------------------
  // Missing, past the 30-day ceiling, a forced refresh, or a non-default
  // width. Concurrent misses for the same key share one resolve.

  const key = `${placeId}:${maxwidth}`;
  let pending = inFlight.get(key);
  if (!pending) {
    pending = resolveFromGoogle(placeId, maxwidth, apiKey).finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, pending);
  }

  const resolved = await pending;

  if (!resolved) {
    return placeholderRedirect(request);
  }

  // --- 5. Write back -------------------------------------------------------
  // Best-effort: a failed write costs us the next request's Google calls, not
  // correctness, so it must not fail the image.

  if (cacheable) {
    try {
      const { error: updateErr } = await supabase
        .from("spots")
        .update({
          photo_cdn_url: resolved,
          photo_fetched_at: new Date().toISOString(),
        })
        .eq("google_place_id", placeId);
      if (updateErr) console.error("photo proxy: cache write failed");
    } catch {
      console.error("photo proxy: cache write threw");
    }
  }

  // A forced refresh must not be cached by the browser, or the retry that
  // triggered it would be served from cache next time and never reach us.
  return photoRedirect(resolved, { cacheable: cacheable && !forceRefresh });
}
