import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { geocodeCity } from "@/lib/geocodeCity";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

// Cache weather for 30 minutes — it doesn't change that fast.
const CACHE_TTL_SECONDS = 60 * 30;

/**
 * Map WMO weather codes to human-readable conditions.
 * https://open-meteo.com/en/docs#weathervariables
 */
function weatherCondition(code: number): string {
  if (code === 0) return "sunny";
  if (code <= 3) return "cloudy";
  if (code <= 48) return "foggy";
  if (code <= 55) return "drizzly";
  if (code <= 65) return "rainy";
  if (code <= 75) return "snowy";
  if (code <= 82) return "rainy";
  if (code <= 86) return "snowy";
  return "stormy";
}

export async function GET(request: NextRequest) {
  const cityId = request.nextUrl.searchParams.get("cityId");

  if (!cityId) {
    return NextResponse.json(
      { error: "cityId required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  const { data: city } = await supabase
    .from("cities")
    .select("latitude, longitude, display_name")
    .eq("id", cityId)
    .single();

  if (!city) {
    return NextResponse.json(
      { error: "city not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Resolve coordinates on demand when the row has none. Rows predating the
  // Open-Meteo switch had their Google-derived coordinates cleared (Maps
  // Platform Service Specific Terms §14.3), so the first weather request for
  // one of those cities backfills it here rather than leaving the city
  // permanently weatherless until someone re-selects it.
  let latitude = city.latitude;
  let longitude = city.longitude;

  if (latitude == null || longitude == null) {
    const coords = await geocodeCity(city.display_name);
    if (!coords) {
      return NextResponse.json(
        { error: "city has no coordinates" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    latitude = coords.latitude;
    longitude = coords.longitude;

    // Best-effort write-back: a failure just means the next request geocodes
    // again, which is free.
    const { error: backfillErr } = await supabase
      .from("cities")
      .update({ latitude, longitude })
      .eq("id", cityId);
    if (backfillErr) console.error("weather: coordinate backfill failed");
  }

  try {
    const url =
      `${OPEN_METEO_URL}` +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&current=temperature_2m,weather_code` +
      `&temperature_unit=fahrenheit`;

    const res = await fetch(url, {
      next: { revalidate: CACHE_TTL_SECONDS },
    });

    if (!res.ok) {
      console.error("weather: open-meteo non-ok", res.status);
      return NextResponse.json(
        { error: "weather unavailable" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const data = await res.json();
    const current = data.current;

    if (!current) {
      return NextResponse.json(
        { error: "no current weather data" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        temp: Math.round(current.temperature_2m),
        condition: weatherCondition(current.weather_code),
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_TTL_SECONDS}, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS * 2}`,
        },
      },
    );
  } catch (error) {
    console.error(
      "weather: fetch threw",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "failed to fetch weather" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
