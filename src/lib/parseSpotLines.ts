export interface ParsedSpotLine {
  name: string;
  notes?: string;
}

const DELIMITERS = [",", " – ", " — ", " - ", ":", "|"];
// Require at least this many lines/entries to agree before adopting a pattern
// globally, so one stray match doesn't hijack parsing for the whole list.
const MIN_DELIMITER_LINES = 2;

const QUOTE_PAIRS: [string, string][] = [
  ['"', '"'],
  ["“", "”"],
  ["'", "'"],
  ["‘", "’"],
];

function isQuotedLine(line: string): boolean {
  const t = line.trim();
  return QUOTE_PAIRS.some(([open, close]) => t.length >= 2 && t.startsWith(open) && t.endsWith(close));
}

function stripQuotes(line: string): string {
  return line.trim().slice(1, -1).trim();
}

/**
 * Pulls a leading "marker" off a line — a bullet symbol (*, -, •, »...),
 * a numeric ordinal (1. / 2)), or a keyword-colon prefix (Note:, Review:) —
 * so callers can majority-vote on whichever marker a list actually uses
 * instead of assuming one. Numeric markers are normalized to "#." so
 * "1.", "2.", "3." all count as the same marker.
 */
function extractMarker(line: string): { marker: string | null; rest: string } {
  let m = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
  if (m) return { marker: "#.", rest: m[2] };

  m = line.match(/^\s*([A-Za-z]{2,12}):\s+(.*)$/);
  if (m) return { marker: `kw:${m[1].toLowerCase()}`, rest: m[2] };

  // Exclude $ from marker chars: "$$ · Chinese" is a price tier, not a bullet.
  m = line.match(/^\s*([^\w\s$]{1,3})\s+(.*)$/);
  if (m) return { marker: m[1], rest: m[2] };

  return { marker: null, rest: line };
}

