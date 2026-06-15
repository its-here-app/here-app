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
 * Instead, we store `/api/spots/photo?place_id={google_place_id}` in the DB.
 * On each request, this route:
 *   1. Verifies the place_id belongs to a spot we've actually saved (prevents
 *      anonymous abuse of our Google API quota / billing)
 *   2. Asks Google for the current photo_reference (cached server-side)
 *   3. Resolves the final CDN URL on googleusercontent.com (key stays on server)
 *   4. 302-redirects the browser to that CDN URL
 *
 * Security posture:
 *   - API key never leaves the server
 *   - Proxy only serves photos for place IDs in our `spots` table
 *   - Redirect host is validated against an allow-list
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

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("place_id");
  const rawMaxwidth = request.nextUrl.searchParams.get("maxwidth");

  // --- 1. Input validation -------------------------------------------------

  if (!placeId || !PLACE_ID_RE.test(placeId)) {
    return errorResponse(400, "invalid place_id");
  }

  // Bound maxwidth to Google's supported range (1..1600). Default 800.
  let maxwidth = 800;
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

  // --- 2. Authorization: place_id must exist in our spots table ------------
  // This prevents anonymous callers from burning our Google API quota with
  // arbitrary place IDs. Only places we've already saved are proxyable.

  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
    );
    const { data: spot, error: spotErr } = await supabase
      .from("spots")
      .select("google_place_id")
      .eq("google_place_id", placeId)
      .maybeSingle();

    if (spotErr) {
      console.error("photo proxy: db lookup failed");
      return errorResponse(500, "lookup failed");
    }
    if (!spot) {
      return errorResponse(404, "not found");
    }
  } catch {
    console.error("photo proxy: db lookup threw");
    return errorResponse(500, "lookup failed");
  }

  // --- 3. Resolve current photo_reference via Places Details ---------------

  let photoRef: string | undefined;
  try {
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${encodeURIComponent(placeId)}` +
        `&fields=photos` +
        `&key=${apiKey}`,
      { next: { revalidate: 86400 } }, // 24h cache on the reference
    );

    if (!detailsRes.ok) {
      console.error("photo proxy: details upstream non-ok", detailsRes.status);
      return placeholderRedirect(request);
    }

    const details = (await detailsRes.json()) as {
      result?: { photos?: { photo_reference: string }[] };
      status?: string;
    };
    if (details.status && details.status !== "OK") {
      console.error("photo proxy: places API status", details.status);
      return placeholderRedirect(request);
    }
    photoRef = details.result?.photos?.[0]?.photo_reference;
  } catch {
    console.error("photo proxy: details fetch threw");
    return placeholderRedirect(request);
  }

  if (!photoRef) {
    return placeholderRedirect(request);
  }

  // --- 4. Resolve the CDN URL from Places Photo ----------------------------
  // The Photo endpoint 302s to a key-less googleusercontent.com URL. We
  // follow the redirect server-side so the API key never hits the browser.

  let cdnUrl: string | null = null;
  try {
    const photoRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/photo` +
        `?maxwidth=${maxwidth}` +
        `&photo_reference=${encodeURIComponent(photoRef)}` +
        `&key=${apiKey}`,
      { redirect: "manual" },
    );
    cdnUrl = photoRes.headers.get("location");
  } catch {
    console.error("photo proxy: photo fetch threw");
    return placeholderRedirect(request);
  }

  if (!cdnUrl) {
    return placeholderRedirect(request);
  }

  // --- 5. Validate the redirect target is a Google CDN --------------------
  // Prevents this route from being used as an open redirect if Google ever
  // returns an unexpected Location.

  let parsed: URL;
  try {
    parsed = new URL(cdnUrl);
  } catch {
    return errorResponse(502, "invalid upstream url");
  }
  if (
    parsed.protocol !== "https:" ||
    !ALLOWED_REDIRECT_HOSTS.has(parsed.hostname)
  ) {
    console.error("photo proxy: unexpected redirect host", parsed.hostname);
    return errorResponse(502, "unexpected upstream host");
  }

  // --- 6. Respond ---------------------------------------------------------
  // Short browser cache so clients don't re-hit us constantly, but short
  // enough that we'll refresh before the signed CDN URL expires.

  return NextResponse.redirect(parsed.toString(), {
    status: 302,
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
