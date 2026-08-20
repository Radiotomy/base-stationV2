/**
 * The 8 performance venues an artist can pick from — display copy only.
 *
 * The 3D truth (Portals template, internal scene name, lighting rig, night mode)
 * lives server-side in base44/shared/venuePresets.ts. Keys match exactly, so this
 * file can be re-worded freely without touching how a room is built.
 */
export const VENUE_TEMPLATES = [
  {
    key: 'festival_stage',
    emoji: '🎪',
    name: 'Festival Stage',
    genre: 'Festival / Rock',
    lighting: 'Dual white spotlights, day mode',
    description: 'A wide mainstage with a huge screen — built for big sets and showcases.',
  },
  {
    key: 'electronic_club',
    emoji: '🔮',
    name: 'Electronic Club',
    genre: 'Electronic / DJ',
    lighting: 'Purple + cyan strobes, night mode',
    description: 'A dark, strobe-lit space for DJ sets and late-night drops.',
  },
  {
    key: 'intimate_acoustic',
    emoji: '🎸',
    name: 'Intimate Acoustic',
    genre: 'Acoustic / Singer-Songwriter',
    lighting: 'Warm gold key light, day mode',
    description: 'A small warm room where the song and the voice are the whole show.',
  },
  {
    key: 'jazz_lounge',
    emoji: '🎷',
    name: 'Jazz Lounge',
    genre: 'Jazz / Soul / R&B',
    lighting: 'Dual amber spotlights, day mode',
    description: 'An elegant amber-lit lounge for late sets and listening sessions.',
  },
  {
    key: 'hiphop_arena',
    emoji: '🎤',
    name: 'Hip-Hop Arena',
    genre: 'Hip-Hop / Rap',
    lighting: 'Red + white spots, night mode',
    description: 'A full arena with a towering screen for headline energy.',
  },
  {
    key: 'pop_showcase',
    emoji: '🌟',
    name: 'Pop Showcase',
    genre: 'Pop',
    lighting: 'Pink + blue spots, day mode',
    description: 'A bright, camera-ready stage for singles, premieres and showcases.',
  },
  {
    key: 'country_barn',
    emoji: '🤠',
    name: 'Country Barn',
    genre: 'Country / Folk',
    lighting: 'Warm orange light, day mode',
    description: 'A wooden saloon-style room for storytelling sets and string bands.',
  },
  {
    key: 'tropical_outdoor',
    emoji: '🌴',
    name: 'Tropical Outdoor',
    genre: 'Reggae / World',
    lighting: 'Natural light only, day mode',
    description: 'An open-air beach setting lit by daylight alone.',
  },
];

export const DEFAULT_TEMPLATE_KEY = 'festival_stage';

export function getVenueTemplate(key) {
  return VENUE_TEMPLATES.find((t) => t.key === key)
    || VENUE_TEMPLATES.find((t) => t.key === DEFAULT_TEMPLATE_KEY);
}