function buildBlankLineBlocks(rawLines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of rawLines) {
    if (line === "") {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

/**
 * A block containing only a single line that recurs verbatim elsewhere in
 * the list (e.g. a "Reserve a table" action link repeated under several
 * restaurants) is boilerplate, not a distinct spot — real spot names don't
 * repeat word-for-word across a list. Fold it into the preceding block as
 * an extra line (tracked in `boilerplateTexts` so it's also excluded from
 * note candidates) instead of letting it become its own bogus entry that
 * fails to resolve.
 */
function mergeBoilerplateBlocks(blocks: string[][]): { blocks: string[][]; boilerplateTexts: Set<string> } {
  const singleLineCounts = new Map<string, number>();
  for (const b of blocks) {
    if (b.length === 1) singleLineCounts.set(b[0], (singleLineCounts.get(b[0]) ?? 0) + 1);
  }

  const boilerplateTexts = new Set<string>();
  const merged: string[][] = [];
  for (const b of blocks) {
    const isRepeatedBoilerplate = b.length === 1 && (singleLineCounts.get(b[0]) ?? 0) >= 2;
    if (isRepeatedBoilerplate && merged.length > 0) {
      boilerplateTexts.add(b[0]);
      merged[merged.length - 1].push(b[0]);
    } else if (!isRepeatedBoilerplate) {
      merged.push(b);
    }
  }
  return { blocks: merged, boilerplateTexts };
}

/**
 * A street address ("55 Park Pl") or "City, ST[, Country]" line ("Oakland,
 * CA, USA") — this is already recoverable via resolveSpot (Google Places),
 * so it's never eligible to be picked as the note. Rating/price/category
 * lines are deliberately NOT excluded here: Places doesn't return price,
 * and a user's rating or category callout can be a genuine note.
 */
function looksLikeAddress(line: string): boolean {
  if (/^\d+\s+\S/.test(line)) return true;
  if (/,\s*[A-Z]{2}(,\s*[A-Za-z .]+)?$/.test(line.trim())) return true;
  return false;
}

function noteCandidates(entry: string[], boilerplateTexts: Set<string>): string[] {
  return entry.slice(1).filter((line) => !looksLikeAddress(line) && !boilerplateTexts.has(line));
}

function topMarker(markers: (string | null)[]): { marker: string | null; count: number } {
  const counts = new Map<string, number>();
  for (const marker of markers) {
    if (marker) counts.set(marker, (counts.get(marker) ?? 0) + 1);
  }
  let bestMarker: string | null = null;
  let bestCount = 0;
  for (const [marker, count] of counts) {
    if (count > bestCount) {
      bestMarker = marker;
      bestCount = count;
    }
  }
  return { marker: bestMarker, count: bestCount };
}

/**
 * Phase 1: figure out how individual spot entries are separated in the
 * pasted list. Blank-line-separated blocks (when the paste genuinely has
 * them) take priority, since a marker recurring *inside* those blocks is
 * more likely a note marker (Phase 2's job) than an entry separator — e.g.
 * a "- " prefix on one review line per block shouldn't be read as splitting
 * every line into its own entry. Only when there's no blank-line structure
 * do we look for a bullet/numeric marker splitting entries one-per-line,
 * falling back to one line per entry.
 */
function groupIntoEntries(text: string): { entries: string[][]; boilerplateTexts: Set<string> } {
  const rawLines = text.split("\n").map((l) => l.trim());
  const nonBlank = rawLines.filter(Boolean);

  const rawBlocks = buildBlankLineBlocks(rawLines);
  if (rawBlocks.length >= 2) {
    const { blocks, boilerplateTexts } = mergeBoilerplateBlocks(rawBlocks);
    const { marker: bestMarker, count: bestCount } = topMarker(blocks.map((b) => extractMarker(b[0]).marker));
    if (bestMarker && bestCount >= MIN_DELIMITER_LINES) {
      return {
        entries: blocks.map((b) => [extractMarker(b[0]).rest, ...b.slice(1)]),
        boilerplateTexts,
      };
    }
    return { entries: blocks, boilerplateTexts };
  }

  const { marker: bestMarker, count: bestCount } = topMarker(nonBlank.map((line) => extractMarker(line).marker));
  if (bestMarker && bestCount >= MIN_DELIMITER_LINES) {
    const entries: string[][] = [];
    let current: string[] | null = null;
    for (const line of nonBlank) {
      const { marker, rest } = extractMarker(line);
      if (marker === bestMarker) {
        current = [rest];
        entries.push(current);
      } else if (current) {
        current.push(line);
      } else {
        current = [line];
        entries.push(current);
      }
    }
    return { entries, boilerplateTexts: new Set() };
  }

  return { entries: nonBlank.map((line) => [line]), boilerplateTexts: new Set() };
}

type NoteStrategy =
  | { type: "quoted" }
  | { type: "marked"; marker: string }
  | { type: "positional" }
  | { type: "none" };

/**
 * Phase 2 (multi-line entries only): decide which non-name line in each
 * entry holds the note. Tries quoted lines, then a recurring marker
 * (e.g. "- ", "Note:"), then a fixed position, in that order — each only
 * adopted if it actually recurs across a majority of entries, so we never
 * misfile an address or rating line as a note on a guess.
 */
function pickNoteStrategy(entries: string[][], boilerplateTexts: Set<string>): NoteStrategy {
  if (entries.length === 0) return { type: "none" };
  const threshold = Math.ceil(entries.length / 2);

  const quotedCount = entries.filter(
    (entry) => noteCandidates(entry, boilerplateTexts).filter(isQuotedLine).length === 1,
  ).length;
  if (quotedCount >= threshold) return { type: "quoted" };

  const markerVotes = new Map<string, number>();
  for (const entry of entries) {
    const markersInEntry = new Set<string>();
    for (const line of noteCandidates(entry, boilerplateTexts)) {
      const { marker } = extractMarker(line);
      if (marker) markersInEntry.add(marker);
    }
    for (const marker of markersInEntry) markerVotes.set(marker, (markerVotes.get(marker) ?? 0) + 1);
  }
  let bestMarker: string | null = null;
  let bestCount = 0;
  for (const [marker, count] of markerVotes) {
    if (count > bestCount) {
      bestMarker = marker;
      bestCount = count;
    }
  }
  if (bestMarker && bestCount >= threshold) return { type: "marked", marker: bestMarker };

  const lengths = new Set(entries.map((e) => noteCandidates(e, boilerplateTexts).length));
  if (lengths.size === 1 && !lengths.has(0)) return { type: "positional" };

  return { type: "none" };
}

function parseMultilineEntry(lines: string[], strategy: NoteStrategy, boilerplateTexts: Set<string>): ParsedSpotLine {
  const nameMatch = lines[0].match(/^(.*)\(([^)]+)\)\s*$/);
  const name = nameMatch ? nameMatch[1].trim() : lines[0].trim();
  const parenNote = nameMatch ? nameMatch[2].trim() : undefined;

  const candidates = noteCandidates(lines, boilerplateTexts);
  let blockNote: string | undefined;
  if (strategy.type === "quoted") {
    const q = candidates.find(isQuotedLine);
    if (q) blockNote = stripQuotes(q);
  } else if (strategy.type === "marked") {
    for (const line of candidates) {
      const { marker, rest: stripped } = extractMarker(line);
      if (marker === strategy.marker) {
        blockNote = stripped.trim();
        break;
      }
    }
  } else if (strategy.type === "positional") {
    const last = candidates[candidates.length - 1];
    if (last) blockNote = last.trim();
  }

  const notes = [blockNote, parenNote].filter(Boolean).join("; ") || undefined;
  return { name, notes };
}

/**
 * Splits a pasted list of spots into { name, notes } pairs. Handles both a
 * single line per spot ("Name, note" / "Name (note)") and multi-line blocks
 * per spot (e.g. a Google Maps list export: name / rating·price·category /
 * address / quoted review) — detecting which format, and which delimiter or
 * note pattern within it, the pasted list actually uses rather than
 * assuming one.
 */
export function parseSpotLines(text: string): ParsedSpotLine[] {
  const { entries, boilerplateTexts } = groupIntoEntries(text);

  const singleLines = entries.filter((e) => e.length === 1).map((e) => e[0]);
  const stripped = singleLines.map((line) => {
    const m = line.match(/^(.*)\(([^)]+)\)\s*$/);
    return m ? { line: m[1].trim(), parenNote: m[2].trim() } : { line, parenNote: undefined as string | undefined };
  });
  const counts = DELIMITERS.map((d) => ({
    d,
    count: stripped.filter(({ line }) => line.includes(d)).length,
  }));
  const winner = counts.sort((a, b) => b.count - a.count)[0];
  const delimiter = winner && winner.count >= MIN_DELIMITER_LINES ? winner.d : null;
  const singleParsed: ParsedSpotLine[] = stripped.map(({ line, parenNote }) => {
    let name = line;
    let delimNote: string | undefined;
    if (delimiter) {
      const idx = line.indexOf(delimiter);
      if (idx !== -1) {
        name = line.slice(0, idx).trim();
        delimNote = line.slice(idx + delimiter.length).trim() || undefined;
      }
    }
    const notes = [delimNote, parenNote].filter(Boolean).join("; ") || undefined;
    return { name, notes };
  });

  const strategy = pickNoteStrategy(
    entries.filter((e) => e.length > 1),
    boilerplateTexts,
  );

  let singlePtr = 0;
  return entries.map((entry) =>
    entry.length === 1 ? singleParsed[singlePtr++] : parseMultilineEntry(entry, strategy, boilerplateTexts),
  );
}
