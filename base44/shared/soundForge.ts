// BASE SoundForge — our loop / one-shot / sample engine.
//
// Runs Stable Audio 2.5 via Replicate.
//
// Chosen 2026-08-02 on two grounds. Prompt adherence: ACE-Step 1.5 is a *song*
// model and kept inventing synth melodies over briefs that asked for a bare
// drum loop — unusable for sample-pack work. Cost: Replicate bills ~$0.20 per
// generation, against ~$0.25 equivalent on Stability's direct API (25 credits
// at $10 / 1,000), so the cheaper provider is also the better-sounding one here.
//
// This endpoint returns MP3. That used to disqualify it, because the finishing
// stage and BASE Mark V1 both need PCM — shared/mp3Decode.ts now decodes on
// arrival, so loops still land bar-locked, seamless, normalized and markable.
//
// Songs stay on ACE-Step 1.5 (shared/harmonix.ts). The two engines are
// deliberately split: song model for songs, audio model for loops.

// Pinned model id. This was previously read from an unregistered SOUNDFORGE_MODEL
// env var — a model slug is not a secret, and an unregistered env read is both a
// scanner finding and a silent-misconfiguration risk, so it is a constant now.
const REPLICATE_MODEL = 'stability-ai/stable-audio-2.5';

export const SOUNDFORGE_CREDIT_COST = 2;
export const SOUNDFORGE_MAX_DURATION = 30;

// Stable Audio 2.5 is a distilled model — 8 steps is its intended operating
// point and cfg_scale 1 is required at that step count.
const SOUNDFORGE_STEPS = 8;

function token() {
  const t = Deno.env.get('REPLICATE_API_TOKEN');
  if (!t) throw new Error('REPLICATE_API_TOKEN is not set');
  return t;
}

export function buildSoundForgeInput(prompt: string, duration: number) {
  return {
    prompt: prompt.slice(0, 1000),
    duration,
    steps: SOUNDFORGE_STEPS,
    cfg_scale: 1,
  };
}

export async function startSoundForge(input: unknown) {
  const res = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token()}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=55',
    },
    body: JSON.stringify({ input }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || 'BASE SoundForge request failed');
  return data;
}

export async function getSoundForgePrediction(id: string) {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { 'Authorization': `Bearer ${token()}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || 'BASE SoundForge poll failed');
  return data;
}

export function extractSoundForgeAudioUrl(output: any) {
  if (!output) return null;
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return output[0] || null;
  return output.url || null;
}