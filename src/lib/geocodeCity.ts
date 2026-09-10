import {
  normalizeForMatch,
  canonicalizeCountry,
  usStateNameFromAbbr,
  auStateNameFromAbbr,
  isUsStateAbbr,
} from "@/lib/cityResolution";

/**
 * Resolve a city's coordinates from its stored `display_name`.
 *
 * Why not Google: coordinates used to come from Place Details
 * (`fields=geometry`), which made them Places Content. The Maps Platform
 * Service Specific Terms §14.3 permit caching Places latitude/longitude for at
 * most 30 consecutive calendar days, after which it must be deleted — and
 * `upsertCityAction` fetched them once and never refreshed, which is exactly
 * the indefinite storage that clause forbids.
 *
 * Open-Meteo's geocoding API carries no such restriction, is free, needs no
 * key, and is already the provider behind `api/weather` — the only consumer of
 * these coordinates. Sourcing them here removes the restriction rather than
 * managing it, so the values can simply be stored.
 *
 * Matching is deliberately conservative, mirroring `cityResolution.ts`: a
 * missed match returns null and the city just has no weather, which is a
 * non-critical feature. A wrong match would put a city on the other side of
 * the world, so anything ambiguous is rejected.
 */

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

// City coordinates do not move. Cached long purely to be a good citizen of a
// free API; there is no billing or policy reason to expire this.
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

// Enough candidates to get past same-named towns ranked above the real city.
const CANDIDATE_COUNT = 10;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface GeocodeResult {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  country_code?: string;
  /** Top-level region: "Oregon", "New South Wales", "England". */
  admin1?: string;
  /** Second-level region: "Brighton and Hove", "East District". UK districts
   *  arrive here rather than in `name`, which is why it is matched too. */
  admin2?: string;
  population?: number;
}

/** What a stored `display_name` claims about a city, in the shapes the
 *  `cities` table actually holds — of 707 rows: 473 have two segments, 162
 *  three, and 71 four.
 *   - US:   "Portland, OR"                              (no country segment)
 *   - AU:   "Sydney, NSW, Australia"
 *   - Intl: "Madrid, Spain" / "Brighton, Truro, United Kingdom"
 *           / "Chongwen Village, East District, Tainan City, Taiwan"  */
interface Expectation {
  base: string;
  /** Canonicalised country, e.g. "usa", "australia", "france". Null only for a
   *  bare single-segment name — a city-state such as "Singapore", which the
   *  picker stores unqualified because there is nothing to disambiguate. */
  country: string | null;
  /** Full region name that must equal the result's `admin1`. Only set where we
   *  can derive it exactly — a US or AU state code. */
  strictRegion: string | null;
  /** The qualifying segments of an already-qualified name, e.g. ["Truro"].
   *  The city picker only adds these when the bare name was ambiguous, so a
   *  result that corroborates none of them is the wrong place. */
  qualifiers: string[];
}

function parseDisplayName(displayName: string): Expectation | null {
  const parts = displayName
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const base = parts[0];
  const last = parts[parts.length - 1];
  const none: string[] = [];

  // A bare name with nothing to qualify it — a city-state like "Singapore".
  // No country to check against, so the name match plus the population
  // tiebreak carry the whole decision.
  if (parts.length === 1) {
    return { base, country: null, strictRegion: null, qualifiers: none };
  }

  // US rows are stored without a country segment, so a trailing state code is
  // what identifies them: "Portland, OR".
  if (parts.length === 2 && isUsStateAbbr(last)) {
    return {
      base,
      country: "usa",
      strictRegion: usStateNameFromAbbr(last),
      qualifiers: none,
    };
  }

  const country = canonicalizeCountry(last);

  // "Sydney, NSW, Australia" — the middle segment is a state code.
  if (country === "australia" && parts.length >= 3) {
    const region = auStateNameFromAbbr(parts[1]);
    if (region) {
      return { base, country, strictRegion: region, qualifiers: none };
    }
  }

  // "Los Angeles, CA, USA" — the qualified US form, if it ever appears.
  if (country === "usa" && parts.length >= 3 && isUsStateAbbr(parts[1])) {
    return {
      base,
      country,
      strictRegion: usStateNameFromAbbr(parts[1]),
      qualifiers: none,
    };
  }

  // Everything else. Region naming varies too much between sources to demand
  // an exact match ("Kyoto" vs "Kyoto Prefecture"), but a qualified name still
  // has to be corroborated by something — see `corroborates`.
  return {
    base,
    country,
    strictRegion: null,
    qualifiers: parts.slice(1, -1),
  };
}

