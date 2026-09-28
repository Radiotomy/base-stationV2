// Kits.ai engine — the ONLY place the shared platform key is used.
//
// Kits allows 1 POST per minute per account (GETs are generous). Every
// conversion, harmony and blend is therefore filed as a 'pending' GenerationJob
// and POSTed by dispatchNext(), which claims the single KitsDispatch slot first.
// Polling drives the queue forward, so a render never needs its own timer.

import { secrets } from 'base44:runtime';
import { cosForDerived } from './cosStamp.ts';

const API = 'https://arpeggi.io/api/kits/v1';
export const KITS_SLOT_MS = 62_000;
export const KITS_COST: Record<string, number> = { conversion: 5, harmony: 4, blend: 8 };

function apiKey() {
  const k = secrets.get('KITS_API_KEY');
  if (!k) throw new Error('KITS_API_KEY is not set');
  return k;
}

export async function kitsGet(path: string) {
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${apiKey()}` } });
  if (!r.ok) throw new Error(`Kits ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function kitsPost(path: string, body: FormData | Record<string, unknown>) {
  const isForm = body instanceof FormData;
  const r = await fetch(API + path, {
    method: 'POST',
    headers: isForm
      ? { Authorization: `Bearer ${apiKey()}` }
      : { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON error body */ }
  return { status: r.status, ok: r.ok, json, text };
}

async function resolveUrl(base44: any, url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  const r = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: url, expires_in: 900 });
  return r.signed_url;
}

/** File a Kits render. It is POSTed by the dispatcher when the shared slot frees up. */
export async function enqueueKits(base44: any, user: any, kind: string, input: Record<string, unknown>) {
  const cost = KITS_COST[kind];
  const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id }).catch(() => []);
  if (credits[0] && (credits[0].balance || 0) < cost) {
    throw Object.assign(new Error(`Not enough credits (${cost} needed)`), { status: 402 });
  }
  const job = await base44.asServiceRole.entities.GenerationJob.create({
    user_id: user.id,
    user_email: user.email,
    job_type: 'music',
    provider: 'kits',
    status: 'pending',
    ai_label: input.source_ai_label === 'ai_generated' ? 'ai_generated' : 'ai_assisted',
    input_data: { ...input, kind, credit_cost: cost },
  });
  await dispatchNext(base44);
  return job;
}

/** POST the oldest pending job if the shared 1/min slot is free. */
export async function dispatchNext(base44: any) {
  const svc = base44.asServiceRole.entities;
  const locks = await svc.KitsDispatch.filter({ key: 'global' });
  const lock = locks[0];
  const since = lock?.last_post_at ? Date.now() - Date.parse(lock.last_post_at) : Infinity;
  if (since < KITS_SLOT_MS) return { dispatched: false, wait_ms: KITS_SLOT_MS - since };

  const next = (await svc.GenerationJob.filter({ provider: 'kits', status: 'pending' }, 'created_date', 1))[0];
  if (!next) return { dispatched: false, wait_ms: 0 };

  // Claim the slot BEFORE posting so a concurrent poll can't double-post.
  const stamp = { last_post_at: new Date().toISOString(), last_job_id: next.id };
  if (lock) await svc.KitsDispatch.update(lock.id, stamp);
  else await svc.KitsDispatch.create({ key: 'global', ...stamp });

  const input = next.input_data || {};
  let res;
  try {
    if (input.kind === 'blend') {
      const ids = (input.model_ids as string[]) || [];
      const alphas = (input.alphas as number[]) || [];
      const body: Record<string, unknown> = { title: input.title || 'BASE Station blend' };
      ids.forEach((id, i) => { body[`modelId${i + 1}`] = Number(id); });
      alphas.slice(0, ids.length - 1).forEach((a, i) => { body[i === 0 ? 'alpha' : `alpha${i + 1}`] = a; });
      res = await kitsPost('/voice-blender', body);
    } else {
      const audio = await fetch(await resolveUrl(base44, String(input.source_url)));
      if (!audio.ok) throw new Error(`Could not read the source vocal (${audio.status})`);
      const form = new FormData();
      form.append('voiceModelId', String(input.voice_model_id));
      form.append('soundFile', new File([await audio.arrayBuffer()], 'vocal.wav', { type: audio.headers.get('content-type') || 'audio/wav' }));
      form.append('pitchShift', String(input.pitch_shift ?? 0));
      form.append('conversionStrength', String(input.conversion_strength ?? 0.5));
      form.append('modelVolumeMix', String(input.model_volume_mix ?? 0.5));
      res = await kitsPost('/voice-conversions', form);
    }
  } catch (e) {
    await svc.GenerationJob.update(next.id, { status: 'failed', error_message: e.message });
    return { dispatched: false, wait_ms: 0 };
  }

  if (res.status === 429) return { dispatched: false, wait_ms: KITS_SLOT_MS }; // stays pending
  if (!res.ok || !res.json?.id) {
    await svc.GenerationJob.update(next.id, { status: 'failed', error_message: `Kits rejected the render (${res.status}): ${res.text.slice(0, 200)}` });
    return { dispatched: false, wait_ms: 0 };
  }
  await svc.GenerationJob.update(next.id, {
    status: 'processing',
    provider_job_id: String(res.json.id),
    started_at: new Date().toISOString(),
    input_data: { ...input, output_model_id: res.json.outputModelId ? String(res.json.outputModelId) : undefined },
  });
  if (input.kind === 'blend' && res.json.outputModelId) {
    await svc.KitsVoice.create({
      model_id: String(res.json.outputModelId), title: String(input.title || 'Blended voice'),
      user_id: next.user_id, source: 'blend', is_usable: false, blend_job_id: next.id,
      blend_inputs: input.blend_inputs || [],
    });
  }
  return { dispatched: true, wait_ms: KITS_SLOT_MS };
}

