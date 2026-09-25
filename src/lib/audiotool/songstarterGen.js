// In-house generators for the Songstarter module: BASE Forge (Stable Audio 2.5)
// for tempo-locked loops and ElevenLabs Sound Effects for risers/impacts/textures.
import { base44 } from '@/api/base44Client';
import { finishSoundForgeLoop } from '@/utils/finishSoundForgeLoop';

export const errorText = (e) => e?.response?.data?.message || e?.response?.data?.error || e.message;

async function waitForJob(jobId) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const { data } = await base44.functions.invoke('pollGenerationJob', { job_id: jobId });
    if (data?.status === 'completed') return data;
    if (data?.status === 'failed') throw new Error(data.error_message || 'Generation failed');
  }
  throw new Error('Still rendering — check Studio History in a moment.');
}

export async function runForgeLoop({ prompt, category, bpm, duration }) {
  const { data } = await base44.functions.invoke('generateLoopSample', {
    prompt, category, bpm: Number(bpm) || undefined, duration_seconds: duration,
  });
  let audioUrl = data.audio_url;
  let loop = data.loop || null;
  if (data.status !== 'completed') audioUrl = (await waitForJob(data.job_id)).audio_url;

  // MP3 from the provider → finished, bar-locked WAV.
  if (/\.mp3(\?|$)/i.test(audioUrl)) {
    const fin = await finishSoundForgeLoop({ audioUrl, jobId: data.job_id, bpm, category }).catch(() => null);
    if (fin?.audio_url) {
      audioUrl = fin.audio_url;
      loop = fin.loop;
    }
  }
  return { audioUrl, bpm: loop?.bpm || Number(bpm) || null };
}

export async function runSfx({ text, duration, loop }) {
  const { data } = await base44.functions.invoke('generateSoundEffect', {
    text, duration_seconds: duration || undefined, loop,
  });
  return { audioUrl: data.audio_url };
}