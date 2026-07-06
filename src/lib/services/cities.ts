import { createClient } from "../supabase/client";

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
