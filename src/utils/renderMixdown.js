import { audioBufferToWav } from '@/utils/wavEncoder';

/**
 * Render a multitrack mix to a single 44.1kHz stereo PCM WAV, in the browser.
 *
 * This is the point in the whole pipeline where marking actually makes sense.
 * Individual loops are raw material — they get chopped, pitched, layered and
 * time-stretched, so a mark embedded in a loop rarely survives into the record
 * anyone ships. The mixdown is the finished work, it is true PCM (never touched
 * an MP3 encoder), and it's the file a rights claim would ever be made against.
 *
 * Applies each track's volume, pan, mute and solo exactly as the mixer shows.
 */
export async function renderMixdown(tracks, { sampleRate = 44100 } = {}) {
  const audible = tracks.filter((t) => {
    const anySolo = tracks.some((x) => x.solo);
    return !(t.muted || (anySolo && !t.solo));
  });
  if (!audible.length) throw new Error('Every track is muted — nothing to mix down');

  // Decode with a throwaway context first so we know how long the mix runs.
  const probe = new AudioContext({ sampleRate });
  let buffers;
  try {
    buffers = await Promise.all(
      audible.map(async (t) => {
        const res = await fetch(t.url);
        return probe.decodeAudioData(await res.arrayBuffer());
      })
    );
  } finally {
    probe.close();
  }

  const seconds = Math.max(...buffers.map((b) => b.duration));
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);

  buffers.forEach((buffer, i) => {
    const track = audible[i];
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, (track.volume ?? 80) / 100));

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, (track.pan ?? 0) / 100));

    source.connect(gain).connect(panner).connect(ctx.destination);
    source.start(0);
  });

  const rendered = await ctx.startRendering();
  return {
    blob: audioBufferToWav(rendered, { bitDepth: 16 }),
    duration_seconds: +rendered.duration.toFixed(3),
    sample_rate: sampleRate,
  };
}