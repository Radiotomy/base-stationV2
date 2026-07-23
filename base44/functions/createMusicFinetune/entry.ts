import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { EL_BASE, elError, checkCredits, deductCredits } from '../../shared/elevenFinetunes.ts';

// Create an ElevenLabs Music Finetune (Music v2) from the user's own original tracks.
// POST https://api.elevenlabs.io/v1/music/finetunes (multipart/form-data)
const FINETUNE_COST = 25;
const MAX_TRACKS = 20;
const MAX_TRACK_BYTES = 30 * 1024 * 1024; // 30MB per ElevenLabs limit

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const key = Deno.env.get('ELEVENLABS_API');
    if (!key) return Response.json({ error: 'ELEVENLABS_API not configured' }, { status: 500 });

    const { name, primary_genre, tags = [], tracks = [] } = await req.json();
    if (!name || String(name).trim().length < 5) {
      return Response.json({ error: 'Name must be at least 5 characters' }, { status: 400 });
    }
    if (!primary_genre || !String(primary_genre).trim()) {
      return Response.json({ error: 'Primary genre is required' }, { status: 400 });
    }
    if (!Array.isArray(tracks) || tracks.length < 1 || tracks.length > MAX_TRACKS) {
      return Response.json({ error: `Select between 1 and ${MAX_TRACKS} tracks` }, { status: 400 });
    }

    // ── Credit gate ──────────────────────────────────────────────────────────
    const { record, balance, ok } = await checkCredits(base44, user, FINETUNE_COST);
    if (!ok) {
      return Response.json({
        error: 'Insufficient credits', required: FINETUNE_COST, balance,
        message: `Training a sound profile costs ${FINETUNE_COST} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    // ── Download training tracks + build multipart form ─────────────────────
    const form = new FormData();
    form.append('name', String(name).trim().slice(0, 200));
    form.append('primary_genre', String(primary_genre).trim());
    form.append('model_id', 'music_v2');
    form.append('visibility', 'private');
    for (const tag of tags.slice(0, 10)) form.append('tags', String(tag));

    for (const t of tracks) {
      if (!t?.url) continue;
      const r = await fetch(t.url);
      if (!r.ok) {
        return Response.json({ error: `Couldn't fetch track "${t.title || t.url}" (HTTP ${r.status})` }, { status: 400 });
      }
      const buf = await r.arrayBuffer();
      if (buf.byteLength > MAX_TRACK_BYTES) {
        return Response.json({ error: `Track "${t.title || 'untitled'}" exceeds the 30MB limit` }, { status: 400 });
      }
      const safeName = String(t.title || 'track').replace(/[^\w\- ]/g, '').slice(0, 80) || 'track';
      form.append('files', new File([buf], `${safeName}.mp3`, { type: r.headers.get('content-type') || 'audio/mpeg' }));
    }

    // ── Create the finetune ──────────────────────────────────────────────────
    const res = await fetch(`${EL_BASE}/music/finetunes`, {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: form,
    });
    if (!res.ok) {
      const detail = await elError(res);
      console.error('ElevenLabs finetune create error:', res.status, detail);
      return Response.json({ error: `ElevenLabs: ${detail}` }, { status: 502 });
    }
    const ft = await res.json();

    // ── Persist record + deduct credits ──────────────────────────────────────
    const rec = await base44.asServiceRole.entities.MusicFinetune.create({
      user_id: user.id, user_email: user.email,
      name: ft.name || name,
      primary_genre: ft.primary_genre || primary_genre,
      tags: ft.tags || tags,
      elevenlabs_finetune_id: ft.id,
      model_id: ft.model_id || 'music_v2',
      status: ft.status || 'pending',
      training_progress: ft.training_progress || 0,
      source_track_titles: tracks.map((t) => t.title || 'untitled'),
      source_asset_ids: tracks.map((t) => t.asset_id).filter(Boolean),
      credits_used: FINETUNE_COST,
    });

    const newBalance = await deductCredits(base44, user, record, FINETUNE_COST, `Music finetune training: ${name}`);

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'elevenlabs', task: 'create_music_finetune',
      credits_used: FINETUNE_COST, status: 'success',
      timestamp: new Date().toISOString(),
      metadata: { finetune_id: ft.id, name, primary_genre, track_count: tracks.length },
    }).catch(() => {});

    return Response.json({ finetune: rec, credits_remaining: newBalance });
  } catch (error) {
    console.error('createMusicFinetune error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});