// Human-authored chord progressions → note entities on a dedicated pad track.
// Nothing here is AI, so nothing is logged to telemetry: it all counts as human.
import { nextTrackOrder, nextStripOrder } from '@/lib/audiotool/nexusOrdering';
import { TICKS_PER_BAR } from '@/lib/audiotool/arrangement';

const ROOTS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// Longest match first, so "maj7" wins over "m" and "m7" over "m".
const QUALITIES = [
  ['maj7', [0, 4, 7, 11]], ['m7b5', [0, 3, 6, 10]], ['m7', [0, 3, 7, 10]], ['min', [0, 3, 7]],
  ['dim', [0, 3, 6]], ['aug', [0, 4, 8]], ['sus2', [0, 2, 7]], ['sus4', [0, 5, 7]],
  ['7', [0, 4, 7, 10]], ['m', [0, 3, 7]], ['', [0, 4, 7]],
];
export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function chordPitches(symbol) {
  const m = symbol.trim().match(/^([A-G])([#b]?)(.*)$/);
  if (!m) return null;
  const root = (ROOTS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const [, intervals] = QUALITIES.find(([q]) => m[3].split('/')[0].startsWith(q));
  return intervals.map((i) => 48 + root + i);
}

/** "C | Am | F | G7" (bars, commas or spaces) → valid chord symbols only. */
export const parseChart = (text) => (text || '').split(/[|,\s]+/).filter((s) => s && chordPitches(s));

function createPadTrack(t) {
  const row = t.entities.ofTypes('mixerChannel').get().length;
  const synth = t.create('space', {});
  if (synth.fields.positionX) t.update(synth.fields.positionX, 200);
  if (synth.fields.positionY) t.update(synth.fields.positionY, 300 + row * 420);
  if (synth.fields.displayName) t.update(synth.fields.displayName, 'BASE Chords');
  const channel = t.create('mixerChannel', { displayParameters: { orderAmongStrips: nextStripOrder(t) } });
  t.create('desktopAudioCable', { fromSocket: synth.fields.audioOutput.location, toSocket: channel.fields.audioInput.location });
  return t.create('noteTrack', { player: synth.location, orderAmongTracks: nextTrackOrder(t) });
}

export function writeProgression(nexus, { chords, barsPerChord, trackId, label }) {
  const span = barsPerChord * TICKS_PER_BAR;
  const scale = Math.max(0, ...nexus.queryEntities.ofTypes('note').get().map((n) => n.fields.velocity.value)) > 1 ? 127 : 1;
  return nexus.modify((t) => {
    const track = (trackId && t.entities.ofTypes('noteTrack').get().find((tr) => tr.id === trackId)) || createPadTrack(t);
    const start = t.entities.ofTypes('noteRegion').get()
      .filter((r) => r.fields.track.value.entityId === track.id)
      .reduce((end, r) => Math.max(end, r.fields.region.fields.positionTicks.value + r.fields.region.fields.durationTicks.value), 0);
    const collection = t.create('noteCollection', {});
    const region = t.create('noteRegion', {
      track: track.location,
      collection: collection.location,
      region: {
        positionTicks: start, durationTicks: chords.length * span, loopDurationTicks: chords.length * span,
        loopOffsetTicks: 0, collectionOffsetTicks: 0, displayName: label.slice(0, 40), colorIndex: 3,
      },
    });
    chords.forEach((c, i) => chordPitches(c).forEach((pitch) => t.create('note', {
      positionTicks: i * span, durationTicks: span - 240, pitch, velocity: 0.7 * scale,
      doesSlide: false, collection: collection.location,
    })));
    return { trackId: track.id, regionId: region.id, collectionId: collection.id, bar: Math.floor(start / TICKS_PER_BAR) + 1 };
  });
}