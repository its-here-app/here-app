const gcs = (path: string) =>
  `https://storage.googleapis.com/${process.env.NEXT_PUBLIC_GCS_BUCKET_NAME}/${path}`;

/* ------------------------------------------------------------------ */
/*  Cover photo inventory — all files in gs://here-app/default-covers */
/* ------------------------------------------------------------------ */

const COVERS = [
  "los-angeles_generic-hike_griffith-park.webp",
  "generic_dinner_los-angeles.webp",
  "new-york_china-town_manhattan.webp",
  "new-york_generic.webp",
  "san-francisco_generic_fish-market.webp",
  "san-francisco_generic_dolores-park.webp",
  "steph.kotula_utah_hiking-nature_cover.webp",
  "new-york_williamsburg_generic.webp",
  "maisieleung_los-angeles_ktown-faves_cover.webp",
  "new-york_brooklyn_dumbo.webp",
  "new-york_catskills_upstate_wine_bonfire.webp",
  "new-york_downtown-brooklyn_generic-city.webp",
  "wenju.tseng_London_bestmuseums_cover.webp",
  "new-york_les_generic-dessert.webp",
  "new-york_williamsburg_generic_domino-park.webp",
  "new-york_generic_2.webp",
  "jessicastrelioff_austin_a-perfect-day_cover.webp",
  "los-angeles_generic_palmtrees.webp",
  "weiweiyang_ho-chi-minh-city_best-restaurants-in-town_cover.webp",
  "los-angeles_generic_japan-town.webp",
  "new-york_generic-forest-hike_catskills.webp",
  "new-york_generic_5.webp",
  "portland_maine_generic.webp",
  "los-angeles_venice-canals.webp",
  "mexico_generic.webp",
  "new-york_empire-state.webp",
  "new-york_generic_4.webp",
  "new-york_generic_asian-food.webp",
  "new-york_generic-brunch.webp",
  "portland_oregon_generic-park_generic.webp",
  "san-francisco_generic_twin-peaks.webp",
  "los-angeles_larchmont_generic-market_fruits.webp",
  "san-francisco_generic.webp",
  "new-york_generic_3.webp",
  "new-york_generic_greek_brooklyn.webp",
  "new-york_generic_wine.webp",
  "new-york_west-village_cafe-tola.webp",
  "japan_generic-asia.webp",
  "los-angeles_robata_generic-sushi.webp",
  "new-york_manhattan_oculus.webp",
] as const;

const COVER_URLS = COVERS.map((f) => gcs(`default-covers/${f}`));

/** Display city name for each entry in COVERS, in the same order. */
const COVER_CITIES: Record<(typeof COVERS)[number], string> = {
  "los-angeles_generic-hike_griffith-park.webp": "Los Angeles",
  "generic_dinner_los-angeles.webp": "Los Angeles",
  "new-york_china-town_manhattan.webp": "New York",
  "new-york_generic.webp": "New York",
  "san-francisco_generic_fish-market.webp": "San Francisco",
  "san-francisco_generic_dolores-park.webp": "San Francisco",
  "steph.kotula_utah_hiking-nature_cover.webp": "Utah",
  "new-york_williamsburg_generic.webp": "New York",
  "maisieleung_los-angeles_ktown-faves_cover.webp": "Los Angeles",
  "new-york_brooklyn_dumbo.webp": "New York",
  "new-york_catskills_upstate_wine_bonfire.webp": "New York",
  "new-york_downtown-brooklyn_generic-city.webp": "New York",
  "wenju.tseng_London_bestmuseums_cover.webp": "London",
  "new-york_les_generic-dessert.webp": "New York",
  "new-york_williamsburg_generic_domino-park.webp": "New York",
  "new-york_generic_2.webp": "New York",
  "jessicastrelioff_austin_a-perfect-day_cover.webp": "Austin",
  "los-angeles_generic_palmtrees.webp": "Los Angeles",
  "weiweiyang_ho-chi-minh-city_best-restaurants-in-town_cover.webp": "Ho Chi Minh City",
  "los-angeles_generic_japan-town.webp": "Los Angeles",
  "new-york_generic-forest-hike_catskills.webp": "New York",
  "new-york_generic_5.webp": "New York",
  "portland_maine_generic.webp": "Portland, ME",
  "los-angeles_venice-canals.webp": "Los Angeles",
  "mexico_generic.webp": "Mexico",
  "new-york_empire-state.webp": "New York",
  "new-york_generic_4.webp": "New York",
  "new-york_generic_asian-food.webp": "New York",
  "new-york_generic-brunch.webp": "New York",
  "portland_oregon_generic-park_generic.webp": "Portland, OR",
  "san-francisco_generic_twin-peaks.webp": "San Francisco",
  "los-angeles_larchmont_generic-market_fruits.webp": "Los Angeles",
  "san-francisco_generic.webp": "San Francisco",
  "new-york_generic_3.webp": "New York",
  "new-york_generic_greek_brooklyn.webp": "New York",
  "new-york_generic_wine.webp": "New York",
  "new-york_west-village_cafe-tola.webp": "New York",
  "japan_generic-asia.webp": "Japan",
  "los-angeles_robata_generic-sushi.webp": "Los Angeles",
  "new-york_manhattan_oculus.webp": "New York",
};

