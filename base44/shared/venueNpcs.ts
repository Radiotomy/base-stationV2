// Venue staff — the AI NPCs standing in a BASE Station 3D venue.
//
// A staff member is a Portals `GLBNPC` item: a rigged GLB avatar plus a logic
// block carrying a display name (`n`), a default animation (`a`) and an AI
// personality prompt (`p`) that Portals uses as the system prompt for player
// conversations. Confirmed against the Portals item-type reference — these exact
// single-letter keys are the whole contract, and a wrong key silently produces a
// mute, nameless mannequin rather than an error.
//
// Staff live in ids 120-139, inside the reserved 100-149 rig band but clear of
// the stage screen (105), the audio carrier (106) and the lighting rig (140+),
// so a template switch and a staff change can never overwrite one another.

import type { VenuePreset } from './venuePresets.ts';

export const STAFF_ID_MIN = 120;
export const STAFF_ID_MAX = 139;

/** Animations Portals ships on its rigged avatars. Case-sensitive — a near-miss
 *  name leaves the character in a T-pose. */
export const NPC_ANIMATIONS = [
  '', 'Sitting', 'Wave', 'Salute', 'Jive', 'Salsa', 'Shuffling', 'Chicken', 'Slide n Jive', 'Robot', 'Can Can',
] as const;

export interface StaffRole {
  key: string;
  label: string;
  description: string;
  animation: string;
  /** Where this role stands, expressed relative to the stage rather than in
   *  absolute metres — the same roster has to read correctly in an apartment and
   *  in an arena, and only the preset knows how deep its stage is. */
  place: (preset: VenuePreset) => { x: number; y: number; z: number };
  /** The job, in the NPC's own terms. Combined with grounded venue facts. */
  persona: string;
}

/** Distance from the floor centre to the stage wall — the room's working depth. */
function stageDepth(preset: VenuePreset) {
  return Math.abs(preset.screen.pos.z) || 8;
}

export const STAFF_ROLES: StaffRole[] = [
  {
    key: 'host',
    label: 'Host',
    description: 'Greets fans near the entrance and explains what is playing.',
    animation: 'Wave',
    place: (p) => ({ x: 1.5, y: 0, z: stageDepth(p) * 0.35 }),
    persona:
      'You are the host of this venue. Greet arriving fans warmly and briefly, tell them what is playing right now, and point them to the stage.',
  },
  {
    key: 'guide',
    label: 'Stage Guide',
    description: 'Stands by the stage and talks about the artist and the music.',
    animation: '',
    place: (p) => ({ x: -3, y: 0, z: p.screen.pos.z + stageDepth(p) * 0.3 }),
    persona:
      'You stand beside the stage. Talk about the artist and the music playing in this venue. Keep answers short and enthusiastic without overselling.',
  },
  {
    key: 'bartender',
    label: 'Bartender',
    description: 'Friendly background character for the bar area.',
    animation: '',
    place: (p) => ({ x: -6, y: 0, z: stageDepth(p) * 0.25 }),
    persona:
      'You tend the bar in this venue. Be casual and funny. Chat about the music, never about real drinks orders — nothing is actually served here.',
  },
  {
    key: 'dancer',
    label: 'Hype Dancer',
    description: 'Dances near the stage to keep the floor feeling alive.',
    animation: 'Jive',
    place: (p) => ({ x: 3.5, y: 0, z: p.screen.pos.z + stageDepth(p) * 0.45 }),
    persona:
      'You are here to dance and hype the crowd. Answer in one or two excited lines, always about the music.',
  },
];

export function getStaffRole(key: string): StaffRole {
  return STAFF_ROLES.find((r) => r.key === key) || STAFF_ROLES[0];
}

export interface StaffMember {
  role: string;
  name: string;
  /** https URL of a RIGGED GLB. An unrigged model will not animate at all, so a
   *  static model must be flagged so Portals is told not to expect a skeleton. */
  glb_url: string;
  rigged?: boolean;
  animation?: string;
  /** Optional extra character notes from the artist, appended to the role's job. */
  persona?: string;
  enabled?: boolean;
}

export interface VenueFacts {
  venueName?: string;
  artistName?: string;
  nowPlaying?: string;
  upNext?: string[];
  isLive?: boolean;
}

