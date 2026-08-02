import { base44 } from '@/api/base44Client';
import { audioBufferToWav } from '@/utils/wavEncoder';

/**
 * Finish a SoundForge generation that arrived as MP3.
 *
 * Stable Audio (via Replicate) only emits MP3, and the loop finishing stage —
 * zero-crossing trim, bar-lock, seamless fold, -1 dBFS normalize — is pure PCM
 * DSP. Server-side MP3 decoding isn't available in the functions runtime, but
 * every browser ships a decoder, so we decode here, hand the backend real PCM,
 * and let the existing finishing stage run exactly as it does for WAV providers.
 *
 * WAV results are already finished server-side and skip this entirely.
 */
export async function finishSoundForgeLoop({ audioUrl, jobId, bpm, category }) {
  if (!audioUrl || !/\.mp3(\?|$)/i.test(audioUrl)) return null;

  const res = await fetch(audioUrl);
  const arrayBuffer = await res.arrayBuffer();

  // 44.1kHz is the rate BASE Marks are embedded at, so decode to match.
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: 1, sampleRate: 44100 });
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const blob = audioBufferToWav(audioBuffer, { bitDepth: 16 });
  const file = new File([blob], 'soundforge-decoded.wav', { type: 'audio/wav' });

  const { file_url } = await base44.integrations.Core.UploadFile({ file });

  const { data } = await base44.functions.invoke('polishLoopAudio', {
    job_id: jobId,
    wav_url: file_url,
    bpm: bpm || undefined,
    category,
  });
  if (data?.error) throw new Error(data.error);
  return data;
}