/** Position in line + honest ETA for a pending job. */
export async function queueInfo(base44: any, job: any, waitMs: number) {
  const pending = await base44.asServiceRole.entities.GenerationJob.filter({ provider: 'kits', status: 'pending' }, 'created_date', 100);
  const idx = pending.findIndex((j: any) => j.id === job.id);
  const position = idx < 0 ? 1 : idx + 1;
  return { position, eta_seconds: Math.round((waitMs + (position - 1) * KITS_SLOT_MS) / 1000) };
}

async function bill(base44: any, job: any, cost: number) {
  const svc = base44.asServiceRole.entities;
  const rec = (await svc.UserCredit.filter({ user_id: job.user_id }))[0];
  if (!rec) return;
  const after = Math.max(0, (rec.balance || 0) - cost);
  await svc.UserCredit.update(rec.id, {
    balance: after,
    lifetime_spent: (rec.lifetime_spent || 0) + cost,
    monthly_used: (rec.monthly_used || 0) + cost,
  });
  await svc.CreditLog.create({
    user_id: job.user_id, user_email: job.user_email, transaction_type: 'generation',
    amount: -cost, balance_before: rec.balance, balance_after: after,
    related_job_id: job.id, provider: 'kits', description: `Kits ${job.input_data?.kind}`,
  });
}

