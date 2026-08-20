// The 8 BASE Station venue presets — the single source of truth for what a
// "venue template" physically is inside Portals.
//
// A preset is three things, and they are deliberately kept together because a
// look only reads correctly when all three match:
//   1. `portalTemplate` — the template name passed to /rooms/create (documented list)
//   2. `roomBase`       — the INTERNAL scene name that same template produces.
//                         Verified by creating one room per template and reading
//                         settings.roomBase back. This is what makes switching a
//                         preset on an EXISTING room possible: /rooms/create can
//                         only be used once, but settings.roomBase can be written
//                         through room data, so an artist can change worlds without
//                         losing their room id, branding or fan link.
//   3. lighting rig + night mode — the stage look.
//
// Rig items live in BASE Station's reserved id range 100-149 so applying a new
// preset can strip the previous rig without touching anything the artist built
// themselves.

export const RIG_ID_MIN = 100;
export const RIG_ID_MAX = 149;

// Straight-down spotlight, and a down-tilted (45°) one for cross-stage keys.
const DOWN = { x: 0.7071, y: 0, z: 0, w: 0.7071 };
const TILT = { x: 0.3827, y: 0, z: 0, w: 0.9239 };

export interface VenuePreset {
  key: string;
  name: string;
  emoji: string;
  genre: string;
  portalTemplate: string;
  roomBase: string;
  isNight: boolean;
  lightingLabel: string;
  screen: { pos: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } };
  lights: Array<{
    prefab: 'SpotLight' | 'Light' | 'BlinkLight';
    pos: { x: number; y: number; z: number };
    rot?: { x: number; y: number; z: number; w: number };
    color: string;
    brightness: number;
    range: number;
    angle?: number;
    blinkDuration?: number;
    blinkInterval?: number;
  }>;
}

export const VENUE_PRESETS: VenuePreset[] = [
  {
    key: 'festival_stage',
    name: 'Festival Stage',
    emoji: '🎪',
    genre: 'Festival / Rock',
    portalTemplate: 'conference-stage',
    roomBase: 'ExpoHallSimple',
    isNight: false,
    lightingLabel: 'Dual white spotlights, day mode',
    screen: { pos: { x: 0, y: 6, z: -14 }, scale: { x: 16, y: 9, z: 0.05 } },
    lights: [
      { prefab: 'SpotLight', pos: { x: -6, y: 9, z: -8 }, rot: TILT, color: 'FFFFFF', brightness: 4, range: 26, angle: 42 },
      { prefab: 'SpotLight', pos: { x: 6, y: 9, z: -8 }, rot: TILT, color: 'FFFFFF', brightness: 4, range: 26, angle: 42 },
    ],
  },
  {
    key: 'electronic_club',
    name: 'Electronic Club',
    emoji: '🔮',
    genre: 'Electronic / DJ',
    portalTemplate: 'spaceship',
    roomBase: 'Spaceship',
    isNight: true,
    lightingLabel: 'Purple + cyan strobes, night mode',
    screen: { pos: { x: 0, y: 4, z: -9 }, scale: { x: 10, y: 5.6, z: 0.05 } },
    lights: [
      { prefab: 'BlinkLight', pos: { x: -4, y: 6, z: -5 }, color: '9B4DFF', brightness: 5, range: 16, blinkDuration: 0.35, blinkInterval: 0.9 },
      { prefab: 'BlinkLight', pos: { x: 4, y: 6, z: -5 }, color: '31E1F7', brightness: 5, range: 16, blinkDuration: 0.35, blinkInterval: 1.3 },
      { prefab: 'SpotLight', pos: { x: 0, y: 7, z: -6 }, rot: DOWN, color: '9B4DFF', brightness: 3, range: 18, angle: 50 },
    ],
  },
  {
    key: 'intimate_acoustic',
    name: 'Intimate Acoustic',
    emoji: '🎸',
    genre: 'Acoustic / Singer-Songwriter',
    portalTemplate: 'large-apartment',
    roomBase: 'Vision',
    isNight: false,
    lightingLabel: 'Warm gold key light, day mode',
    screen: { pos: { x: 0, y: 2.6, z: -5 }, scale: { x: 5, y: 2.8, z: 0.05 } },
    lights: [
      { prefab: 'SpotLight', pos: { x: 0, y: 4, z: -3.5 }, rot: TILT, color: 'FFC46B', brightness: 3, range: 12, angle: 45 },
    ],
  },
  {
    key: 'jazz_lounge',
    name: 'Jazz Lounge',
    emoji: '🎷',
    genre: 'Jazz / Soul / R&B',
    portalTemplate: 'large-art-gallery',
    roomBase: 'GallerySimple',
    isNight: false,
    lightingLabel: 'Dual amber spotlights, day mode',
    screen: { pos: { x: 0, y: 3.4, z: -8 }, scale: { x: 7, y: 3.9, z: 0.05 } },
    lights: [
      { prefab: 'SpotLight', pos: { x: -3.5, y: 5.5, z: -5 }, rot: TILT, color: 'FFA53D', brightness: 3.2, range: 16, angle: 38 },
      { prefab: 'SpotLight', pos: { x: 3.5, y: 5.5, z: -5 }, rot: TILT, color: 'FFA53D', brightness: 3.2, range: 16, angle: 38 },
    ],
  },
  {
    key: 'hiphop_arena',
    name: 'Hip-Hop Arena',
    emoji: '🎤',
    genre: 'Hip-Hop / Rap',
    portalTemplate: 'conference-center',
    roomBase: 'ExpoHall',
    isNight: true,
    lightingLabel: 'Red + white spots, night mode',
    screen: { pos: { x: 0, y: 7, z: -16 }, scale: { x: 18, y: 10, z: 0.05 } },
    lights: [
      { prefab: 'SpotLight', pos: { x: -7, y: 10, z: -10 }, rot: TILT, color: 'FF2D2D', brightness: 5, range: 30, angle: 40 },
      { prefab: 'SpotLight', pos: { x: 7, y: 10, z: -10 }, rot: TILT, color: 'FFFFFF', brightness: 5, range: 30, angle: 40 },
    ],
  },
  {
    key: 'pop_showcase',
    name: 'Pop Showcase',
    emoji: '🌟',
    genre: 'Pop',
    portalTemplate: 'conference-stage',
    roomBase: 'ExpoHallSimple',
    isNight: false,
    lightingLabel: 'Pink + blue spots, day mode',
    screen: { pos: { x: 0, y: 6, z: -14 }, scale: { x: 16, y: 9, z: 0.05 } },
    lights: [
      { prefab: 'SpotLight', pos: { x: -6, y: 9, z: -8 }, rot: TILT, color: 'FF57C1', brightness: 4.2, range: 26, angle: 42 },
      { prefab: 'SpotLight', pos: { x: 6, y: 9, z: -8 }, rot: TILT, color: '4D8CFF', brightness: 4.2, range: 26, angle: 42 },
    ],
  },
  {
    key: 'country_barn',
    name: 'Country Barn',
    emoji: '🤠',
    genre: 'Country / Folk',
    portalTemplate: 'Cowboy-saloon',
    roomBase: 'BTCBanditsEmpty',
    isNight: false,
    lightingLabel: 'Warm orange light, day mode',
    screen: { pos: { x: 0, y: 3.2, z: -7 }, scale: { x: 6, y: 3.4, z: 0.05 } },
    lights: [
      { prefab: 'Light', pos: { x: 0, y: 4.5, z: -3 }, color: 'FF8A2B', brightness: 3, range: 18 },
    ],
  },
  {
    key: 'tropical_outdoor',
    name: 'Tropical Outdoor',
    emoji: '🌴',
    genre: 'Reggae / World',
    portalTemplate: 'tropical-paradise',
    roomBase: 'BeachTemplate',
    isNight: false,
    lightingLabel: 'Natural light only, day mode',
    screen: { pos: { x: 0, y: 4.5, z: -11 }, scale: { x: 12, y: 6.75, z: 0.05 } },
    lights: [],
  },
];

