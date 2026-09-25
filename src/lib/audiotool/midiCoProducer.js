// Nexus Co-Producer (MIDI): read a note region from the live session, rework
// it from a text prompt, and write the result back as a new region.
import { base44 } from '@/api/base44Client';

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

/** Writes notes as a new region on the same track, right after the source region. */
export async function writeRegion(nexus, region, notes, label) {
  const src = region.fields.region.fields;
  const duration = src.durationTicks.value;
  return nexus.modify((t) => {
    const collection = t.create('noteCollection', {});
    t.create('noteRegion', {
      track: region.fields.track.value,
      collection: collection.location,
      region: {
        positionTicks: src.positionTicks.value + duration,
        durationTicks: duration,
        loopDurationTicks: src.loopDurationTicks.value,
        loopOffsetTicks: 0,
        collectionOffsetTicks: 0,
        displayName: label.slice(0, 40),
        colorIndex: 7,
      },
    });
    notes.forEach((n) => t.create('note', { ...n, doesSlide: false, collection: collection.location }));
    return collection.id;
  });
}