// 60s Pre-Starter: three AI elements (chord bed, drums, riser) arranged into a
// ~60s song sketch, auditioned locally, then sent to Audiotool as one mix or as stems.
import { runForgeLoop, runSfx } from '@/lib/audiotool/songstarterGen';
import { loadAsWavFile } from '@/lib/audiotool/localAudio';
import { audioBufferToWav } from '@/utils/wavEncoder';
import { VIBES } from '@/lib/audiotool/vibes';

export const TARGET_SECONDS = 60;
const RATE = 44100;
const INTRO_BARS = 4; // bed alone, riser builds, then drums drop in

// Bed prompt per vibe — a harmonic pad the drums sit on.
const BED = {
  lofi: 'Warm lo-fi jazzy Rhodes chord loop, mellow seventh chords, tape-saturated',
  trap: 'Dark minor trap piano and pad chord loop, ominous and sparse',
  house: 'Deep house chord stab and warm pad loop, soulful minor sevenths',
  ambient: 'Dreamy ambient pad chord loop, evolving warm chords, wide',
  dnb: 'Liquid drum and bass atmospheric pad chord loop, lush minor chords',
  cinematic: 'Epic cinematic string and brass chord loop, heroic progression',
};
const DRUM_PROMPT = {
  ambient: 'Soft downtempo ambient percussion loop, gentle brushed drums',
  cinematic: 'Driving cinematic percussion loop, taiko and toms, epic',
};

export const LANES = [
  { key: 'bed', label: 'Bed', aiTool: 'songstarter_loop' },
  { key: 'drums', label: 'Drums', aiTool: 'songstarter_loop' },
  { key: 'riser', label: 'Riser', aiTool: 'songstarter_sfx' },
];

export const vibeById = (id) => VIBES.find((v) => v.id === id) || VIBES[0];

export const promptsFor = (vibe, extra = '') => {
  const add = extra.trim() ? `, ${extra.trim()}` : '';
  return {
    bed: `${BED[vibe.id] || vibe.loop}${add}`,
    drums: `${DRUM_PROMPT[vibe.id] || vibe.loop}${add}`,
    riser: vibe.sfx,
  };
};

async function decodeUrl(url) {
  const file = await loadAsWavFile(url, 'part');
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: 1, sampleRate: RATE });
  return ctx.decodeAudioData(await file.arrayBuffer());
}

/** Generates one element and returns its raw AudioBuffer. */
export async function generateLane(key, prompts, bpm) {
  if (key === 'riser') {
    const { audioUrl } = await runSfx({ text: prompts.riser, duration: 6, loop: false });
    return { buffer: await decodeUrl(audioUrl), url: audioUrl };
  }
  const { audioUrl } = await runForgeLoop({
    prompt: prompts[key], category: key === 'bed' ? 'melodic_loop' : 'drum_loop', bpm, duration: 8,
  });
  return { buffer: await decodeUrl(audioUrl), url: audioUrl };
}

const barSeconds = (bpm) => (60 / bpm) * 4;
export const dropSeconds = (bpm) => INTRO_BARS * barSeconds(bpm);

/** Where each lane sounds on the song timeline, for the lane bars. */
export const laneSpan = (key, raw, bpm) => {
  const total = songSeconds(bpm);
  const drop = dropSeconds(bpm);
  if (key === 'riser') return [Math.max(0, drop - raw.duration), drop];
  return [key === 'drums' ? drop : 0, total];
};

/** Song length snapped to whole bars nearest 60s. */
export const songSeconds = (bpm) => Math.round(TARGET_SECONDS / barSeconds(bpm)) * barSeconds(bpm);

/**
 * Places a raw element on the shared song timeline, producing a full-length
 * buffer: bed loops the whole song, drums loop from the drop, the riser ends on the drop.
 */
export async function arrangeLane(key, raw, bpm) {
  const total = songSeconds(bpm);
  const drop = INTRO_BARS * barSeconds(bpm);
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(total * RATE), sampleRate: RATE });
  const src = ctx.createBufferSource();
  src.buffer = raw;
  src.connect(ctx.destination);
  if (key === 'riser') {
    src.start(Math.max(0, drop - raw.duration));
  } else {
    // Loop on whole bars so tiles stay on the grid.
    const bars = Math.max(1, Math.round(raw.duration / barSeconds(bpm)));
    src.loop = true;
    src.loopEnd = Math.min(raw.duration, bars * barSeconds(bpm));
    src.start(key === 'drums' ? drop : 0);
    src.stop(total);
  }
  return ctx.startRendering();
}

/** Mixes arranged lanes (with the preview's gains) into one WAV File. */
export async function mixToFile(lanes, name) {
  const length = Math.max(...lanes.map((l) => l.buffer.length));
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length, sampleRate: RATE });
  lanes.forEach((l) => {
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = l.buffer;
    g.gain.value = l.gain;
    src.connect(g).connect(ctx.destination);
    src.start(0);
  });
  const out = await ctx.startRendering();
  return new File([audioBufferToWav(out, { bitDepth: 16 })], `${name}.wav`, { type: 'audio/wav' });
}

export const bufferToFile = (buffer, name) =>
  new File([audioBufferToWav(buffer, { bitDepth: 16 })], `${name}.wav`, { type: 'audio/wav' });