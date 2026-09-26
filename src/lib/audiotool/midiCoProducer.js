// Nexus Co-Producer (MIDI): read a note region from the live session, rework
// it from a text prompt, and write the result back as a new region.
import { base44 } from '@/api/base44Client';
import { nextTrackOrder } from '@/lib/audiotool/nexusOrdering';

export const PRESETS = [
  'Add a harmony a third above', 'Make it a syncopated arpeggio', 'Humanize timing and velocity',
  'Simplify to the strongest notes', 'Double it an octave down', 'Write a call-and-response answer',
];

const TICKS_PER_QUARTER = 3840;

export function listNoteRegions(nexus) {
  return nexus.queryEntities.ofTypes('noteRegion').get().map((r) => {
    const f = r.fields.region.fields;
    return {
      id: r.id,
      entity: r,
      name: f.displayName.value || 'Untitled region',
      bar: Math.floor(f.positionTicks.value / (TICKS_PER_QUARTER * 4)) + 1,
      bars: Math.max(1, Math.round(f.durationTicks.value / (TICKS_PER_QUARTER * 4))),
    };
  });
}

export function readNotes(nexus, region) {
  const collectionId = region.fields.collection.value.entityId;
  return nexus.queryEntities.ofTypes('note').get()
    .filter((n) => n.fields.collection.value.entityId === collectionId)
    .map((n) => ({
      positionTicks: n.fields.positionTicks.value,
      durationTicks: n.fields.durationTicks.value,
      pitch: n.fields.pitch.value,
      velocity: n.fields.velocity.value,
    }));
}

export async function transformNotes(notes, prompt, lengthTicks) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a MIDI co-producer. Rework the note pattern below according to the instruction.
Timing is in ticks: ${TICKS_PER_QUARTER} ticks = one quarter note. The pattern is ${lengthTicks} ticks long; every note must start at >= 0 and before ${lengthTicks}.
Pitch is a MIDI note number (0-127). Keep velocities on the same scale as the input.
Instruction: "${prompt}"
Input notes (JSON): ${JSON.stringify(notes.slice(0, 400))}`,
    response_json_schema: {
      type: 'object',
      properties: {
        notes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              positionTicks: { type: 'number' }, durationTicks: { type: 'number' },
              pitch: { type: 'number' }, velocity: { type: 'number' },
            },
            required: ['positionTicks', 'durationTicks', 'pitch', 'velocity'],
          },
        },
      },
      required: ['notes'],
    },
  });
  const maxVel = Math.max(1, ...notes.map((n) => n.velocity));
  return (res.notes || [])
    .map((n) => ({
      positionTicks: Math.round(n.positionTicks),
      durationTicks: Math.max(60, Math.round(n.durationTicks)),
      pitch: Math.min(127, Math.max(0, Math.round(n.pitch))),
      velocity: Math.min(maxVel, Math.max(0, n.velocity)),
    }))
    .filter((n) => n.positionTicks >= 0 && n.positionTicks < lengthTicks);
}

export const PLACEMENTS = [
  ['after', 'Right after it, same track'],
  ['layer', 'Layered on a new track (plays together)'],
];

/**
 * Writes notes as a new region. 'after' appends on the same track; 'layer'
 * creates a new note track driving the same instrument, at the same position —
 * for harmonies, doubles and counter-lines. Returns the ids needed to undo.
 */
export async function writeRegion(nexus, region, notes, label, placement = 'after') {
  const src = region.fields.region.fields;
  const duration = src.durationTicks.value;
  return nexus.modify((t) => {
    let track = region.fields.track.value;
    let trackId = null;
    if (placement === 'layer') {
      const source = t.entities.ofTypes('noteTrack').get().find((tr) => tr.id === track.entityId);
      const created = t.create('noteTrack', { player: source.fields.player.value, orderAmongTracks: nextTrackOrder(t) });
      track = created.location;
      trackId = created.id;
    }
    const collection = t.create('noteCollection', {});
    const newRegion = t.create('noteRegion', {
      track,
      collection: collection.location,
      region: {
        positionTicks: src.positionTicks.value + (placement === 'layer' ? 0 : duration),
        durationTicks: duration,
        loopDurationTicks: src.loopDurationTicks.value,
        loopOffsetTicks: 0,
        collectionOffsetTicks: 0,
        displayName: label.slice(0, 40),
        colorIndex: 7,
      },
    });
    notes.forEach((n) => t.create('note', { ...n, doesSlide: false, collection: collection.location }));
    return { collectionId: collection.id, regionId: newRegion.id, trackId };
  });
}

/** Removes everything a writeRegion call created (notes → region → collection → track). */
export function undoRegion(nexus, { collectionId, regionId, trackId }) {
  return nexus.modify((t) => {
    const find = (type, id) => t.entities.ofTypes(type).get().find((e) => e.id === id);
    t.entities.ofTypes('note').get().filter((n) => n.fields.collection.value.entityId === collectionId).forEach((n) => t.remove(n));
    [find('noteRegion', regionId), find('noteCollection', collectionId), trackId && find('noteTrack', trackId)]
      .filter(Boolean).forEach((e) => t.remove(e));
  });
}