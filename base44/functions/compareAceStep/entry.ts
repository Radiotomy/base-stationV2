import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// Admin-only A/B harness for evaluating candidate base models for SoundForge
// (loops / one-shots / samples). Runs one identical brief through each engine so
// outputs can be auditioned side by side. Not wired into any user-facing flow.

const V15_VERSION = '74e3a7d383b18815e277de5223f5fe9d53d38832de15aa567fe729fa129d0d85';
const V1_VERSION = '280fc4f9ee507577f880a167f639c02622421d8fecf492454320311217b688f1';
const STABLE_AUDIO_MODEL = 'stability-ai/stable-audio-2.5';

async function apiPost(token: string, path: string, body: unknown) {
  const res = await fetch(`https://api.replicate.com/v1/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=60',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { error: data?.detail || JSON.stringify(data) };
  return { pred: data };
}

async function poll(token: string, id: string, maxMs: number) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const d = await r.json();
    if (d.status === 'succeeded' || d.status === 'failed' || d.status === 'canceled') return d;
  }
  return null;
}

function firstUrl(output: any) {
  if (!output) return null;
  if (Array.isArray(output)) return output[0] || null;
  if (typeof output === 'string') return output;
  return output.url || null;
}

async function settle(token: string, r: any) {
  if (r.error) return { error: r.error };
  let pred = r.pred;
  if (pred.status !== 'succeeded' && pred.status !== 'failed') {
    pred = (await poll(token, pred.id, 180000)) || pred;
  }
  return {
    status: pred.status,
    audio_url: firstUrl(pred.output),
    error: pred.error || null,
    predict_time: pred.metrics?.predict_time || null,
  };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const token = secrets.get('REPLICATE_API_TOKEN');
    if (!token) return Response.json({ error: 'REPLICATE_API_TOKEN is not set' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const prompt = body.prompt || '128 bpm drum kit kick, hit and hi-hat';
    const duration = Number(body.duration) || 10;
    const engines: string[] = body.engines || ['ace15', 'stableaudio'];

    // Surface Stable Audio's real input schema so we configure it from fact, not guesswork.
    let stableAudioSchema = null;
    if (body.schema) {
      const m = await fetch(`https://api.replicate.com/v1/models/${STABLE_AUDIO_MODEL}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const md = await m.json();
      stableAudioSchema = md?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties || md?.detail || null;
    }

    const jobs: [string, Promise<any>][] = [];
    if (engines.includes('ace15')) {
      jobs.push(['ace_step_1_5', apiPost(token, 'predictions', {
        version: V15_VERSION,
        input: {
          prompt, lyrics: '[Instrumental]', duration,
          inference_steps: 27, seed: 12345, batch_size: 1, audio_format: 'wav',
        },
      })]);
    }
    if (engines.includes('ace1')) {
      jobs.push(['ace_step_v1', apiPost(token, 'predictions', {
        version: V1_VERSION,
        input: { tags: prompt, lyrics: '[instrumental]', duration, number_of_steps: 60, seed: 12345 },
      })]);
    }
    if (engines.includes('stableaudio')) {
      jobs.push(['stable_audio_2_5', apiPost(token, `models/${STABLE_AUDIO_MODEL}/predictions`, {
        input: { prompt, duration, steps: 8, cfg_scale: 1, output_format: 'wav' },
      })]);
    }

    const started = await Promise.all(jobs.map(([, p]) => p));
    const result: Record<string, any> = {};
    for (let i = 0; i < jobs.length; i++) {
      result[jobs[i][0]] = await settle(token, started[i]);
    }

    return Response.json({ prompt, duration, stable_audio_schema: stableAudioSchema, ...result });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}