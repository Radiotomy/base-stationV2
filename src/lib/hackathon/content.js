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
  'BASE Station opens the same live Nexus document your Audiotool desktop has open and writes to it in real time — devices, note regions, automation, patterns — while a parallel provenance pipeline scores who did the creative work and forensically watermarks the exported master.';

export const CATEGORIES = [
  {
    num: '01', short: 'Songstarter', title: 'Discovery & Ideation',
    blurb: 'From blank page to first idea, fast — every starter lands on the live Audiotool timeline in one click.',
    features: [
      'Vibe → Session one-click starters',
      'Instrument Chain builder: describe a sound, get synth → FX → mixer',
      'BASE Forge AI loops and ElevenLabs SFX sent to the timeline',
      'Semantic "search by sound", Freesound and community library',
      'Audius remix sourcing and remix contests',
    ],
    routes: ['/audiotool', 'Songstarter module'],
  },
  {
    num: '02', short: 'Composition', title: 'Theory & AI Composition',
    blurb: 'Tools that understand musical structure — they develop craft instead of just generating output.',
    features: [
      'Chord Progression writer with theory-by-doing chord pads',
      'LeadSheet chord import into the live session',
      'MIDI Co-Producer: rewrite any region, one-click undo',
      'Cantor vocals rendered from composed melodies',
      'Cadence beds from literal chord progressions',
    ],
    routes: ['/studios/audiotool/harmony', '/lead-sheet-studio', '/scribe-studio'],
  },
  {
    num: '03', short: 'Sound Design', title: 'Synthesis & Texture',
    blurb: 'Instruments and sound shapers wired straight into Audiotool devices at the signal level.',
    features: [
      'BASE Foundry node-based DSP studio with Drone Texture node',
      'Foundry Remote: Foundry knobs move live Audiotool knobs',
      'Optional cable mirroring onto live Audiotool routing',
      'Beatbox 8, Bassline and Tonematrix pattern generators',
    ],
    routes: ['/foundry', '/studios/audiotool/beat'],
  },
  {
    num: '04', short: 'Play & Live', title: 'Music Games',
    blurb: 'Sound that responds to action — the crowd builds the next section while the set keeps playing.',
    features: [
      'Audience Co-Op: /generate sfx | loop | midi from venue chat',
      'Live Studio over Streamr with sub-second sync',
      'Portals 3D venues with audio-reactive stages',
      'Live quests, XP, reactions and triggered drops',
    ],
    routes: ['/live-studio', '/venues'],
  },
  {
    num: '05', short: 'DAW Integration', title: 'Connect',
    blurb: 'A true Nexus peer client — Audiotool talks to provenance, Audius and the chain.',
    features: [
      'OAuth + live DocumentService read/write, no polling',
      'Session Explorer with toggles and deep links',
      'BASE Nexus Bridge: native protobuf ingestion',
      'Audius import/export, ID3 / DDEX, on-chain Base anchor',
    ],
    routes: ['/audiotool', '/verify'],
  },
  {
    num: '06', short: 'Growth', title: 'Marketing & Distribution',
    blurb: 'From finished track to found audience — protected, registered and distributed.',
    features: [
      'Protect & Register: watermark, COS, C2PA, anchor, Audius',
      'Promo Studio and social media automation',
      'Fan clubs, collectibles, tipping and creator store',
      'Radio, charts, playlists and challenges',
    ],
    routes: ['/promo-studio', '/social-automation', '/charts'],
  },
];

export const HIGHLIGHTS = [
  'Peer client, not a wrapper — same Nexus stream as the Audiotool desktop.',
  'AI-origin telemetry: every AI invocation logged privately; undone AI work is deleted.',
  'BASE Mark forensic watermark with a published benchmark, failures included.',
  'Creative Ownership Score with RIAA/IFPI-aligned labels and C2PA manifest.',
  'All watermark math, weights and API keys stay server-side.',
];

export const LINKS = [
  { label: 'Live app', to: '/' },
  { label: 'Audiotool Bridge', to: '/audiotool' },
  { label: 'Watermark verifier', to: '/verify' },
  { label: 'Docs', to: '/docs' },
];