/**
 * Format a city name for display.
 *
 * When `is_primary` is known (from the cities table join), primary cities
 * show just the base name ("Portland"), while non-primary cities keep
 * the full disambiguated name ("Portland, ME").
 *
 * When `is_primary` is not provided (e.g. very old playlists without a
 * city_id), the full string is returned as-is.
 */
export function formatCityDisplay(
  city: string,
  isPrimary?: boolean,
): string {
  if (!city) return "";
  if (isPrimary === true) {
    // Strip everything after the first comma: "Portland, OR" → "Portland"
    const commaIdx = city.indexOf(",");
    return commaIdx > 0 ? city.slice(0, commaIdx).trim() : city;
  }
  return city;
}
