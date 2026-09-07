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
  "IMG_8544_VSCO.jpg",
  "barcelona_Soma_restaurant.jpg",
  "barcelona_Soma_restaurant_2.jpg",
  "barcelona_Soma_restaurant_3.jpg",
  "barcelona_park-guell_gaudi.jpg",
  "barcelona_spain-building-skyline.jpg",
  "barcelona_spain-building.jpg",
  "barcelona_spain-streets-tourist.jpg",
  "barcelona_spain-window-art.jpg",
  "barcelona_spain_gaudi_casa-batllo.jpg",
  "barcelona_spain_gaudi_casa.jpg",
  "barcelona_spain_sagrada-familia.jpg",
  "barcelona_spain_sagrada-familia_2.jpg",
  "barcelona_spain_sagrada-familia_3.jpg",
  "brighton_eye-sky-building.jpg",
  "generic-museum-london-2.jpg",
  "generic_backyard-terrace-outside.jpg",
  "generic_barcelona_cafe_coffee-shop.jpg",
  "generic_big-kid-icecream_london.jpg",
  "generic_buildings-city-london.jpg",
  "generic_coffee-shop_cafe-banana-cake.jpg",
  "generic_coffee-shop_london-2.jpg",
  "generic_coffee-shop_london.jpg",
  "generic_coffeeshop-magazine-2.jpg",
  "generic_dinner-indian-restaurant.jpg",
  "generic_dinner-romantic-bar-london-gymkhana.jpg",
  "generic_flowers-market-2.jpg",
  "generic_flowers-market-3.jpg",
  "generic_flowers-market.jpg",
  "generic_hotel-lobby-cafe.jpg",
  "generic_icecream-summer-festival.jpg",
  "generic_listening-bar-vinyl-2.jpg",
  "generic_listening-bar-vinyl.jpg",
  "generic_london-bar-sake.jpg",
  "generic_london-building-street.jpg",
  "generic_london-market-seven-dials.jpg",
  "generic_london-scones.jpg",
  "generic_london-skyline.jpg",
  "generic_margate-forts-coffee-2.jpg",
  "generic_margate-forts-coffee.jpg",
  "generic_market-flowers-2.jpg",
  "generic_market-flowers-3.jpg",
  "generic_market-flowers-4.jpg",
  "generic_matcha_tofu-dessert-asian.jpg",
  "generic_pasta-italian-restaurant_london-bancone.jpg",
  "generic_pasta-outside-london.jpg",
  "generic_pasta-outside.jpg",
  "generic_restaurant-coffee-shop-banana-bread-sandwich.jpg",
  "generic_restaurant-hummus-2.jpg",
  "generic_restaurant-italian-food-cook-2.jpg",
  "generic_restaurant-italian-food-cook.jpg",
  "generic_restaurant-italian-food.jpg",
  "generic_restaurant-meal-japanese-korean.jpg",
  "generic_restaurant-oyster-italian-terrace-patio.jpg",
  "generic_restaurant_2_barcelona.jpg",
  "generic_spain_barcelona_streets.jpg",
  "generic_spain_barcelona_streets_3.jpg",
  "generic_spanish-basque-restaurant-bread-2.jpg",
  "generic_spanish-basque-restaurant-bread.jpg",
  "generic_street-food-fried-chicken-2.jpg",
  "generic_vintage-shoreditch-shopping.jpg",
  "london_big-ben-river-thames.jpg",
  "london_canal-lake-beautiful-boats.jpg",
  "london_generic-store-old.jpg",
  "london_generic_pub-building-streets.jpg",
  "london_generic_richmond-hill-park-3.jpg",
  "london_generic_richmond-hill-park-london-2.jpg",
  "london_generic_richmond-hill-park-london.jpg",
  "london_generic_richmond-hill-park-pizza.jpg",
  "london_museum_natural-history.jpg",
  "london_peckham-arches_bar.jpg",
  "london_pub-parakeet-english-bar-2.jpg",
  "london_pub-parakeet-english-bar.jpg",
  "london_skyline-london-eye.jpg",
  "london_the-bridge-house_restaurant.jpg",
  "london_uk-street-store.jpg",
  "london_v&a-east-storehouse.jpg",
  "margate_generic-beach-2.jpg",
  "margate_generic-beach-3.jpg",
  "margate_generic-beach-icecream-uk.jpg",
  "margate_generic-beach-icecream.jpg",
  "margate_generic-beach-town-boat-2.jpg",
  "margate_generic-beach-town-street-colorful.jpg",
  "margate_generic-beach-town-street.jpg",
  "margate_generic_beach-beautiful-3.jpg",
  "margate_generic_beach-beautiful-4.jpg",
  "margate_generic_beach-beautiful.jpg",
  "new-york_central-park-lake-sky-building.jpg",
  "new-york_city-2.jpg",
  "new-york_empire-state_building-skyline.jpg",
  "new-york_generic_car_travel.jpg",
  "new-york_highline_2.jpg",
  "new-york_la-cabra_coffee-shop-matcha.jpg",
  "seven-sisters_generic_field-country-side.jpg",
  "seven-sisters_hill_lighthouse.jpg",
  "seven-sisters_hills-beach-2.jpg",
  "seven-sisters_hills-beach.jpg",
  "williamsburg_bath-house_building.jpg",
  "williamsburg_new-york_swimming-pool_bath-house.jpg",
] as const;

const COVER_URLS = COVERS.map((f) => gcs(`default-covers/${f}`));

