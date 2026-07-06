export interface ParsedSpotLine {
  name: string;
  notes?: string;
}

const DELIMITERS = [",", " – ", " — ", " - ", ":", "|"];
// Require at least this many lines to agree before adopting a delimiter globally,
// so a single stray comma in one address doesn't hijack parsing for the whole list.
const MIN_DELIMITER_LINES = 2;

/**
 * Splits a pasted list of spots into { name, notes } pairs. Detects whichever
 * delimiter (comma, dash, colon, pipe) the majority of lines actually use,
 * instead of assuming comma — and always treats a trailing "(...)" as notes,
 * since parentheses are unambiguous unlike delimiters that can appear in names.
 */
export function parseSpotLines(text: string): ParsedSpotLine[] {
  const rawLines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const stripped = rawLines.map((line) => {
    const m = line.match(/^(.*)\(([^)]+)\)\s*$/);
    return m ? { line: m[1].trim(), parenNote: m[2].trim() } : { line, parenNote: undefined as string | undefined };
  });

  const counts = DELIMITERS.map((d) => ({
    d,
    count: stripped.filter(({ line }) => line.includes(d)).length,
  }));
  const winner = counts.sort((a, b) => b.count - a.count)[0];
  const delimiter = winner.count >= MIN_DELIMITER_LINES ? winner.d : null;

  return stripped.map(({ line, parenNote }) => {
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
}
