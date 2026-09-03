// Sonic post-generation analysis endpoints — BPM, aligned lyrics, upsample tags, VOX.
// All share the same SONIC_API_KEY bearer auth and target https://api.aimusicapi.ai/api/v1
// Re-audited 2026-09-03 against docs.aimusicapi.ai/llms.txt.
//
// Actions:
//   "bpm"          → POST /sonic/bpm             { clip_id }            → { avg_bpm, max_bpm, min_bpm }
//                    clip_id must be created via our service, ideally within 24h. 1 credit.
//   "aligned"      → POST /sonic/aligned-lyrics  { clip_id }            → { alignment: [{ word, start_s, end_s, p_align, success }] }
//                    Word-level karaoke timing for SYLT ID3 frames. 1 credit on FIRST call,
//                    repeat calls for the same clip are free upstream.
//   "upsample"     → POST /sonic/upsample-tags   { tags }               → { upsampled_tags }
//                    Pre-flight: turn "pop, happy" into rich pro descriptors. 1 credit.
//   "vox"          → POST /sonic/vox             { clip_id, vocal_start_s?, vocal_end_s? }
//                    Isolated vocal extraction (range ≤ 30s when given). 1 credit.
//                    → { vox_audio_id, status, source_clip_id, vocal_start_s, vocal_end_s, wave_response }
//
// For "bpm", "aligned" and "vox" the caller must pass clip_id. For "upsample" pass tags (string).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SONIC_API_KEY = Deno.env.get('SONIC_API_KEY');
const AI_BASE = 'https://api.aimusicapi.ai/api/v1';

async function callSonic(path, body) {
  const res = await fetch(`${AI_BASE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data?.code !== 200) {
    throw new Error(data?.message || `Sonic ${path} failed: ${res.status}`);
  }
  return data.data;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, clip_id, tags, vocal_start_s, vocal_end_s } = await req.json();

    if (action === 'vox') {
      if (!clip_id) return Response.json({ error: 'Missing clip_id' }, { status: 400 });
      const body = { clip_id };
      if (Number.isFinite(Number(vocal_start_s)) && Number.isFinite(Number(vocal_end_s))) {
        const s = Math.max(0, Number(vocal_start_s));
        const e = Number(vocal_end_s);
        if (e <= s || e - s > 30) return Response.json({ error: 'Vocal range must be 0–30 seconds long' }, { status: 400 });
        body.vocal_start_s = s; body.vocal_end_s = e;
      }
      const result = await callSonic('/sonic/vox', body);
      return Response.json(result);
    }

    if (action === 'bpm') {
      if (!clip_id) return Response.json({ error: 'Missing clip_id' }, { status: 400 });
      const result = await callSonic('/sonic/bpm', { clip_id });
      return Response.json({
        avg_bpm: result.avg_bpm,
        max_bpm: result.max_bpm,
        min_bpm: result.min_bpm,
      });
    }

    if (action === 'aligned') {
      if (!clip_id) return Response.json({ error: 'Missing clip_id' }, { status: 400 });
      const result = await callSonic('/sonic/aligned-lyrics', { clip_id });
      return Response.json({ alignment: result.alignment || [] });
    }

    if (action === 'upsample') {
      if (!tags || typeof tags !== 'string') return Response.json({ error: 'Missing tags' }, { status: 400 });
      const result = await callSonic('/sonic/upsample-tags', { tags });
      return Response.json({ upsampled_tags: result.upsampled_tags || tags });
    }

    return Response.json({ error: 'Unknown action. Use bpm, aligned, upsample, or vox.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});