/**
 * One-time backfill of the `cities` table with the world's larger cities, so
 * the city picker can answer from our own table (see
 * src/app/api/cities/autocomplete/route.ts) instead of spending a billed
 * Places autocomplete call per keystroke pause.
 *
 * Input: a GeoNames dump (tab-separated), e.g. cities15000.txt from
 * https://download.geonames.org/export/dump/ (CC BY 4.0). It only supplies
 * *which* cities to look up; names, place IDs and `display_name` all come from
 * Places autocomplete, via the same naming code the live route uses
 * (src/lib/cityAutocomplete.ts), so rows are identical to ones users create.
 *
 * Cost: one Places autocomplete request per city not already in `cities`.
 * Existing rows are skipped before any request is made, and are never
 * modified (insert with ignoreDuplicates), so the script is safe to re-run and
 * resumes where a quota stop left off. It halts on the first OVER_QUERY_LIMIT
 * or REQUEST_DENIED.
 *
 * `is_primary`: the most populous city per (base name, country) in this run is
 * primary, mirroring the live rule "most popular city for that name within its
 * country". Cities whose base name already exists in the DB for that country
 * are skipped, so a backfilled primary never competes with an existing one.
 *
 * Safety: nothing is written unless --apply is passed, and --apply requires an
 * explicit --limit N or --all. Without --apply it still makes real Places
 * requests (default 25) so you can eyeball the matches; --plan makes none.
 *
 * API: --api new (default) uses Places API (New), a separate product from the
 * legacy API the live route calls, so the backfill uses its own quota and free
 * tier rather than users'. Enable "Places API (New)" on the key's project.
 * --compare looks the first --limit cities up in both APIs (costs legacy
 * quota too) and prints any name/place-id differences; run it before applying.
 *
 * Usage:
 *   npx tsx scripts/backfill-cities.ts --file cities15000.txt --plan           # just count
 *   npx tsx scripts/backfill-cities.ts --file cities15000.txt --compare        # legacy vs new, 25
 *   npx tsx scripts/backfill-cities.ts --file cities15000.txt                  # preview 25
 *   npx tsx scripts/backfill-cities.ts --file cities15000.txt --limit 400 --apply
 *   npx tsx scripts/backfill-cities.ts --file cities15000.txt --all --apply
 * Options: --min-population N (default 200000; capitals always included),
 *          --delay-ms N (default 120)
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  buildCitySuggestions,
  type AutocompletePrediction,
} from "../src/lib/cityAutocomplete";
import {
  normalizeForMatch,
  canonicalizeCountry,
  isUsStateAbbr,
} from "../src/lib/cityResolution";

const AUTOCOMPLETE_URL =
  "https://maps.googleapis.com/maps/api/place/autocomplete/json";
const NEW_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const file = arg("file");
const minPopulation = Number(arg("min-population") ?? 200_000);
const delayMs = Number(arg("delay-ms") ?? 120);
const apply = flag("apply");
const plan = flag("plan");
const all = flag("all");
const compareMode = flag("compare");
const api = (arg("api") ?? "new") as "legacy" | "new";
const limit = all ? Infinity : Number(arg("limit") ?? 25);

if (!file) {
  console.error("Missing --file <GeoNames cities txt>");
  process.exit(1);
}
if (api !== "new" && api !== "legacy") {
  console.error("--api must be new or legacy");
  process.exit(1);
}
if (compareMode && apply) {
  console.error("--compare never writes; drop --apply");
  process.exit(1);
}
if (apply && !all && arg("limit") === undefined) {
  console.error("--apply needs an explicit --limit N or --all");
  process.exit(1);
}

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!plan && !apiKey) {
  console.error("GOOGLE_PLACES_API_KEY is not set");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);

interface GeoCity {
  name: string;
  asciiName: string;
  countryCode: string;
  admin1: string;
  population: number;
  isCapital: boolean;
}

// GeoNames columns: 1 name, 2 asciiname, 7 feature code, 8 country code,
// 10 admin1 code, 14 population.
function parseGeoNames(path: string): GeoCity[] {
  const out: GeoCity[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    const c = line.split("\t");
    // PPLX = a section of a populated place (Manhattan, Kowloon, city
    // districts): not something people pick as their city.
    if (c[7] === "PPLX") continue;
    const population = Number(c[14]);
    const isCapital = c[7] === "PPLC";
    if (population < minPopulation && !isCapital) continue;
    out.push({
      name: c[1],
      asciiName: c[2],
      countryCode: c[8],
      admin1: c[10],
      population,
      isCapital,
    });
  }
  return out.sort((a, b) => b.population - a.population);
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
// Where Node's English region names differ from the country term Google
// returns (checked against Places autocomplete).
const GOOGLE_COUNTRY_NAMES: Record<string, string> = {
  CD: "Democratic Republic of the Congo", // Intl: "Congo - Kinshasa"
  CG: "Republic of the Congo", // Intl: "Congo - Brazzaville"
  CI: "Côte d'Ivoire", // Intl uses a curly apostrophe
  HK: "Hong Kong", // Intl: "Hong Kong SAR China"
  MO: "Macao", // Intl: "Macao SAR China"
};
const countryName = (code: string) =>
  GOOGLE_COUNTRY_NAMES[code] ?? regionNames.of(code) ?? code;

/** Key for "this base name in this country" from a stored display_name
 *  ("Portland, OR" → portland|usa, "Paris, France" → paris|france). */
