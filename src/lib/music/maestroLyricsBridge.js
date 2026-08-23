import { base44 } from '@/api/base44Client';

// Bridge between Quick Generate and the Maestro Superagent craft engine.
//
// Quick Generate does NOT write lyrics when Maestro Mode is on. It files a
// work order (GenerationJob, job_type 'lyrics', provider 'maestro') in
// 'pending' and waits. The Maestro sweep runs every 5 minutes, applies the
// full master craft engine, and flips the row to 'completed' with the
// mastercraft lyric + optimized style brief in output_metadata. Only then
// does the music job get built — so a track can never be generated from an
// un-crafted lyric.

const POLL_INTERVAL_MS = 15000;
// The sweep runs on a 5-minute cadence, so a freshly filed order can wait a
// full cycle before it is even picked up. The window covers several cycles.
const TIMEOUT_MS = 20 * 60 * 1000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export async function requestMaestroLyrics({ prompt, aiDecision, title, onStatus }) {
  const user = await base44.auth.me();
  const job = await base44.entities.GenerationJob.create({
    user_id: user.id,
    user_email: user.email,
    job_type: 'lyrics',
    provider: 'maestro',
    status: 'pending',
    input_data: {
      source: 'quick_generate',
      topic: prompt,
      title,
      genre: aiDecision?.genre || '',
      mood: aiDecision?.mood || '',
      bpm: aiDecision?.bpm,
      duration: aiDecision?.duration,
      sound_prompt: aiDecision?.sound_prompt || '',
      needs_lyrics: true,
    },
  });

  onStatus?.('pending', job.id);
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const fresh = await base44.entities.GenerationJob.get(job.id);

    if (fresh.status === 'completed') {
      return {
        job_id: job.id,
        lyrics: fresh.output_metadata?.lyrics || '',
        sound_prompt: fresh.output_metadata?.sound_prompt || '',
        metadata: fresh.output_metadata || {},
      };
    }
    if (fresh.status === 'failed' || fresh.status === 'cancelled') {
      throw new Error(fresh.error_message || 'Maestro craft engine could not complete this lyric.');
    }
    onStatus?.(fresh.status, job.id);
  }

  throw new Error('Maestro craft engine did not respond in time — try again, or switch Maestro Mode off to use the standard lyric engine.');
}