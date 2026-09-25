// "Local audio trick": Audiotool exposes no external transport, so assets are
// auditioned inside BASE Station from a local WAV copy before they are pushed
// into the session. Everything is normalised to PCM WAV here — compressed
// sources (ElevenLabs MP3, Freesound previews) are decoded in the browser.
import { base44 } from '@/api/base44Client';
import { audioBufferToWav } from '@/utils/wavEncoder';

async function fetchBytes(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.arrayBuffer();
  } catch {
    // CDN without CORS headers — re-host through our own storage.
    const { data } = await base44.functions.invoke('proxyAudioAsset', { source_url: url, filename: 'asset' });
    const r = await fetch(data.file_url);
    if (!r.ok) throw new Error("Couldn't load this audio.");
    return r.arrayBuffer();
  }
}

const tag = (buf, from, to) => String.fromCharCode(...new Uint8Array(buf.slice(from, to)));
const isWav = (buf) => buf.byteLength > 12 && tag(buf, 0, 4) === 'RIFF' && tag(buf, 8, 12) === 'WAVE';

export const safeName = (name) =>
  (name || 'base-station').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'base-station';

/** Fetches any audio URL and returns it as a PCM WAV File. */
export async function loadAsWavFile(url, name) {
  const buf = await fetchBytes(url);
  let blob;
  if (isWav(buf)) {
    blob = new Blob([buf], { type: 'audio/wav' });
  } else {
    const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: 1, sampleRate: 44100 });
    blob = audioBufferToWav(await ctx.decodeAudioData(buf), { bitDepth: 16 });
  }
  return new File([blob], `${safeName(name)}.wav`, { type: 'audio/wav' });
}