function keyFromDisplayName(displayName: string): string {
  const parts = displayName.split(",").map((s) => s.trim());
  const last = parts[parts.length - 1];
  const country = isUsStateAbbr(last) ? "usa" : canonicalizeCountry(last);
  return `${normalizeForMatch(parts[0])}|${country}`;
}

function keyFromGeo(c: GeoCity): string {
  return `${normalizeForMatch(c.asciiName)}|${canonicalizeCountry(countryName(c.countryCode))}`;
}

async function loadExisting() {
  const keys = new Set<string>();
  const placeIds = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("cities")
      .select("google_place_id, display_name")
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) {
      keys.add(keyFromDisplayName(r.display_name));
      placeIds.add(r.google_place_id);
    }
    if (!data || data.length < 1000) break;
  }
  return { keys, placeIds };
}

type Lookup =
  | { kind: "match"; place_id: string; display_name: string }
  | { kind: "none" }
  | { kind: "quota"; status: string; message: string };

type Fetched =
  | { kind: "ok"; predictions: AutocompletePrediction[] }
  | { kind: "quota"; status: string; message: string };

async function fetchLegacy(input: string): Promise<Fetched> {
  const url =
    `${AUTOCOMPLETE_URL}?input=${encodeURIComponent(input)}` +
    `&types=(cities)&key=${apiKey}`;
  const data = (await (await fetch(url)).json()) as {
    status?: string;
    error_message?: string;
    predictions?: AutocompletePrediction[];
  };
  if (data.status === "OVER_QUERY_LIMIT" || data.status === "REQUEST_DENIED") {
    return { kind: "quota", status: data.status, message: data.error_message ?? "" };
  }
  return { kind: "ok", predictions: data.predictions ?? [] };
}

/**
 * Places API (New). Separate product from the legacy API the live route uses,
 * with its own quota and free tier, so the backfill doesn't eat into what
 * users need. It has no `terms` array, so predictions are reshaped into the
 * legacy form (main text + comma-split secondary text) to go through the same
 * naming code; run --compare first to confirm the names come out identical.
 */
async function fetchNew(input: string): Promise<Fetched> {
  const res = await fetch(NEW_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey!,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify({ input, includedPrimaryTypes: ["(cities)"] }),
  });
  const data = (await res.json()) as {
    error?: { status?: string; message?: string };
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }[];
  };
  if (!res.ok || data.error) {
    return {
      kind: "quota",
      status: data.error?.status ?? String(res.status),
      message: data.error?.message ?? "",
    };
  }
  const predictions = (data.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    const main = p?.structuredFormat?.mainText?.text;
    if (!p?.placeId || !main) return [];
    const secondary = p.structuredFormat?.secondaryText?.text ?? "";
    const terms = [main, ...secondary.split(",").map((t) => t.trim()).filter(Boolean)];
    return [{ place_id: p.placeId, description: p.text?.text, terms: terms.map((value) => ({ value })) }];
  });
  return { kind: "ok", predictions };
}

/** Query text qualified so the intended city outranks same-named ones. */
function inputFor(c: GeoCity): string {
  return c.countryCode === "US"
    ? `${c.name}, ${c.admin1}`
    : `${c.name}, ${countryName(c.countryCode)}`;
}

function pickMatch(c: GeoCity, predictions: AutocompletePrediction[]): Lookup {
  const isUS = c.countryCode === "US";
  const wantBase = new Set([normalizeForMatch(c.name), normalizeForMatch(c.asciiName)]);
  const wantCountry = canonicalizeCountry(countryName(c.countryCode));
  for (const p of predictions) {
    const terms = p.terms ?? [];
    if (terms.length === 0 || !p.place_id) continue;
    if (!wantBase.has(normalizeForMatch(terms[0].value))) continue;
    // City-states (Hong Kong, Singapore) come back as a single term with no
    // country; accept that only when the city's name is the country's name.
    if (terms.length === 1 && canonicalizeCountry(terms[0].value) !== wantCountry) continue;
    const last = terms[terms.length - 1].value;
    const countryOk = isUS
      ? last === "USA" && terms[1]?.value === c.admin1
      : canonicalizeCountry(last) === wantCountry;
    if (!countryOk) continue;
    // Same naming the live route produces; is_primary is decided by the caller.
    const [built] = buildCitySuggestions([p], normalizeForMatch(c.name));
    return { kind: "match", place_id: p.place_id, display_name: built.display_name };
  }
  return { kind: "none" };
}

