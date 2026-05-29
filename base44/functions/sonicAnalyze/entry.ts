// Sonic post-generation analysis endpoints — BPM, aligned lyrics, upsample tags.
// All three share the same SONIC_API_KEY bearer auth and target https://api.aimusicapi.ai/api/v1
//
// Actions:
//   "bpm"          → POST /sonic/bpm             { clip_id }            → { avg_bpm, max_bpm, min_bpm }
//                    Note: clip_id must be created via our service, ideally within 24h. Costs 1 credit.
//   "aligned"      → POST /sonic/aligned-lyrics  { clip_id }            → { alignment: [{ word, start_s, end_s, ... }] }
//                    Returns word-level karaoke timing for embedded SYLT ID3 frames.
//   "upsample"     → POST /sonic/upsample-tags   { tags }               → { upsampled_tags }
//                    Pre-flight: turn "pop, happy" into rich pro descriptors. Costs 1 credit.
//
// For "bpm" and "aligned" the caller must pass clip_id. For "upsample" pass tags (string).

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

    const { action, clip_id, tags } = await req.json();

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

    return Response.json({ error: 'Unknown action. Use bpm, aligned, or upsample.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});