/**
 * Compose the NPC's system prompt: the role's job, the artist's own notes, then
 * the only facts it is allowed to state.
 *
 * The grounding block is not decoration. A conversational NPC with no facts will
 * happily invent tour dates, rooms and merch that do not exist, and a fan has no
 * way to tell an invented answer from a real one — so the prompt names what is
 * true and forbids everything else, per Portals' own NPC guidance.
 */
export function buildStaffPrompt(role: StaffRole, member: StaffMember, facts: VenueFacts = {}) {
  const lines: string[] = [role.persona];
  if (member.persona) lines.push(member.persona.trim());

  const known: string[] = [];
  if (facts.venueName) known.push(`This venue is called "${facts.venueName}".`);
  if (facts.artistName) known.push(`It belongs to the artist ${facts.artistName}.`);
  if (facts.isLive) known.push('A live performance is happening right now.');
  if (facts.nowPlaying) known.push(`Playing right now: "${facts.nowPlaying}".`);
  if (facts.upNext?.length) known.push(`Coming up next: ${facts.upNext.map((t) => `"${t}"`).join(', ')}.`);
  known.push('This venue is part of BASE Station, where the music is made and provenance-marked by its creators.');

  lines.push(`FACTS YOU KNOW:\n${known.map((k) => `- ${k}`).join('\n')}`);
  lines.push(
    [
      'RULES:',
      '- Only state the facts listed above. If you are asked anything else — tour dates, ticket prices, merch, other rooms, or anything about a specific fan — say you do not know.',
      '- Never invent songs, places, people or events.',
      '- Never mention being an NPC, an AI, a prompt or a system. You are simply staff at this venue.',
      '- Never promise to do anything you cannot do here, such as playing a request, opening a door or sending something.',
      '- Keep replies to one or two short sentences.',
    ].join('\n'),
  );

  return lines.join('\n\n');
}

function npcItem(pos: { x: number; y: number; z: number }, contentString: string) {
  return {
    prefabName: 'GLBNPC',
    // NPCs sit on the ground at Y=0 — unlike a cube, whose centre is at 0.5.
    pos,
    rot: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
    modelsize: { x: 0, y: 0, z: 0 },
    modelCenter: { x: 0, y: 0, z: 0 },
    contentString,
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
  };
}

/**
 * Build the room items + logic for a venue's staff.
 *
 * Rotation is left at identity and placement keeps every character in front of
 * the stage wall, because an NPC facing away from the audience reads as broken
 * scenery rather than as staff.
 */
export function buildVenueStaff(
  preset: VenuePreset,
  staff: StaffMember[] = [],
  facts: VenueFacts = {},
) {
  const items: Record<string, unknown> = {};
  const logic: Record<string, string> = {};

  staff
    .filter((m) => m && m.enabled !== false && m.glb_url && m.glb_url.startsWith('https://'))
    .slice(0, STAFF_ID_MAX - STAFF_ID_MIN + 1)
    .forEach((member, i) => {
      const id = String(STAFF_ID_MIN + i);
      const role = getStaffRole(member.role);
      // A static model must be declared, or Portals looks for a skeleton that
      // isn't there and the character fails to load.
      const url = member.rigged === false ? `${member.glb_url}?nonrigged=true` : member.glb_url;

      items[id] = npcItem(role.place(preset), url);
      logic[id] = JSON.stringify({
        n: member.name || role.label,
        a: member.rigged === false ? '' : (member.animation ?? role.animation),
        p: buildStaffPrompt(role, member, facts),
        bq: true,
        swn: false, // dialogue on click, not on approach — auto-popups every time
                    // a fan walks past the bar would fight the music
        events: [],
        tags: [],
        Tasks: [],
        ViewNodes: [],
      });
    });

  return { items, logic };
}

/** Strip only the staff band, leaving the stage rig and anything the artist placed. */
export function withoutStaff<T extends Record<string, unknown>>(map: T = {} as T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(map || {})) {
    const n = Number(id);
    if (Number.isFinite(n) && n >= STAFF_ID_MIN && n <= STAFF_ID_MAX) continue;
    out[id] = value;
  }
  return out;
}