async function lookup(c: GeoCity, which: "legacy" | "new"): Promise<Lookup> {
  const r = await (which === "new" ? fetchNew : fetchLegacy)(inputFor(c));
  return r.kind === "quota" ? r : pickMatch(c, r.predictions);
}

const describe = (r: Lookup) =>
  r.kind === "match" ? `${r.display_name} [${r.place_id}]` : r.kind === "none" ? "(no match)" : `(${r.status})`;

/** Look each city up in both APIs and print where the stored row would differ. */
async function compare(batch: GeoCity[]) {
  let same = 0;
  const diffs: string[] = [];
  for (const c of batch) {
    const [legacy, fresh] = [await lookup(c, "legacy"), await lookup(c, "new")];
    for (const r of [legacy, fresh]) {
      if (r.kind === "quota") {
        console.error(`Stopped: ${r.status} ${r.message}`);
        return;
      }
    }
    const equal =
      legacy.kind === fresh.kind &&
      (legacy.kind !== "match" ||
        (fresh.kind === "match" &&
          legacy.display_name === fresh.display_name &&
          legacy.place_id === fresh.place_id));
    if (equal) same++;
    else diffs.push(`  ${inputFor(c)}\n    legacy: ${describe(legacy)}\n    new:    ${describe(fresh)}`);
    await new Promise((res) => setTimeout(res, delayMs));
  }
  console.log(`${same}/${batch.length} identical.`);
  if (diffs.length) console.log(`Differences:\n${diffs.join("\n")}`);
}

async function main() {
  const geo = parseGeoNames(file!);
  const { keys: existingKeys, placeIds } = await loadExisting();

  // Primary = most populous per key within this run (geo is population-sorted).
  const seenKey = new Set<string>();
  const todo: (GeoCity & { primary: boolean })[] = [];
  let alreadyHave = 0;
  for (const c of geo) {
    const k = keyFromGeo(c);
    if (existingKeys.has(k)) {
      alreadyHave++;
      continue;
    }
    todo.push({ ...c, primary: !seenKey.has(k) });
    seenKey.add(k);
  }

  console.log(
    `${geo.length} cities in file (pop >= ${minPopulation} or capital); ` +
      `${alreadyHave} already in cities; ${todo.length} need a Places request.`,
  );
  if (plan) return;

  const batch = todo.slice(0, limit);
  if (compareMode) {
    console.log(`COMPARE legacy vs new (no writes): ${batch.length} cities\n`);
    return compare(batch);
  }
  console.log(
    `${apply ? "APPLYING" : "PREVIEW (no writes)"} via ${api} API: ` +
      `${batch.length} lookups, ${delayMs}ms apart\n`,
  );

  let inserted = 0;
  let unmatched = 0;
  let duplicate = 0;
  const unmatchedNames: string[] = [];

  for (const c of batch) {
    const r = await lookup(c, api);
    if (r.kind === "quota") {
      console.error(`\nStopped: ${r.status} ${r.message}`);
      break;
    }
    if (r.kind === "none") {
      unmatched++;
      unmatchedNames.push(`${c.name}, ${countryName(c.countryCode)}`);
    } else if (placeIds.has(r.place_id)) {
      duplicate++;
    } else {
      placeIds.add(r.place_id);
      console.log(`${c.primary ? "*" : " "} ${r.display_name}  (${c.population.toLocaleString()})`);
      if (apply) {
        const { error } = await supabase
          .from("cities")
          .upsert(
            { google_place_id: r.place_id, display_name: r.display_name, is_primary: c.primary },
            { onConflict: "google_place_id", ignoreDuplicates: true },
          );
        if (error) throw error;
      }
      inserted++;
    }
    await new Promise((res) => setTimeout(res, delayMs));
  }

  console.log(
    `\n${apply ? "Inserted" : "Would insert"} ${inserted}; ` +
      `${duplicate} already had that place id; ${unmatched} unmatched.`,
  );
  if (unmatchedNames.length) {
    console.log(`Unmatched (not inserted): ${unmatchedNames.join("; ")}`);
  }
  if (!apply) console.log("Re-run with --apply (and --limit N or --all) to write.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
