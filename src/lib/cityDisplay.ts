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

/**
 * Extract a city name from a Google-formatted address, e.g.
 * "1234 SW Broadway, Portland, OR 97201, USA" → "Portland".
 * Returns null if no city segment can be identified.
 */
export function parseCityFromAddress(address: string): string | null {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const stateZipIndex = parts.findIndex((p) =>
    /^[A-Z]{2}\s+\d{5}(-\d{4})?$/.test(p)
  );
  if (stateZipIndex > 0) return parts[stateZipIndex - 1];

  if (parts.length >= 2) return parts[parts.length - 2];
  return null;
}
