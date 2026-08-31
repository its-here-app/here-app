import { createClient } from "./supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Behavioural events that state tables can't express — shares, and later
 * sessions and impressions. Anything that is a durable fact about a user or a
 * playlist belongs on the table itself, not here: this stream is best-effort
 * and drops writes rather than surfacing errors.
 */
export function track(
  userId: string,
  event: string,
  properties: Record<string, unknown> = {}
) {
  const supabase = createClient();
  // supabase-js query builders are lazy thenables — the fetch only happens
  // inside .then(). Without this, nothing is ever sent.
  void supabase
    .from("events")
    .insert({ user_id: userId, event, properties })
    .then(
      () => {},
      () => {}
    );
}

/**
 * Server-side variant. Takes the caller's client so the insert runs as the
 * signed-in user and satisfies the events insert policy.
 */
export async function trackServer(
  supabase: SupabaseClient,
  userId: string,
  event: string,
  properties: Record<string, unknown> = {}
) {
  const { error } = await supabase
    .from("events")
    .insert({ user_id: userId, event, properties });
  // Analytics must never break the action that triggered it.
  if (error) console.error("track failed:", event, error.message);
}