/** Loose region comparison: equal, or one name contained in the other, so
 *  "Tainan City" corroborates admin1 "Tainan". Only ever applied after the
 *  country already matched, which keeps the containment from reaching across
 *  borders (e.g. "York" into "New York"). */
function corroborates(qualifier: string, candidate: string): boolean {
  const q = normalizeForMatch(qualifier);
  const c = normalizeForMatch(candidate);
  if (!q || !c) return false;
  return q === c || q.includes(c) || c.includes(q);
}

/** Country as reported by Open-Meteo, canonicalised to compare against ours.
 *  `country_code` is checked first because it is stable; the full name is a
 *  fallback for countries not covered by the alias table. */
function resultCountryMatches(result: GeocodeResult, expected: string): boolean {
  const code = result.country_code?.toUpperCase();
  if (code === "US" && expected === "usa") return true;
  if (code === "AU" && expected === "australia") return true;
  if (code === "GB" && expected === "uk") return true;
  return !!result.country && canonicalizeCountry(result.country) === expected;
}

export async function geocodeCity(
  displayName: string,
): Promise<Coordinates | null> {
  const expectation = parseDisplayName(displayName);
  if (!expectation) return null;

  let results: GeocodeResult[];
  try {
    const url =
      `${GEOCODE_URL}?name=${encodeURIComponent(expectation.base)}` +
      `&count=${CANDIDATE_COUNT}` +
      `&language=en&format=json`;

    const res = await fetch(url, { next: { revalidate: CACHE_TTL_SECONDS } });
    if (!res.ok) {
      console.error("geocodeCity: upstream non-ok", res.status);
      return null;
    }
    results = ((await res.json()) as { results?: GeocodeResult[] }).results ?? [];
  } catch (error) {
    console.error(
      "geocodeCity: fetch threw",
      error instanceof Error ? error.name : "unknown",
    );
    return null;
  }

  const wantName = normalizeForMatch(expectation.base);
  const wantRegion = expectation.strictRegion
    ? normalizeForMatch(expectation.strictRegion)
    : null;

  const candidates = results.filter((r) => {
    if (typeof r.latitude !== "number" || typeof r.longitude !== "number") {
      return false;
    }

    // Open-Meteo matches fuzzily — a search for "Sydney" returns "Sidney, Ohio"
    // and one for "Portland" returns "Blue Island". Require the name to match
    // exactly, against either `name` or `admin2`: UK districts come back as
    // name "Brighton" / admin2 "Brighton and Hove", and we store the latter.
    // Diacritics are already stripped, so "Los Ángeles" matches "Los Angeles"
    // and the country check is what separates Chile from California.
    const nameMatches =
      (!!r.name && normalizeForMatch(r.name) === wantName) ||
      (!!r.admin2 && normalizeForMatch(r.admin2) === wantName);
    if (!nameMatches) return false;

    if (
      expectation.country !== null &&
      !resultCountryMatches(r, expectation.country)
    ) {
      return false;
    }

    if (wantRegion && normalizeForMatch(r.admin1 ?? "") !== wantRegion) {
      return false;
    }

    // A qualified name has to be corroborated by the result's own region
    // fields. Without this, "Brighton, Truro, United Kingdom" matches the only
    // Brighton in Open-Meteo's UK data — the one in Sussex, 343km away.
    if (expectation.qualifiers.length > 0) {
      const regions = [r.admin1, r.admin2].filter(Boolean) as string[];
      const corroborated = expectation.qualifiers.some((q) =>
        regions.some((region) => corroborates(q, region)),
      );
      if (!corroborated) return false;
    }

    return true;
  });

  if (candidates.length === 0) return null;

  // With a region constraint this is nearly always a single candidate. Without
  // one, population picks the city people mean — the same "most prominent
  // wins" assumption the city picker's is_primary flag already makes.
  const best = candidates.reduce((a, b) =>
    (b.population ?? 0) > (a.population ?? 0) ? b : a,
  );

  return { latitude: best.latitude!, longitude: best.longitude! };
}
