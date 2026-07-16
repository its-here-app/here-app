/**
 * Address -> city/state/country extraction used to resolve a `cities` row for
 * a spot. Split into two shapes because that's how Google formats addresses
 * (and how the `cities` table itself is inconsistently populated per locale):
 *
 * - US addresses end in a 2-letter state code (+ optional ZIP), and `cities`
 *   stores them as bare "City, ST" rows with no country segment at all.
 * - Everything else ends in a country name, and `cities` stores those as
 *   "City, Country" or "City, Region, Country" — we only ever compare the
 *   first and last comma segments, ignoring any region in between.
 *
 * Deliberately conservative: only countries with an explicit rule (plus a
 * generic postcode-stripping fallback for the rest) are handled. Anything
 * that doesn't fit returns null rather than guessing — a missed match is
 * fine, a wrong match (assigning a spot to the wrong city) is not.
 */

const US_STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};
const US_STATE_ABBR_SET = new Set(Object.values(US_STATE_ABBR));

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "usa",
  us: "usa",
  "united states": "usa",
  "united states of america": "usa",
  uk: "uk",
  "united kingdom": "uk",
};

// Unicode "Combining Diacritical Marks" block (U+0300-U+036F). Built from
// code points via String.fromCodePoint rather than a literal character range
// to avoid embedding invisible combining marks directly in the source file.
const DIACRITICS_RE = new RegExp(
  "[" + String.fromCodePoint(0x0300) + "-" + String.fromCodePoint(0x036f) + "]",
  "g"
);

/** Lowercase, trim, collapse whitespace, and strip diacritics (NFD + combining marks). */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalizeCountry(s: string): string {
  const n = normalizeForMatch(s);
  return COUNTRY_ALIASES[n] ?? n;
}

function parseUsShape(parts: string[]): { city: string; state: string } | null {
  // "City, ST" or "City, ST 99999" (abbreviated, optional ZIP)
  let idx = parts.findIndex((p) => {
    const m = p.match(/^([A-Z]{2})(\s+\d{5}(-\d{4})?)?$/);
    return !!m && US_STATE_ABBR_SET.has(m[1]);
  });
  if (idx > 0) {
    const m = parts[idx].match(/^([A-Z]{2})/)!;
    return { city: parts[idx - 1], state: m[1] };
  }

  // "City, Hawaii" or "City, Hawaii 99999" (full state name, optional ZIP)
  idx = parts.findIndex((p) => {
    const m = p.match(/^(.+?)\s+\d{5}(-\d{4})?$/);
    const name = (m ? m[1] : p).toLowerCase();
    return Object.prototype.hasOwnProperty.call(US_STATE_ABBR, name);
  });
  if (idx > 0) {
    const m = parts[idx].match(/^(.+?)\s+\d{5}(-\d{4})?$/);
    const name = (m ? m[1] : parts[idx]).toLowerCase();
    return { city: parts[idx - 1], state: US_STATE_ABBR[name] };
  }

  return null;
}

function extractUk(parts: string[]): string | null {
  const seg = parts[parts.length - 2];
  if (!seg) return null;
  // strip a trailing UK postcode, e.g. "London E5 8DY" -> "London"
  const cleaned = seg.replace(/\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, "").trim();
  return cleaned || null;
}

function extractSpain(parts: string[]): string | null {
  // Spanish postcode is a leading 5-digit token on the city's own segment,
  // e.g. "07460 Pollença" -> "Pollença". Scan from the end since the region
  // segment (e.g. "Illes Balears") sits between city and country.
  for (let i = parts.length - 2; i >= 0; i--) {
    const m = parts[i].match(/^\d{4,5}\s+(.+)$/);
    if (m) return m[1].trim();
  }
  return null;
}

function extractAustralia(parts: string[]): string | null {
  const seg = parts[parts.length - 2];
  if (!seg) return null;
  // strip a trailing 4-digit postcode but keep the state abbreviation, e.g.
  // "Sydney NSW 2000" -> "Sydney NSW" (the `cities` table stores AU rows
  // with city+state combined in the first segment, no comma between them).
  const cleaned = seg.replace(/\s*\d{4}$/, "").trim();
  return cleaned || null;
}

function extractNetherlands(parts: string[]): string | null {
  const seg = parts[parts.length - 2];
  if (!seg) return null;
  // strip a leading Dutch postcode, e.g. "1072 PB Amsterdam" -> "Amsterdam"
  const cleaned = seg.replace(/^\d{4}\s?[A-Z]{2}\s+/, "").trim();
  return cleaned || null;
}

function extractVietnam(parts: string[]): string | null {
  const seg = parts[parts.length - 2];
  if (!seg) return null;
  // strip a trailing postal code, e.g. "Hồ Chí Minh 70000" -> "Hồ Chí Minh"
  const cleaned = seg.replace(/\s*\d+$/, "").trim();
  return cleaned || null;
}

const COUNTRY_RULES: Record<string, (parts: string[]) => string | null> = {
  uk: extractUk,
  spain: extractSpain,
  australia: extractAustralia,
  netherlands: extractNetherlands,
  vietnam: extractVietnam,
};

/** Loose fallback for countries with no dedicated rule: strip an obvious
 * leading or trailing postcode-shaped token and hope the remainder matches
 * a `cities` row's first segment. Never used for the countries above, since
 * those have precise rules — this only kicks in for the long tail (Japan,
 * Sweden, Denmark, Switzerland, Ireland, New Zealand, etc.). */
function genericFallback(parts: string[]): string | null {
  const seg = parts[parts.length - 2];
  if (!seg) return null;
  const cleaned = seg
    // strip up to two leading digit-led tokens, e.g. Swedish "621 56 Visby"
    .replace(/^(?:\d[\w-]*\s+){1,2}/, "")
    .replace(/\s*\d{3,6}$/, "")
    .trim();
  return cleaned || null;
}

export type ParsedLocation =
  | { kind: "us"; city: string; state: string }
  | { kind: "intl"; citySegment: string; country: string };

/**
 * Parse a Google-formatted address into either a US { city, state } pair or
 * an international { citySegment, country } pair. Returns null if the
 * address doesn't fit any known shape — deliberately does not guess.
 */
export function parseAddressLocation(address: string): ParsedLocation | null {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const country = canonicalizeCountry(parts[parts.length - 1]);

  if (country === "usa") {
    const us = parseUsShape(parts);
    if (us) return { kind: "us", ...us };
  }

  const rule = COUNTRY_RULES[country];
  const citySegment = rule ? rule(parts) : genericFallback(parts);
  if (citySegment) return { kind: "intl", citySegment, country };

  return null;
}
