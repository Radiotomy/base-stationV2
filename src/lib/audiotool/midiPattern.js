// Generate a fresh MIDI pattern from a prompt and write it as a new note region
// at the end of the first note track — existing regions are never touched.
import { base44 } from '@/api/base44Client';

const TICKS_PER_BAR = 3840 * 4;

function velocityScale(nexus) {
  const max = Math.max(0, ...nexus.queryEntities.ofTypes('note').get().map((n) => n.fields.velocity.value));
  return max > 1 ? 127 : 1;
}

export async function generatePattern(prompt, bars = 4) {
  const len = bars * TICKS_PER_BAR;
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `Write a ${bars}-bar MIDI pattern in 4/4 for: "${prompt}".
Timing is in ticks: 3840 ticks = one quarter note, the pattern is ${len} ticks long. Every note starts >= 0 and before ${len}.
Pitch is a MIDI note number (0-127). Velocity is 0-1. Return 8-64 notes.`,
    response_json_schema: {
      type: 'object',
      properties: {
        notes: {
          type: 'array',
          items: {
            type: 'object',
            properties: { positionTicks: { type: 'number' }, durationTicks: { type: 'number' }, pitch: { type: 'number' }, velocity: { type: 'number' } },
            required: ['positionTicks', 'durationTicks', 'pitch', 'velocity'],
          },
        },
      },
      required: ['notes'],
    },
  });
  return { len, notes: (res.notes || []).filter((n) => n.positionTicks >= 0 && n.positionTicks < len) };
}

export async function writePattern(nexus, { len, notes }, label) {
  const track = nexus.queryEntities.ofTypes('noteTrack').get()[0];
  if (!track) throw new Error('Add a synth track in Audiotool to receive MIDI patterns.');
  const positionTicks = nexus.queryEntities.ofTypes('noteRegion').get()
    .filter((r) => r.fields.track.value.entityId === track.id)
    .reduce((end, r) => Math.max(end, r.fields.region.fields.positionTicks.value + r.fields.region.fields.durationTicks.value), 0);
  const scale = velocityScale(nexus);

  const collectionId = await nexus.modify((t) => {
    const collection = t.create('noteCollection', {});
    t.create('noteRegion', {
      track: track.location,
      collection: collection.location,
      region: {
        positionTicks, durationTicks: len, loopDurationTicks: len, loopOffsetTicks: 0,
        collectionOffsetTicks: 0, displayName: label.slice(0, 40), colorIndex: 7,
      },
    });
    notes.forEach((n) => t.create('note', {
      positionTicks: Math.round(n.positionTicks),
      durationTicks: Math.max(60, Math.round(n.durationTicks)),
      pitch: Math.min(127, Math.max(0, Math.round(n.pitch))),
      velocity: Math.min(1, Math.max(0.05, n.velocity)) * scale,
      doesSlide: false,
      collection: collection.location,
    }));
    return collection.id;
  });
  return { bar: Math.floor(positionTicks / TICKS_PER_BAR) + 1, collectionId };
}