export const DEFAULT_PRESET_KEY = 'festival_stage';

export function getPreset(key: string): VenuePreset {
  return VENUE_PRESETS.find((p) => p.key === key)
    || VENUE_PRESETS.find((p) => p.key === DEFAULT_PRESET_KEY)!;
}

function item(prefabName: string, pos: unknown, scale: unknown, extra: Record<string, unknown> = {}) {
  return {
    prefabName,
    pos,
    rot: { x: 0, y: 0, z: 0, w: 1 },
    scale,
    modelsize: { x: 0, y: 0, z: 0 },
    modelCenter: { x: 0, y: 0, z: 0 },
    contentString: '',
    parentItemID: 0,
    placed: true,
    locked: false,
    superLocked: false,
    interactivityType: 0,
    interactivityURL: '',
    hoverTitle: '',
    hoverBodyContent: '',
    ImageInteractivityDetails: { buttonText: '', buttonURL: '' },
    sessionData: '',
    instanceId: '',
    currentEditornetId: 0,
    ...extra,
  };
}

/**
 * Build the preset's rig: lighting, main video screen, and cover art.
 *
 * `screenUrl` is threaded through rather than derived, because switching a preset
 * must never drop the artist's stream — the screen keeps its content and only
 * moves to the new stage's position.
 *
 * Light `logic` uses the light field names (c = colour hex, b = brightness,
 * r = range, ang = cone angle) — NOT the cube's `col`/`e`, which silently do
 * nothing on a light.
 */
