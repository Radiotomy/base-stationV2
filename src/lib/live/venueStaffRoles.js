/**
 * Creator-facing description of the four venue staff roles.
 *
 * Placement and the actual AI briefing live server-side (shared/venueNpcs.ts) —
 * this is only what the Staff tab needs to render, kept deliberately thin so the
 * two can never disagree about anything load-bearing.
 */
export const STAFF_ROLES = [
  { key: 'host', label: 'Host', hint: 'Greets fans near the entrance and says what is playing.', defaultAnimation: 'Wave' },
  { key: 'guide', label: 'Stage Guide', hint: 'Stands by the stage and talks about the artist and the music.', defaultAnimation: '' },
  { key: 'bartender', label: 'Bartender', hint: 'Friendly background character for the bar area.', defaultAnimation: '' },
  { key: 'dancer', label: 'Hype Dancer', hint: 'Dances near the stage to keep the floor alive.', defaultAnimation: 'Jive' },
];

/** Portals' built-in avatar animations. Case-sensitive — an inexact name T-poses. */
export const NPC_ANIMATIONS = [
  { value: '', label: 'Idle' },
  { value: 'Wave', label: 'Wave' },
  { value: 'Salute', label: 'Salute' },
  { value: 'Sitting', label: 'Sitting' },
  { value: 'Jive', label: 'Jive' },
  { value: 'Salsa', label: 'Salsa' },
  { value: 'Shuffling', label: 'Shuffling' },
  { value: 'Slide n Jive', label: 'Slide n Jive' },
  { value: 'Robot', label: 'Robot' },
  { value: 'Chicken', label: 'Chicken' },
  { value: 'Can Can', label: 'Can Can' },
];