export const IMAGES = {
  hero: 'https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/2790390ce_generated_cf687966.jpg',
  studio: 'https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/29f6b6e1c_generated_a0df46ac.jpg',
  stage: 'https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/1e619d1ad_generated_ab0ffd6e.jpg',
};

export const APP_URL = 'https://basestation.live';
export const TRY_URL = 'https://basestation.live/audiotool';

export const TAGLINE =
  "BASE Station × Audiotool — a provenance-first AI music studio that works as a live peer inside Audiotool Nexus sessions, across all six Let's Build categories.";

export const INTRO =
  'BASE Station opens the same live Nexus document your Audiotool desktop has open and writes to it in real time — devices, note regions, automation, patterns, samples and cables — through three dedicated workspaces and a Songstarter hub. Every AI action is logged privately so a Creative Ownership Score can split human from machine work, and the exported master is watermarked, sealed with a C2PA manifest, anchored on Base and distributable to Audius.';

export const STEPS = [
  'Sign into Audiotool from the Bridge hub (Audiotool opens in a pop-out window beside BASE Station).',
  'Open a project, paste a link, or start from Vibe → Session or the 60s Pre-Starter.',
  'Work in Beat & Pattern, Harmony & Arrangement or Vocal Lab — each writes live to the same session.',
  'Audition locally first, then Send to Audiotool — it lands on the live timeline, on the grid.',
  'Protect & Register the export: BASE Mark watermark, ownership score, C2PA seal, Base anchor, Audius release.',
];

export const CATEGORIES = [
  {
    num: '01', short: 'Songstarter', title: 'Discovery & Ideation',
    blurb: 'From blank page to a playable song sketch in about a minute — auditioned locally, then placed on the live Audiotool timeline.',
    features: [
      '60s Pre-Starter: Cadence chord bed + Forge drums + riser, arranged, previewed, sent as a mix or stems',
      'Vibe → Session starters and the Instrument Chain builder (describe a sound → synth, FX, mixer)',
      'BASE Forge AI loops and ElevenLabs SFX dropped straight onto the timeline',
      'Semantic "search by sound", Freesound and your cross-studio library',
      'Audius remix sourcing and remix contests — entries stay linked to the contest track',
    ],
    routes: ['/audiotool', '/pre-starter'],
  },
  {
    num: '02', short: 'Composition', title: 'Theory & AI Composition',
    blurb: 'Tools that understand musical structure and build craft, rather than only generating output.',
    features: [
      'Harmony & Arrangement workspace: chord writer, theory-by-doing chord pads, song-section arrangement view',
      'Cadence beds: type a progression, a self-hosted MusicGen-Chord engine plays it literally',
      'MIDI Co-Producer: rewrite any region in words, with history and one-click undo',
      'Lead Sheet import: human-authored, hashed scores become live chord regions',
      'Cantor (DiffSinger) vocals rendered from a composed melody; Scribe score transcription',
    ],
    routes: ['/studios/audiotool/harmony', '/lead-sheet-studio', '/scribe-studio'],
  },
  {
    num: '03', short: 'Sound Design', title: 'Synthesis & Texture',
    blurb: 'Instruments and sound shapers wired into Audiotool devices at the parameter and signal level.',
    features: [
      'Beat & Pattern workspace: Beatbox 8, Bassline and Tonematrix step grids written as native patterns',
      'Automation Lane generator: describe a curve, it becomes Audiotool automation',
      'BASE Foundry node-based DSP studio with a per-project device map',
      'Foundry Remote: Foundry knobs move live Audiotool knobs, with optional cable mirroring',
      'Vocal Lab: record takes, Kits.ai voice conversion and AI harmony layers',
    ],
    routes: ['/studios/audiotool/beat', '/foundry', '/studios/audiotool/vocal'],
  },
  {
    num: '04', short: 'Play & Live', title: 'Music Games',
    blurb: 'Sound that responds to action — the crowd builds the next section while the set keeps playing.',
    features: [
      'Audience Co-Op: /generate sfx | loop | midi from venue chat into the live session',
      'Live Studio over Streamr with synced playback',
      'Portals 3D venues with audio-reactive stages and idle playlists',
      'Live quests, XP, reactions, badges and triggered drops',
    ],
    routes: ['/live-studio', '/venues'],
  },
  {
    num: '05', short: 'DAW Integration', title: 'Connect',
    blurb: 'A true Nexus peer client — Audiotool connected to provenance, Audius, a multitrack editor and the chain.',
    features: [
      'OAuth + live document read/write — no polling, changes flow both ways',
      'Session Explorer with family colour coding, AI-origin markers, toggles and deep links',
      'Collaborators panel with project roles; shared workspace transport',
      'SUB-Station hand-off: move stems and Cadence beds into BASE Station\'s own multitrack editor',
      'BASE Nexus Bridge protobuf ingestion; ID3 / DDEX export; Audius import/export',
    ],
    routes: ['/audiotool', '/sub-station', '/verify'],
  },
  {
    num: '06', short: 'Growth', title: 'Marketing & Distribution',
    blurb: 'From finished track to found audience — protected, registered and distributed.',
    features: [
      'Protect & Register: watermark → ownership score → C2PA seal → Base anchor → Audius',
      'Audius ↔ chain bridge: the release and its on-chain proof point at each other',
      'Promo Studio, social cards and social media automation',
      'Fan clubs, collectibles, non-custodial tipping and creator store',
      'Radio, charts, playlists and challenges',
    ],
    routes: ['/promo-studio', '/social-automation', '/charts'],
  },
];

export const HIGHLIGHTS = [
  'Peer client, not a wrapper — the same Nexus document stream as the Audiotool desktop.',
  'AI-origin telemetry: every AI invocation is logged privately; undone AI work is deleted so it never counts against the creator.',
  'Live Nexus Contribution Meter shows the human vs AI split while you work.',
  'BASE Mark forensic watermark cascade with a published benchmark, failures included.',
  'Creative Ownership Score with RIAA/IFPI-aligned labels, DDEX attribution and a C2PA manifest.',
  'Watermark math, scoring weights and API keys stay server-side.',
];

// What BASE Station adds that Audiotool itself doesn't offer.
export const BEYOND = [
  'Mobile & tablet session access: Audiotool\'s own pages don\'t load on phones, but every BASE Station tool does. Sign into the Audiotool Bridge from BASE Station and keep working on your project from a phone or tablet — patterns, chords, loops, vocals and samples still push live into the session. Only Audiotool\'s in-browser interface is unavailable on mobile.',
  'Authorship provenance: a hashed lead sheet proves the melody and chords were human-written before any AI render.',
  'Forensic watermarking and a public verifier that can trace a file back to its registered source.',
  'On-chain Base anchoring of the delivered, watermarked file — not the raw export.',
  'Self-hosted engines: Cadence (chord beds), Cantor (singing), Sever (stem separation) plus in-browser separation.',
  'Kits.ai voice conversion and harmonies on a shared, rate-limited queue.',
  'Direct Audius publishing, remix-contest entries and chart placement.',
  'SUB-Station multitrack editor with split sheets and ownership hand-off.',
];

export const LINKS = [
  { label: 'Live app', to: '/' },
  { label: 'Audiotool Bridge', to: '/audiotool' },
  { label: '60s Pre-Starter', to: '/pre-starter' },
  { label: 'Watermark verifier', to: '/verify' },
  { label: 'Docs', to: '/docs' },
];