/**
 * Display city for entries in COVERS that have one — used only for the
 * marketing rotator's pin badge. Deliberately partial: photos with no
 * identifiable place (close-up food/interior shots) are left out rather
 * than assigned a guessed city; they're still fully usable as covers via
 * getDefaultCover()'s generic/keyword matching below.
 */
const COVER_CITIES: Partial<Record<(typeof COVERS)[number], string>> = {
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
  "barcelona_Soma_restaurant.jpg": "Barcelona",
  "barcelona_Soma_restaurant_2.jpg": "Barcelona",
  "barcelona_Soma_restaurant_3.jpg": "Barcelona",
  "barcelona_park-guell_gaudi.jpg": "Barcelona",
  "barcelona_spain-building-skyline.jpg": "Barcelona",
  "barcelona_spain-building.jpg": "Barcelona",
  "barcelona_spain-streets-tourist.jpg": "Barcelona",
  "barcelona_spain-window-art.jpg": "Barcelona",
  "barcelona_spain_gaudi_casa-batllo.jpg": "Barcelona",
  "barcelona_spain_gaudi_casa.jpg": "Barcelona",
  "barcelona_spain_sagrada-familia.jpg": "Barcelona",
  "barcelona_spain_sagrada-familia_2.jpg": "Barcelona",
  "barcelona_spain_sagrada-familia_3.jpg": "Barcelona",
  "brighton_eye-sky-building.jpg": "Brighton",
  "generic-museum-london-2.jpg": "London",
  "generic_barcelona_cafe_coffee-shop.jpg": "Barcelona",
  "generic_big-kid-icecream_london.jpg": "London",
  "generic_buildings-city-london.jpg": "London",
  "generic_coffee-shop_london-2.jpg": "London",
  "generic_coffee-shop_london.jpg": "London",
  "generic_dinner-romantic-bar-london-gymkhana.jpg": "London",
  "generic_london-bar-sake.jpg": "London",
  "generic_london-building-street.jpg": "London",
  "generic_london-market-seven-dials.jpg": "London",
  "generic_london-scones.jpg": "London",
  "generic_london-skyline.jpg": "London",
  "generic_margate-forts-coffee-2.jpg": "Margate",
  "generic_margate-forts-coffee.jpg": "Margate",
  "generic_pasta-italian-restaurant_london-bancone.jpg": "London",
  "generic_pasta-outside-london.jpg": "London",
  "generic_restaurant_2_barcelona.jpg": "Barcelona",
  "generic_spain_barcelona_streets.jpg": "Barcelona",
  "generic_spain_barcelona_streets_3.jpg": "Barcelona",
  "generic_spanish-basque-restaurant-bread-2.jpg": "Spain",
  "generic_spanish-basque-restaurant-bread.jpg": "Spain",
  "generic_vintage-shoreditch-shopping.jpg": "London",
  "london_big-ben-river-thames.jpg": "London",
  "london_canal-lake-beautiful-boats.jpg": "London",
  "london_generic-store-old.jpg": "London",
  "london_generic_pub-building-streets.jpg": "London",
  "london_generic_richmond-hill-park-3.jpg": "London",
  "london_generic_richmond-hill-park-london-2.jpg": "London",
  "london_generic_richmond-hill-park-london.jpg": "London",
  "london_generic_richmond-hill-park-pizza.jpg": "London",
  "london_museum_natural-history.jpg": "London",
  "london_peckham-arches_bar.jpg": "London",
  "london_pub-parakeet-english-bar-2.jpg": "London",
  "london_pub-parakeet-english-bar.jpg": "London",
  "london_skyline-london-eye.jpg": "London",
  "london_the-bridge-house_restaurant.jpg": "London",
  "london_uk-street-store.jpg": "London",
  "london_v&a-east-storehouse.jpg": "London",
  "margate_generic-beach-2.jpg": "Margate",
  "margate_generic-beach-3.jpg": "Margate",
  "margate_generic-beach-icecream-uk.jpg": "Margate",
  "margate_generic-beach-icecream.jpg": "Margate",
  "margate_generic-beach-town-boat-2.jpg": "Margate",
  "margate_generic-beach-town-street-colorful.jpg": "Margate",
  "margate_generic-beach-town-street.jpg": "Margate",
  "margate_generic_beach-beautiful-3.jpg": "Margate",
  "margate_generic_beach-beautiful-4.jpg": "Margate",
  "margate_generic_beach-beautiful.jpg": "Margate",
  "new-york_central-park-lake-sky-building.jpg": "New York",
  "new-york_city-2.jpg": "New York",
  "new-york_empire-state_building-skyline.jpg": "New York",
  "new-york_generic_car_travel.jpg": "New York",
  "new-york_highline_2.jpg": "New York",
  "new-york_la-cabra_coffee-shop-matcha.jpg": "New York",
  "seven-sisters_generic_field-country-side.jpg": "Seven Sisters",
  "seven-sisters_hill_lighthouse.jpg": "Seven Sisters",
  "seven-sisters_hills-beach-2.jpg": "Seven Sisters",
  "seven-sisters_hills-beach.jpg": "Seven Sisters",
  "williamsburg_bath-house_building.jpg": "New York",
  "williamsburg_new-york_swimming-pool_bath-house.jpg": "New York",
};

export interface DefaultCover {
  url: string;
  city: string;
}

/** Default cover photos that have a known display city, paired with it. */
export function getAllCovers(): DefaultCover[] {
  return COVERS.flatMap((f, i) => {
    const city = COVER_CITIES[f];
    return city ? [{ url: COVER_URLS[i], city }] : [];
  });
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
