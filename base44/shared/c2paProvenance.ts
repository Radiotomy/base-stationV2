// Tier 2 foreign-provenance reader — C2PA / Content Credentials.
//
// Tier 1 reads what the encoder happened to leave behind. Tier 2 reads what a
// tool DELIBERATELY attached: a C2PA manifest store, which names the claim
// generator, the actions taken (created, opened, converted, placed), and the
// ingredient chain — the earlier files this one was assembled from. When a
// generative tool is C2PA-aware, its own manifest says so far more directly
// than any classifier could.
//
// Deliberate limits, stated rather than hidden:
//   • We read the manifest, we do NOT cryptographically validate its signature.
//     A manifest is a CLAIM by the tool that wrote it, and an unsigned-but-
//     verified distinction matters, so every result carries validated:false.
//   • Absence of a manifest means absence of a manifest. The overwhelming
//     majority of audio in the world carries none. It is never a finding
//     against the creator.
//   • Nothing here may change a disclosure label or the Creative Ownership
//     Score. This is read-only evidence for human review.

import { rangeFetch } from './foreignProvenance.ts';

const dec = (bytes) => new TextDecoder('latin1').decode(bytes);

// Actions a C2PA manifest can assert. The AI-relevant ones are the reason
// Tier 2 exists at all — a tool that generated audio and is honest about it
// writes them itself.
const AI_ACTIONS = new Set([
  'c2pa.created',
  'c2pa.edited',
  'c2pa.converted',
  'c2pa.opened',
  'c2pa.placed',
  'c2pa.transcoded',
  'c2pa.repackaged',
  'c2pa.filtered',
  'c2pa.drawing',
]);

const GENERATIVE_HINTS = [
  'digitalSourceType',
  'trainedAlgorithmicMedia',
  'compositeWithTrainedAlgorithmicMedia',
  'algorithmicMedia',
];

// CBOR text string sitting immediately after a map key.
function readCborText(view, at) {
  const b = view[at];
  if (b === undefined) return '';
  let len = -1;
  let start = at + 1;
  if (b >= 0x60 && b <= 0x77) len = b - 0x60;
  else if (b === 0x78) { len = view[at + 1]; start = at + 2; }
  else if (b === 0x79) { len = (view[at + 1] << 8) | view[at + 2]; start = at + 3; }
  if (len <= 0 || len > 512) return '';
  return dec(view.subarray(start, start + len)).replace(/[^\x20-\x7e]/g, '').trim();
}

function findAll(text, needle) {
  const hits = [];
  let i = text.indexOf(needle);
  while (i > -1) { hits.push(i); i = text.indexOf(needle, i + 1); }
  return hits;
}

function valueAfterKey(view, text, key) {
  for (const at of findAll(text, key)) {
    const val = readCborText(view, at + key.length);
    if (val) return val;
  }
  return '';
}

/** Parse a C2PA manifest store out of raw container bytes. */
export function parseC2pa(headBuf, tailBuf) {
  const parts = [new Uint8Array(headBuf)];
  if (tailBuf) parts.push(new Uint8Array(tailBuf));

  let present = false;
  let claimGenerator = '';
  const actions = new Set();
  const softwareAgents = new Set();
  const generativeHints = new Set();
  const ingredientTitles = new Set();
  let ingredientCount = 0;

  for (const view of parts) {
    const text = dec(view);
    // A manifest store is a JUMBF superbox whose label is 'c2pa'
    if (!(text.includes('jumb') && text.includes('c2pa'))) continue;
    present = true;

    claimGenerator = claimGenerator
      || valueAfterKey(view, text, 'claim_generator_info')
      || valueAfterKey(view, text, 'claim_generator');

    for (const at of findAll(text, 'c2pa.')) {
      const m = /^c2pa\.[a-zA-Z_]+/.exec(text.slice(at, at + 40));
      if (m && AI_ACTIONS.has(m[0])) actions.add(m[0]);
    }

    for (const hint of GENERATIVE_HINTS) {
      if (text.includes(hint)) generativeHints.add(hint);
    }

    for (const at of findAll(text, 'softwareAgent')) {
      const v = readCborText(view, at + 'softwareAgent'.length);
      if (v) softwareAgents.add(v);
    }

    // Ingredients = the files this one was assembled from
    ingredientCount += findAll(text, 'c2pa.ingredient').length;
    for (const at of findAll(text, 'relationship')) {
      const rel = readCborText(view, at + 'relationship'.length);
      if (rel === 'parentOf' || rel === 'componentOf') {
        const title = valueAfterKey(view, text.slice(at, at + 400), 'title');
        if (title) ingredientTitles.add(title);
      }
    }
  }

  if (!present) {
    return {
      tier: 2,
      standard: 'c2pa',
      present: false,
      validated: false,
      advisory: true,
      summary: 'No Content Credentials (C2PA) manifest is attached to this file. Most audio carries none — this is not a finding about how the episode was made.',
      scanned_at: new Date().toISOString(),
    };
  }

  const claims = {
    claim_generator: claimGenerator || undefined,
    actions: actions.size ? [...actions] : undefined,
    software_agents: softwareAgents.size ? [...softwareAgents] : undefined,
    generative_indicators: generativeHints.size ? [...generativeHints] : undefined,
    ingredient_count: ingredientCount || undefined,
    ingredient_titles: ingredientTitles.size ? [...ingredientTitles].slice(0, 12) : undefined,
  };
  for (const k of Object.keys(claims)) if (claims[k] === undefined) delete claims[k];

  const bits = [];
  if (claimGenerator) bits.push(`written by ${claimGenerator}`);
  if (actions.size) bits.push(`${actions.size} declared action(s)`);
  if (ingredientCount) bits.push(`${ingredientCount} ingredient(s)`);

  return {
    tier: 2,
    standard: 'c2pa',
    present: true,
    validated: false,
    advisory: true,
    claims,
    summary: bits.length
      ? `Content Credentials found: ${bits.join(', ')}.`
      : 'A Content Credentials manifest is attached but carried no readable claim fields.',
    caveat: 'Read as attached, not cryptographically validated. These are statements made by the tool that wrote the manifest — they never override the creator\'s attestation.',
    scanned_at: new Date().toISOString(),
  };
}

/** Fetch the header/footer bytes a manifest store can live in and parse them. */
export async function scanC2paFromUrl(url) {
  const headRes = await rangeFetch(url, 'bytes=0-524287');
  if (!headRes.ok && headRes.status !== 206) throw new Error(`Could not read audio (${headRes.status})`);
  const headBuf = await headRes.arrayBuffer();

  // In MP4/M4A the manifest often sits in a trailing uuid box
  let tailBuf = null;
  const total = Number(headRes.headers.get('content-range')?.split('/')?.[1] || 0);
  if (total > 524288) {
    const tailRes = await rangeFetch(url, `bytes=${Math.max(0, total - 262144)}-${total - 1}`).catch(() => null);
    if (tailRes?.ok || tailRes?.status === 206) tailBuf = await tailRes.arrayBuffer();
  }

  return parseC2pa(headBuf, tailBuf);
}