export interface DefaultCover {
  url: string;
  city: string;
}

/** All default cover photos, paired with their display city name. */
export function getAllCovers(): DefaultCover[] {
  return COVERS.map((f, i) => ({ url: COVER_URLS[i], city: COVER_CITIES[f] }));
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** "New York" → "new-york", "Ho Chi Minh City" → "ho-chi-minh-city" */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, " ") // strip punctuation (commas, periods, etc)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Normalize a city string for matching. Drops any state/country suffix after
 * a comma so "New York, NY" → "new-york", "Portland, OR" → "portland".
 */
function normalizeCity(city: string): string {
  const primary = city.split(",")[0];
  return normalize(primary);
}

/** Pull meaningful keywords from a playlist name, ignoring short/common words. */
const STOP_WORDS = new Set([
  "a", "an", "the", "my", "our", "your", "in", "of", "and", "to", "for",
  "at", "on", "is", "it", "best", "top", "fave", "faves", "favorite",
  "favorites", "favourite", "favourites", "guide", "list", "perfect", "day",
]);

/** Crude stemmer so "hikes"/"hike", "bakeries"/"bakery" match the same cover. */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

function extractKeywords(name: string): string[] {
  return normalize(name)
    .split(/[-_\s]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map(stem);
}

/** Tokenize a cover filename into stemmed word-ish parts for keyword matching. */
function fileTokens(filename: string): string[] {
  return filename
    .replace(/\.[a-z]+$/i, "")
    .split(/[-_]+/)
    .filter((w) => w.length > 2)
    .map(stem);
}

function fileMatchesKeyword(tokens: string[], keyword: string): boolean {
  return tokens.some(
    (t) => t === keyword || t.includes(keyword) || keyword.includes(t),
  );
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Swap a cover photo URL from the "full" (hero) derivative to the "thumb"
 * (grid/carousel) one, for uploads made after the resize-on-upload pipeline
 * shipped. Falls back to the original URL for anything that doesn't match
 * that naming scheme (default covers, legacy uploads, non-http paths).
 */
export function getThumbCoverUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const thumbUrl = url.replace(/-full\.([a-z0-9]+)(\?.*)?$/i, "-thumb.$1$2");
  return thumbUrl;
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

/**
 * Pick a default cover photo for a playlist.
 *
 * Fallback tiers (from Obsidian spec):
 *  1. City match — filename contains the playlist's city
 *  2. Generic + keyword — "generic" filename matching a keyword in the playlist name
 *  3. Pure generic — any filename containing "generic"
 *  4. Ultimate fallback — any cover at all
 */
export function getDefaultCover(city: string, playlistName?: string): string {
  const cityKey = normalizeCity(city);
  const lowered = COVERS.map((f) => f.toLowerCase());
  const tokenized = lowered.map(fileTokens);

  // Tier 1: city match
  const cityIndices = lowered.reduce<number[]>((acc, f, i) => {
    if (f.includes(cityKey)) acc.push(i);
    return acc;
  }, []);

  if (cityIndices.length) {
    // Within city matches, try keyword refinement
    if (playlistName) {
      const keywords = extractKeywords(playlistName);
      const refined = cityIndices.filter((i) =>
        keywords.some((k) => fileMatchesKeyword(tokenized[i], k)),
      );
      if (refined.length) return COVER_URLS[randomPick(refined)];
    }
    return COVER_URLS[randomPick(cityIndices)];
  }

  // A file is "city-agnostic" when its first underscore segment is "generic".
  // This avoids picking e.g. `new-york_generic_wine.png` as a fallback for
  // a city with no match.
  const isPureGeneric = (f: string) => f.split("_")[0] === "generic";

  // Tier 2: generic + keyword from playlist name
  if (playlistName) {
    const keywords = extractKeywords(playlistName);
    const genericKeyword = lowered.reduce<number[]>((acc, f, i) => {
      if (
        isPureGeneric(f) &&
        keywords.some((k) => fileMatchesKeyword(tokenized[i], k))
      ) {
        acc.push(i);
      }
      return acc;
    }, []);
    if (genericKeyword.length) return COVER_URLS[randomPick(genericKeyword)];
  }

  // Tier 3: pure generic (filename starts with "generic_")
  const generics = lowered.reduce<number[]>((acc, f, i) => {
    if (isPureGeneric(f)) acc.push(i);
    return acc;
  }, []);
  if (generics.length) return COVER_URLS[randomPick(generics)];

  // Tier 4: anything
  return randomPick(COVER_URLS);
}
