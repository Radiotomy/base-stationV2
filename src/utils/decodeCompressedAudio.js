import { audioBufferToWav } from '@/utils/wavEncoder';

/**
 * Convert a compressed audio file (MP3, OGG, M4A/MP4/AAC, WebM, FLAC)
 * into a 16-bit PCM WAV File using the browser's native decoder,
 * so the BASE Mark detector can scan its raw waveform.
 *
 * WAV files pass through untouched. Decoding happens at 44.1kHz —
 * the sample rate BASE Marks are embedded at.
 */
export async function fileToPcmWav(file) {
  const name = (file.name || 'audio').toLowerCase();
  if (name.endsWith('.wav') || file.type === 'audio/wav' || file.type === 'audio/x-wav') {
    return file;
  }
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: 1, sampleRate: 44100 });
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const blob = audioBufferToWav(audioBuffer, { bitDepth: 16 });
  const base = (file.name || 'audio').replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.wav`, { type: 'audio/wav' });
}