"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const PLACE_DETAILS_URL =
  "https://maps.googleapis.com/maps/api/place/details/json";

/**
 * Resolve lat/lng for a Google Place ID via the Place Details API.
 * Returns null if the lookup fails (non-critical — city still gets upserted).
 */
async function resolveCoordinates(
  placeId: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    const url =
      `${PLACE_DETAILS_URL}?place_id=${encodeURIComponent(placeId)}` +
      `&fields=geometry` +
      `&key=${apiKey}`;

    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!res.ok) return null;

    const data = await res.json();
    const loc = data.result?.geometry?.location;
    if (!loc) return null;

    return { latitude: loc.lat, longitude: loc.lng };
  } catch {
    return null;
  }
}

export async function upsertCityAction(params: {
  google_place_id: string;
  display_name: string;
  is_primary?: boolean;
}): Promise<string> {
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );

  // Upsert: insert if new, update display_name and is_primary if changed.
  const row: Record<string, unknown> = {
    google_place_id: params.google_place_id,
    display_name: params.display_name,
  };
  if (params.is_primary !== undefined) {
    row.is_primary = params.is_primary;
  }

  // Check if this city already has coordinates; if not, resolve them.
  const { data: existing } = await admin
    .from("cities")
    .select("latitude")
    .eq("google_place_id", params.google_place_id)
    .maybeSingle();

  if (!existing?.latitude) {
    const coords = await resolveCoordinates(params.google_place_id);
    if (coords) {
      row.latitude = coords.latitude;
      row.longitude = coords.longitude;
    }
  }

  const { data: upserted, error } = await admin
    .from("cities")
    .upsert(row, { onConflict: "google_place_id" })
    .select("id")
    .single();

  if (error) throw error;
  return upserted.id;
}
