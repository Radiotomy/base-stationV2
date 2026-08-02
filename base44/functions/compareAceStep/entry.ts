import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// Admin-only A/B harness: runs one identical brief through ACE-Step v1
// (lucataco/ace-step) and ACE-Step 1.5 (fishaudio/ace-step-1.5) so the two
// outputs can be listened to side by side before we commit to a base model.
// Deliberately not wired into any user-facing flow.

const V1_VERSION = '280fc4f9ee507577f880a167f639c02622421d8fecf492454320311217b688f1';
const V15_VERSION = '74e3a7d383b18815e277de5223f5fe9d53d38832de15aa567fe729fa129d0d85';

async function runPrediction(token, version, input) {
  const started = Date.now();
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=60',
    },
    body: JSON.stringify({ version, input }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data?.detail || JSON.stringify(data) };
  return { pred: data, elapsed_ms: Date.now() - started };
}

async function poll(token, id, maxMs) {
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

function firstUrl(output) {
  if (!output) return null;
  if (Array.isArray(output)) return output[0] || null;
  if (typeof output === 'string') return output;
  return output.url || null;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const token = secrets.get('REPLICATE_API_TOKEN');
    if (!token) return Response.json({ error: 'REPLICATE_API_TOKEN is not set' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const prompt = body.prompt || 'punchy tech house drum loop, tight kick, crisp hats, dry, 128 BPM';
    const duration = Number(body.duration) || 10;

    // Same brief, each expressed in that model's own schema.
    const v1Input = {
      tags: prompt,
      lyrics: '[instrumental]',
      duration,
      number_of_steps: 60,
      seed: 12345,
    };
    const v15Input = {
      prompt,
      lyrics: '[Instrumental]',
      duration,
      inference_steps: 27,
      seed: 12345,
      batch_size: 1,
      audio_format: 'wav',
    };

    const [a, b] = await Promise.all([
      runPrediction(token, V1_VERSION, v1Input),
      runPrediction(token, V15_VERSION, v15Input),
    ]);

    const result = {};
    for (const [key, r] of [['v1_lucataco', a], ['v15_fishaudio', b]]) {
      if (r.error) { result[key] = { error: r.error }; continue; }
      let pred = r.pred;
      if (pred.status !== 'succeeded' && pred.status !== 'failed') {
        pred = (await poll(token, pred.id, 180000)) || pred;
      }
      result[key] = {
        status: pred.status,
        audio_url: firstUrl(pred.output),
        error: pred.error || null,
        predict_time: pred.metrics?.predict_time || null,
        wall_ms: r.elapsed_ms,
      };
    }

    return Response.json({ prompt, duration, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}