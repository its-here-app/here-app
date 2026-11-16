/**
 * Shared handling of Google Places (legacy) error statuses for the API routes
 * that call it: spots/search, spots/photo and cities/autocomplete.
 *
 * All three share one API key and one Places quota, so when the quota runs
 * out (or billing/key access breaks) they all fail together. Places reports
 * this inside an HTTP 200 body (`status: "OVER_QUERY_LIMIT"`,
 * `"REQUEST_DENIED"`, ...), not as an HTTP error.
 */

/** Only these are real answers. Anything else must not be cached or shown. */
export function isUsablePlacesStatus(status: string | undefined): boolean {
  return !status || status === "OK" || status === "ZERO_RESULTS";
}

// Statuses that mean every request will fail for a while, no matter which
// place or query: quota exhausted, billing off, key restricted or revoked.
const OUTAGE_STATUSES = new Set([
  "OVER_QUERY_LIMIT",
  "OVER_DAILY_LIMIT",
  "REQUEST_DENIED",
]);

// After an outage status, skip Google for this long on this instance. Each
// failed call is still a round trip (two in a row for a photo) before the
// fallback can answer, and it adds load to a quota that is already exhausted.
// Short enough that recovery after the daily quota reset is still quick.
const COOLDOWN_MS = 60_000;

let skipUntil = 0;

/** True while a recent outage status says Google calls will fail anyway.
 *  Per serverless instance and best-effort: correctness never depends on it. */
export function placesCoolingDown(): boolean {
  return Date.now() < skipUntil;
}

/** Log a non-usable status with Google's explanation, and start the cooldown
 *  if it's an outage. The error_message is what tells "daily quota exceeded"
 *  apart from "billing not enabled" or "key not authorized for this API". It
 *  never includes the key itself. */
export function reportPlacesFailure(
  route: string,
  status: string | undefined,
  errorMessage?: string,
): void {
  console.error(`${route}: places status`, status, errorMessage ?? "");
  if (status && OUTAGE_STATUSES.has(status)) {
    skipUntil = Date.now() + COOLDOWN_MS;
  }
}
