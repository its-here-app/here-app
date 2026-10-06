/**
 * One-time backfill of the `cities` table with the world's larger cities, so
 * the city picker can answer from our own table (see
 * src/app/api/cities/autocomplete/route.ts) instead of spending a billed
 * Places autocomplete call per keystroke pause.
 *
 * Input: a GeoNames dump (tab-separated), e.g. cities15000.txt from
 * https://download.geonames.org/export/dump/ (CC BY 4.0). It only supplies
 * *which* cities to look up; names, place IDs and `display_name` all come from
 * Places autocomplete via the same naming code the live route uses
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
 * Usage:
 *   npx tsx scripts/backfill-cities.ts --file cities15000.txt --plan           # just count
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
const limit = all ? Infinity : Number(arg("limit") ?? 25);

if (!file) {
  console.error("Missing --file <GeoNames cities txt>");
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
const countryName = (code: string) => regionNames.of(code) ?? code;

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

async function lookup(c: GeoCity): Promise<Lookup> {
  const isUS = c.countryCode === "US";
  // Qualify the input so the intended city outranks same-named ones.
  const input = isUS ? `${c.name}, ${c.admin1}` : `${c.name}, ${countryName(c.countryCode)}`;
  const url =
    `${AUTOCOMPLETE_URL}?input=${encodeURIComponent(input)}` +
    `&types=(cities)&key=${apiKey}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    predictions?: AutocompletePrediction[];
  };
  if (data.status === "OVER_QUERY_LIMIT" || data.status === "REQUEST_DENIED") {
    return { kind: "quota", status: data.status, message: data.error_message ?? "" };
  }

  const wantBase = new Set([normalizeForMatch(c.name), normalizeForMatch(c.asciiName)]);
  const wantCountry = canonicalizeCountry(countryName(c.countryCode));
  for (const p of data.predictions ?? []) {
    const terms = p.terms ?? [];
    if (terms.length < 2 || !p.place_id) continue;
    if (!wantBase.has(normalizeForMatch(terms[0].value))) continue;
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
  console.log(
    `${apply ? "APPLYING" : "PREVIEW (no writes)"}: ${batch.length} lookups, ${delayMs}ms apart\n`,
  );

  let inserted = 0;
  let unmatched = 0;
  let duplicate = 0;
  const unmatchedNames: string[] = [];

  for (const c of batch) {
    const r = await lookup(c);
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
