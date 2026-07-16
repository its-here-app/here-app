/**
 * Read-only dry run for backfilling spots.city_id (international pass).
 *
 * Imports the real parsing/matching logic from src/lib/cityResolution.ts
 * directly — no separate implementation to drift out of sync with the app's
 * live write path (src/lib/services/cities.ts#resolveCityIdFromAddress).
 *
 * This script never writes to the database. It reports what WOULD change
 * and dumps the computed (spot id -> city id) pairs to a JSON file so a
 * migration can be generated from them after review.
 *
 * Usage: npx tsx scripts/backfill-spots-city-ids.ts
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  parseAddressLocation,
  normalizeForMatch,
  canonicalizeCountry,
} from "../src/lib/cityResolution";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

interface CityRow {
  id: string;
  display_name: string;
}

interface SpotRow {
  id: number;
  address: string;
  city_id: string | null;
}

function findCityId(address: string, cities: CityRow[]): CityRow | null {
  const parsed = parseAddressLocation(address);
  if (!parsed) return null;

  if (parsed.kind === "us") {
    return (
      cities.find((c) => {
        const segments = c.display_name.split(",").map((s) => s.trim());
        if (segments.length !== 2) return false;
        const [cityPart, statePart] = segments;
        return (
          normalizeForMatch(cityPart) === normalizeForMatch(parsed.city) &&
          statePart.toUpperCase() === parsed.state
        );
      }) ?? null
    );
  }

  return (
    cities.find((c) => {
      const segments = c.display_name.split(",").map((s) => s.trim());
      const cityPart = segments[0];
      const countryPart = segments[segments.length - 1];
      return (
        normalizeForMatch(cityPart) === normalizeForMatch(parsed.citySegment) &&
        canonicalizeCountry(countryPart) === parsed.country
      );
    }) ?? null
  );
}

async function fetchAll<T>(
  table: string,
  select: string,
  filter?: (q: any) => any
): Promise<T[]> {
  const pageSize = 1000;
  let offset = 0;
  const all: T[] = [];
  while (true) {
    let q = supabase.from(table).select(select).range(offset, offset + pageSize - 1) as any;
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function main() {
  const cities = await fetchAll<CityRow>("cities", "id, display_name");
  const spots = await fetchAll<SpotRow>("spots", "id, address, city_id", (q) =>
    q.is("city_id", null)
  );

  const pairs: { id: number; city_id: string; address: string; matchedTo: string }[] = [];
  const stillUnmatched: string[] = [];

  for (const spot of spots) {
    const match = findCityId(spot.address, cities);
    if (match) {
      pairs.push({
        id: spot.id,
        city_id: match.id,
        address: spot.address,
        matchedTo: match.display_name,
      });
    } else {
      stillUnmatched.push(spot.address);
    }
  }

  console.log(`total spots with city_id IS NULL: ${spots.length}`);
  console.log(`newly matched: ${pairs.length}`);
  console.log(`still unmatched: ${stillUnmatched.length}`);

  console.log(`\n--- sample of newly matched (40) ---`);
  for (const p of pairs.slice(0, 40)) {
    console.log(`  ${p.address}\n    -> ${p.matchedTo}`);
  }

  console.log(`\n--- sample of still unmatched (40) ---`);
  for (const a of stillUnmatched.slice(0, 40)) {
    console.log(`  ${a}`);
  }

  const outPath =
    process.env.BACKFILL_OUT_PATH ??
    "/private/tmp/claude-501/-Users-mimilee-Documents-here-here-demo/2506ac6f-4a10-44be-932d-d120ad4b2f27/scratchpad/spots-city-id-backfill-pairs.json";
  writeFileSync(outPath, JSON.stringify(pairs, null, 2));
  console.log(`\nWrote ${pairs.length} pairs to ${outPath} for migration generation. No database writes made.`);
}

main();
