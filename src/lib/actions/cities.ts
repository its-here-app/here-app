"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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

  const { data: upserted, error } = await admin
    .from("cities")
    .upsert(row, { onConflict: "google_place_id" })
    .select("id")
    .single();

  if (error) throw error;
  return upserted.id;
}