/** Check a processing job on Kits and file the result when it's done. */
export async function finalizeKits(base44: any, job: any) {
  const svc = base44.asServiceRole.entities;
  const input = job.input_data || {};
  const cost = Number(input.credit_cost || 0);

  if (input.kind === 'blend') {
    const b = await kitsGet(`/voice-blender/${job.provider_job_id}`);
    if (b.status === 'running') return { status: 'processing' };
    const voice = (await svc.KitsVoice.filter({ blend_job_id: job.id }))[0];
    if (b.status !== 'success') {
      await svc.GenerationJob.update(job.id, { status: 'failed', error_message: `Kits blend ${b.status}` });
      if (voice) await svc.KitsVoice.delete(voice.id);
      return { status: 'failed', error: `Kits blend ${b.status}` };
    }
    if (voice) await svc.KitsVoice.update(voice.id, { is_usable: true });
    await svc.GenerationJob.update(job.id, { status: 'completed', credits_used: cost, completed_at: new Date().toISOString(), output_metadata: { voice_id: voice?.id, model_id: String(b.outputModelId) } });
    await bill(base44, job, cost);
    return { status: 'completed', voice };
  }

  const c = await kitsGet(`/voice-conversions/${job.provider_job_id}`);
  if (c.status === 'running') return { status: 'processing' };
  if (c.status !== 'success' || !c.outputFileUrl) {
    await svc.GenerationJob.update(job.id, { status: 'failed', error_message: `Kits conversion ${c.status}` });
    return { status: 'failed', error: `Kits conversion ${c.status}` };
  }

  const dl = await fetch(c.outputFileUrl);
  if (!dl.ok) throw new Error(`Could not download the Kits render (${dl.status})`);
  const name = `${String(input.source_title || 'vocal').slice(0, 40).replace(/[^\w.\-]/g, '_')}_kits.wav`;
  const up = await base44.asServiceRole.integrations.Core.UploadFile({ file: new File([await dl.arrayBuffer()], name, { type: 'audio/wav' }) });
  if (!up?.file_url) throw new Error('Kits render upload failed');

  const isHarmony = input.kind === 'harmony';
  const label = input.source_ai_label === 'ai_generated' ? 'ai_generated' : 'ai_assisted';
  const { fields: cos } = cosForDerived({
    prompt: isHarmony ? `${input.harmony_type} harmony` : `voice conversion to ${input.voice_title}`,
    sourceCount: 1,
    styleOrTags: [String(input.harmony_type || 'conversion')],
    personaOrTemplate: true,
  });
  const asset = await svc.UserAsset.create({
    user_id: job.user_id,
    user_email: job.user_email,
    asset_type: isHarmony ? 'harmony' : (input.asset_type || 'track'),
    stem_type: isHarmony ? 'harmony' : (input.asset_type === 'stem' ? 'vocals' : undefined),
    title: isHarmony
      ? `${input.source_title} — ${input.harmony_type} harmony`
      : `${input.source_title} — ${input.voice_title} voice`,
    description: isHarmony
      ? `${input.harmony_type} harmony (${input.pitch_shift} semitones) sung by ${input.voice_title} via Kits.ai`
      : `Vocal converted to ${input.voice_title} via Kits.ai`,
    file_url: up.file_url,
    origin: 'creator',
    ...cos,
    ai_label: label,
    ai_disclosure_label: label,
    parent_asset_id: input.source_asset_id,
    tags: ['kits', isHarmony ? 'harmony' : 'voice-conversion', 'vocals'],
    metadata: {
      provider: 'kits',
      kits: {
        job_id: job.provider_job_id, voice_model_id: input.voice_model_id, voice_title: input.voice_title,
        pitch_shift: input.pitch_shift, conversion_strength: input.conversion_strength,
        model_volume_mix: input.model_volume_mix, source: 'kits',
      },
      harmony_type: input.harmony_type,
      context: input.context,
      source_asset_id: input.source_asset_id,
      provenance: {
        created_by: input.context || 'kits_conversion',
        providers_used: ['kits'],
        stems_used: [input.source_asset_id],
        remix_sources: [input.source_asset_id],
      },
    },
  });
  await svc.GenerationJob.update(job.id, {
    status: 'completed', output_url: up.file_url, credits_used: cost,
    completed_at: new Date().toISOString(), output_metadata: { asset_id: asset.id },
  });
  await bill(base44, job, cost);
  await svc.StudioHistory.create({
    user_id: job.user_id, user_email: job.user_email,
    tool: isHarmony ? 'vocal_harmonizer' : 'kits_conversion',
    asset_id: asset.id, source_asset_ids: [input.source_asset_id],
    title: asset.title, metadata: { provider: 'kits', voice: input.voice_title },
  }).catch(() => {});
  return { status: 'completed', asset };
}

/** Load a source vocal the caller owns + the voice they picked; shared by harmony & conversion. */
export async function loadSourceAndVoice(base44: any, assetId: string, voiceModelId: string) {
  const source = (await base44.entities.UserAsset.filter({ id: assetId }))[0];
  if (!source) throw Object.assign(new Error('Source vocal not found'), { status: 404 });
  const voice = (await base44.entities.KitsVoice.filter({ model_id: String(voiceModelId) }))[0];
  if (!voice) throw Object.assign(new Error('Pick a Kits voice you have access to'), { status: 400 });
  if (voice.is_usable === false) throw Object.assign(new Error('That voice is still being built'), { status: 400 });
  return {
    source,
    voice,
    input: {
      source_asset_id: source.id, source_title: source.title, source_url: source.file_url,
      source_ai_label: source.ai_label, voice_model_id: voice.model_id, voice_title: voice.title,
    },
  };
}