export function buildVenueRig(
  preset: VenuePreset,
  opts: { name?: string; coverImageUrl?: string; screenUrl?: string } = {},
) {
  const items: Record<string, unknown> = {};
  const logic: Record<string, string> = {};
  const { name = '', coverImageUrl = '', screenUrl = '' } = opts;

  preset.lights.forEach((l, i) => {
    const id = String(140 + i);
    items[id] = item(l.prefab, l.pos, { x: 1, y: 1, z: 1 }, { rot: l.rot || { x: 0, y: 0, z: 0, w: 1 } });
    const cfg: Record<string, unknown> = { c: l.color, b: l.brightness, r: l.range, Tasks: [], ViewNodes: [] };
    if (l.angle !== undefined) cfg.ang = l.angle;
    if (l.blinkDuration !== undefined) cfg.bd = l.blinkDuration;
    if (l.blinkInterval !== undefined) cfg.bi = l.blinkInterval;
    logic[id] = JSON.stringify(cfg);
  });

  if (screenUrl) {
    items['105'] = item('DefaultVideo', preset.screen.pos, preset.screen.scale, { contentString: screenUrl });
    logic['105'] = JSON.stringify({ b: true, e: 1.0, fStart: 8.0, sEnd: 40.0, Tasks: [], ViewNodes: [] });
  } else if (coverImageUrl) {
    // No stream yet — the cover art holds the stage wall so the space doesn't
    // read as unfinished before the first show.
    items['105'] = item('DefaultPainting', preset.screen.pos, preset.screen.scale, {
      contentString: coverImageUrl,
      hoverTitle: name,
      hoverBodyContent: 'Now Playing',
    });
  }

  return { items, logic };
}

/**
 * Build ONLY the main stage screen (item 105) for a piece of idle content.
 *
 * Exported separately from buildVenueRig because idle programming rewrites the
 * screen every few minutes: re-running the whole rig on each advance would
 * rebuild the lighting too, and a room upload replaces the entire room, so the
 * narrower the write the less there is to get wrong.
 *
 * A video entry becomes a playing video wall; an audio entry becomes its cover
 * art PLUS a hidden audio carrier (item 106), because Portals has no audio-only
 * surface: the video prefab is the only thing in the room that plays a media URL,
 * so an audio track is handed to it and the visible wall keeps the artwork. A
 * blank wall would read as a broken venue rather than as music playing.
 *
 * `audioUrl` is the actual sound file and is separate from `url` (the artwork),
 * because for an audio entry those are two different files.
 */
export function buildIdleScreen(
  preset: VenuePreset,
  opts: {
    url: string;
    kind: 'audio' | 'video';
    title?: string;
    subtitle?: string;
    audioUrl?: string;
    volume?: number;
    paused?: boolean;
  },
) {
  const { url, kind, title = '', subtitle = 'Now Playing', audioUrl = '', volume = 1, paused = false } = opts;
  const items: Record<string, unknown> = {};
  const logic: Record<string, string> = {};
  if (!url) return { items, logic };

  if (kind === 'video') {
    items['105'] = item('DefaultVideo', preset.screen.pos, preset.screen.scale, {
      contentString: url,
      hoverTitle: title,
      hoverBodyContent: subtitle,
    });
    logic['105'] = JSON.stringify({ b: true, e: 1.0, fStart: 8.0, sEnd: 40.0, Tasks: [], ViewNodes: [] });
  } else {
    items['105'] = item('DefaultPainting', preset.screen.pos, preset.screen.scale, {
      contentString: url,
      hoverTitle: title,
      hoverBodyContent: subtitle,
    });
    // The sound itself. Kept as its own item rather than folded into 105 so the
    // artwork stays visible: one item cannot be both a painting and a player.
    // Tucked just behind the stage wall at minimal scale — it is a speaker, not
    // something a fan should see.
    if (audioUrl && !paused) {
      // TRUE spatial audio: the emitter sits ON the stage, just in FRONT of the
      // wall (+z, toward the audience) rather than tucked behind it, so the sound
      // is not occluded by the stage geometry and genuinely comes from where the
      // artwork is. Walking toward the stage gets louder, walking away quieter.
      //
      // Falloff scales with the preset, because a fixed pair of distances cannot
      // serve both an apartment and an arena: an intimate room would be flooded
      // and a festival field would be silent at the back. `fStart` is the radius
      // of full volume, `sEnd` the radius where it reaches silence — both derived
      // from the stage's own distance from the floor centre.
      const depth = Math.abs(preset.screen.pos.z) || 8;
      items['106'] = item(
        'DefaultVideo',
        { x: preset.screen.pos.x, y: 1.6, z: preset.screen.pos.z + 0.6 },
        { x: 0.02, y: 0.02, z: 0.02 },
        { contentString: audioUrl },
      );
      logic['106'] = JSON.stringify({
        b: true,
        e: Math.min(1, Math.max(0, volume)),
        fStart: Math.max(3, depth * 0.6),
        sEnd: Math.max(18, depth * 3.5),
        Tasks: [],
        ViewNodes: [],
      });
    }
  }
  return { items, logic };
}

/** Strip a previous BASE Station rig, leaving everything the artist placed. */
export function withoutRig<T extends Record<string, unknown>>(map: T = {} as T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(map || {})) {
    const n = Number(id);
    if (Number.isFinite(n) && n >= RIG_ID_MIN && n <= RIG_ID_MAX) continue;
    out[id] = value;
  }
  return out;
}

/** The stream/cover URL currently on the main screen, so a switch preserves it. */
export function currentScreenUrl(roomItems: Record<string, any> = {}) {
  const screen = roomItems?.['105'];
  return screen?.prefabName === 'DefaultVideo' ? String(screen.contentString || '') : '';
}