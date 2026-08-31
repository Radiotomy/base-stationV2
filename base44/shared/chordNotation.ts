/**
 * Chord chart normalization — writer's notation to Harte ROOT:TYPE.
 *
 * A LeadSheet stores `chord_chart` EXACTLY as the writer typed it ('C | Am | F | G7'),
 * because the human's own notation is the artifact being attested to. The Cadence
 * engine needs Harte notation ('C A:min F G:7'). This module is the bridge, and it
 * lives in shared/ rather than inside the render function so the stored score is
 * never rewritten to suit an engine.
 *
 * Conversion is intentionally conservative: anything unrecognised is passed through
 * untouched for the engine to interpret, rather than guessed at here. A silent
 * mis-normalization ('Cm7' read as 'C major') would corrupt the authored harmony
 * while leaving every log looking healthy.
 */

/** Longest-first so 'maj7' is matched before 'maj', 'min7' before 'min'. */
const SUFFIX_MAP: Array<[string, string]> = [
  ['maj13', 'maj13'],
  ['maj11', '11'],
  ['maj9', 'maj9'],
  ['maj7', 'maj7'],
  ['maj6', 'maj6'],
  ['min13', '13'],
  ['min11', 'min11'],
  ['min9', 'min9'],
  ['min7', 'min7'],
  ['min6', 'min6'],
  ['minmaj7', 'minmaj7'],
  ['mmaj7', 'minmaj7'],
  ['dim7', 'dim7'],
  ['half-dim', 'hdim7'],
  ['hdim7', 'hdim7'],
  ['sus4', 'sus4'],
  ['sus2', 'sus2'],
  ['add9', '9'],
  ['m13', '13'],
  ['m11', 'min11'],
  ['m9', 'min9'],
  ['m7b5', 'hdim7'],
  ['m7', 'min7'],
  ['m6', 'min6'],
  ['maj', 'maj'],
  ['min', 'min'],
  ['dim', 'dim'],
  ['aug', 'aug'],
  ['sus', 'sus4'],
  ['13', '13'],
  ['11', '11'],
  ['9', '9'],
  ['7', '7'],
  ['6', 'maj6'],
  ['5', '5'],
  ['m', 'min'],
  ['°', 'dim'],
  ['+', 'aug'],
  ['Δ', 'maj7'],
];

const ROOT_RE = /^[A-G][#b]?/;

/** 'Am7' -> 'A:min7'. Already-Harte tokens and unknowns pass through. */
export function normalizeChordSymbol(raw: string): string {
  const token = (raw || '').trim();
  if (!token) return '';
  if (token.includes(':')) return token;            // already Harte
  if (/^(N|NC|N\.C\.)$/i.test(token)) return 'N';   // no chord

  const rootMatch = token.match(ROOT_RE);
  if (!rootMatch) return token;                     // not a chord — leave it alone
  const root = rootMatch[0];

  // Slash bass is dropped: chroma has no register, so an inversion cannot be
  // represented. Kept out of the suffix match so 'C/E' does not read as a type.
  let suffix = token.slice(root.length).split('/')[0].trim();
  if (!suffix) return `${root}:maj`;

  const lower = suffix.toLowerCase();
  for (const [pattern, harte] of SUFFIX_MAP) {
    const p = pattern.toLowerCase();
    if (lower === p) return `${root}:${harte}`;
  }
  // Unmatched extension: hand the raw suffix to the engine, which degrades to the
  // parent triad. Guessing here would be a silent rewrite of authored harmony.
  return `${root}:${suffix}`;
}

/**
 * Full chart to engine notation.
 *
 * Bars may be separated by '|' or whitespace; a comma subdivides one bar and is
 * preserved, since the engine reads it as a within-bar split.
 */
export function normalizeChordChart(chart: string): string {
  const bars = (chart || '')
    .replace(/\|/g, ' ')
    .split(/\s+/)
    .map((b) => b.trim())
    .filter(Boolean);

  return bars
    .map((bar) =>
      bar
        .split(',')
        .map((slot) => normalizeChordSymbol(slot))
        .filter(Boolean)
        .join(','),
    )
    .filter(Boolean)
    .join(' ');
}

/** Bars in the chart — used to sanity-check a chart before spending GPU time. */
export function countBars(chart: string): number {
  return (chart || '').replace(/\|/g, ' ').split(/\s+/).filter(Boolean).length;
}