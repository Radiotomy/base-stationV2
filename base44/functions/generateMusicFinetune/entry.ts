import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { EL_BASE, elError, checkCredits, deductCredits } from '../../shared/elevenFinetunes.ts';

// Generate a track with the user's trained Music Finetune (Music v2).
// POST https://api.elevenlabs.io/v1/music with { prompt, finetune_id, model_id, music_length_ms }
const GEN_COST = 10;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const key = Deno.env.get('ELEVENLABS_API');
    if (!key) return Response.json({ error: 'ELEVENLABS_API not configured' }, { status: 500 });

    const { record_id, prompt, duration_seconds = 60 } = await req.json();
    if (!record_id) return Response.json({ error: 'Missing record_id' }, { status: 400 });
    if (!prompt || !String(prompt).trim()) return Response.json({ error: 'Missing prompt' }, { status: 400 });

    const rec = await base44.entities.MusicFinetune.get(record_id);
    if (!rec || rec.user_id !== user.id) return Response.json({ error: 'Finetune not found' }, { status: 404 });
    if (rec.status !== 'completed') return Response.json({ error: 'Finetune is not ready yet' }, { status: 400 });

    // ── Credit gate ──────────────────────────────────────────────────────────
    const { record, balance, ok } = await checkCredits(base44, user, GEN_COST);
    if (!ok) {
      return Response.json({
        error: 'Insufficient credits', required: GEN_COST, balance,
        message: `Finetune generation costs ${GEN_COST} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    const lengthMs = Math.max(10, Math.min(300, Number(duration_seconds) || 60)) * 1000;
    const res = await fetch(`${EL_BASE}/music?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: String(prompt).slice(0, 2000),
        model_id: rec.model_id || 'music_v2',
        finetune_id: rec.elevenlabs_finetune_id,
        music_length_ms: lengthMs,
      }),
    });
    if (!res.ok) {
      const detail = await elError(res);
      console.error('ElevenLabs finetune compose error:', res.status, detail);
      return Response.json({ error: `ElevenLabs: ${detail}` }, { status: 502 });
    }

    const bytes = await res.arrayBuffer();
    const file = new File([bytes], `mysound-${Date.now()}.mp3`, { type: 'audio/mpeg' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const now = new Date().toISOString();

    // ── Save as a library asset with finetune provenance lineage ────────────
    const asset = await base44.entities.UserAsset.create({
      user_id: user.id, user_email: user.email,
      asset_type: 'track',
      title: `${rec.name} — ${String(prompt).slice(0, 60)}`,
      file_url,
      origin: 'creator',
      ai_label: 'ai_generated',
      tags: ['my-sound', ...(rec.tags || [])].slice(0, 10),
      metadata: {
        provider: 'elevenlabs', model: rec.model_id || 'music_v2',
        finetune_id: rec.elevenlabs_finetune_id, finetune_name: rec.name,
        finetune_record_id: rec.id, prompt: String(prompt).slice(0, 500),
        duration_seconds: lengthMs / 1000,
        provenance: { trained_on_own_tracks: true, source_track_titles: rec.source_track_titles || [] },
      },
    }).catch(() => null);

    const job = await base44.asServiceRole.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'elevenlabs',
      status: 'completed', ai_label: 'ai_generated',
      input_data: { prompt: String(prompt).slice(0, 500), finetune_id: rec.elevenlabs_finetune_id, finetune_name: rec.name, duration_seconds: lengthMs / 1000, credit_cost: GEN_COST },
      output_url: file_url, credits_used: GEN_COST,
      started_at: now, completed_at: now,
    }).catch(() => null);

    const newBalance = await deductCredits(base44, user, record, GEN_COST, `My Sound generation (${rec.name})`, job?.id);

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'elevenlabs', task: 'generate_music_finetune',
      credits_used: GEN_COST, status: 'success',
      timestamp: now, job_id: job?.id || null,
      metadata: { finetune_id: rec.elevenlabs_finetune_id, prompt: String(prompt).slice(0, 200) },
    }).catch(() => {});

    return Response.json({
      audio_url: file_url,
      asset_id: asset?.id || null,
      credits_used: GEN_COST,
      credits_remaining: newBalance,
    });
  } catch (error) {
    console.error('generateMusicFinetune error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});