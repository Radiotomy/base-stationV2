// "Midnight Signal" — a fully written 80-bar melodic house arrangement (F minor,
// 124 BPM, ~2:35) that the hackathon demo writes into a live Audiotool project.
// Every note is authored here by hand, so nothing is logged as AI: it shows the
// judges how a BASE Station arrangement lands in Audiotool, track by track.
import { nextTrackOrder, nextStripOrder } from '@/lib/audiotool/nexusOrdering';
import { TICKS_PER_BAR } from '@/lib/audiotool/arrangement';
import { chordPitches } from '@/lib/audiotool/chordWriter';

export const DEMO = { title: 'Midnight Signal', bpm: 124, key: 'F minor', bars: 80 };
const Q = TICKS_PER_BAR / 4; // one beat
const S = Q / 4; // one 16th
const PROG = ['Fm', 'Db', 'Ab', 'Eb'];

// [name, start bar (1-based), length in bars, colour index]
export const SECTIONS = [
  ['Intro', 1, 8, 1], ['Build', 9, 8, 2], ['Drop A', 17, 16, 5], ['Breakdown', 33, 16, 3],
  ['Build II', 49, 8, 2], ['Drop B', 57, 16, 5], ['Outro', 73, 8, 1],
];

// Which section each part plays in.
const PLAYS = {
  kick: ['Build', 'Drop A', 'Build II', 'Drop B', 'Outro'],
  bass: ['Drop A', 'Build II', 'Drop B'],
  chords: ['Intro', 'Build', 'Drop A', 'Breakdown', 'Build II', 'Drop B', 'Outro'],
  lead: ['Drop A', 'Breakdown', 'Drop B'],
  arp: ['Build', 'Drop A', 'Build II', 'Drop B'],
};

const n = (pos, dur, pitch, vel = 0.75) => ({ pos, dur, pitch, vel });

// One 4-bar loop per part; regions loop it across each section.
const LOOPS = {
  kick: () => Array.from({ length: 16 }, (_, i) => n(i * Q, S * 2, 36, 0.95)),
  bass: () => PROG.flatMap((c, b) => [2, 6, 10, 14].map((st) => n(b * TICKS_PER_BAR + st * S, S * 2, chordPitches(c)[0] - 12, 0.85))),
  chords: () => PROG.flatMap((c, b) => chordPitches(c).map((p) => n(b * TICKS_PER_BAR, TICKS_PER_BAR - 240, p + 12, 0.6))),
  arp: () => PROG.flatMap((c, b) => {
    const [r, t, f] = chordPitches(c).map((p) => p + 24);
    return Array.from({ length: 16 }, (_, i) => n(b * TICKS_PER_BAR + i * S, S - 60, [r, t, f, t + 12][i % 4], 0.5));
  }),
  // Hook: C–Ab–Bb–C … over the progression.
  lead: () => [
    [0, 3, 72], [3, 1, 68], [4, 2, 70], [6, 2, 72], [8, 4, 73], [12, 2, 72], [14, 2, 68],
    [16, 3, 68], [19, 1, 67], [20, 4, 70], [24, 3, 70], [27, 1, 72], [28, 4, 75],
  ].map(([st, len, p]) => n(st * Q / 2, len * Q / 2 - 120, p, 0.8)),
};

const PARTS = [
  ['kick', 'Kick', 'pulverisateur'], ['bass', 'Sub Bass', 'pulverisateur'],
  ['chords', 'Pad Chords', 'space'], ['arp', 'Pluck Arp', 'heisenberg'], ['lead', 'Lead Hook', 'heisenberg'],
];

function createTrack(t, device, name) {
  const row = t.entities.ofTypes('mixerChannel').get().length;
  const synth = t.create(device, {});
  if (synth.fields.positionX) t.update(synth.fields.positionX, 200);
  if (synth.fields.positionY) t.update(synth.fields.positionY, 300 + row * 420);
  if (synth.fields.displayName) t.update(synth.fields.displayName, `Demo · ${name}`);
  const channel = t.create('mixerChannel', { displayParameters: { orderAmongStrips: nextStripOrder(t) } });
  t.create('desktopAudioCable', { fromSocket: synth.fields.audioOutput.location, toSocket: channel.fields.audioInput.location });
  return t.create('noteTrack', { player: synth.location, orderAmongTracks: nextTrackOrder(t) });
}

/** Writes the whole song into the open project. Returns a summary for the UI. */
export function buildDemoSong(nexus) {
  const scale = Math.max(0, ...nexus.queryEntities.ofTypes('note').get().map((x) => x.fields.velocity.value)) > 1 ? 127 : 1;
  return nexus.modify((t) => {
    const cfg = t.entities.ofTypes('config').get()[0];
    if (cfg?.fields.tempoBpm) t.update(cfg.fields.tempoBpm, DEMO.bpm);
    let regions = 0;
    PARTS.forEach(([key, name, device]) => {
      const track = createTrack(t, device, name);
      const loopLen = 4 * TICKS_PER_BAR;
      SECTIONS.filter(([s]) => PLAYS[key].includes(s)).forEach(([section, start, len, color]) => {
        const collection = t.create('noteCollection', {});
        t.create('noteRegion', {
          track: track.location, collection: collection.location,
          region: {
            positionTicks: (start - 1) * TICKS_PER_BAR, durationTicks: len * TICKS_PER_BAR, loopDurationTicks: loopLen,
            loopOffsetTicks: 0, collectionOffsetTicks: 0, displayName: `${name} · ${section}`, colorIndex: color,
          },
        });
        LOOPS[key]().forEach((x) => t.create('note', {
          positionTicks: x.pos, durationTicks: x.dur, pitch: x.pitch, velocity: x.vel * scale,
          doesSlide: false, collection: collection.location,
        }));
        regions += 1;
      });
    });
    return { tracks: PARTS.length, regions };
  });
}