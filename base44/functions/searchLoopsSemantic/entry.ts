import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { embedText, cosineSimilarity, CLAP_MODEL } from '../../shared/clapEmbed.ts';

// Semantic loop search: embed the typed query, then score it against every
// stored loop embedding by cosine similarity.
//
// There is no vector index here, so this is an honest linear scan. That is fine
// at loop-library scale and is the reason this feature was scoped to loops
// first — it would need a real index before it could span a large catalog.
//
// Only loops the caller is entitled to see are scanned: their own plus public
// ones. The service role is used to read embeddings, so the ownership filter is
// applied EXPLICITLY rather than being left to RLS.
const MAX_SCAN = 2000;
const DEFAULT_LIMIT = 24;
// CLAP similarities are not calibrated across queries, so this is a floor for
// "clearly unrelated", not a quality bar. Without it a three-loop library
// returns every loop for every query and a 1% match reads as a real result.
const MIN_SCORE = 0.05;

function rankLoops(loops, queryVec, limit) {
  const scored = [];
  for (const loop of loops) {
    // A vector from a different checkpoint is not comparable — skip rather than
    // score it, otherwise a stale embedding silently pollutes the ranking.
    if (!Array.isArray(loop.clap_embedding)) continue;
    if (loop.clap_model && loop.clap_model !== CLAP_MODEL) continue;
    scored.push({ loop, score: cosineSimilarity(loop.clap_embedding, queryVec) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score >= MIN_SCORE).slice(0, limit);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const query = (body.query || '').trim();
    const scope = body.scope === 'mine' ? 'mine' : 'all';
    const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_LIMIT, 1), 60);
    if (!query) return Response.json({ error: 'query is required' }, { status: 400 });

    const svc = base44.asServiceRole.entities.LoopSample;
    const mine = await svc.filter({ user_id: user.id }, '-created_date', MAX_SCAN);
    let candidates = mine;
    if (scope === 'all') {
      const shared = await svc.filter({ is_public: true }, '-created_date', MAX_SCAN);
      const seen = new Set(mine.map((l) => l.id));
      candidates = mine.concat(shared.filter((l) => !seen.has(l.id)));
    }

    const embedded = candidates.filter((l) => Array.isArray(l.clap_embedding));
    if (embedded.length === 0) {
      return Response.json({
        results: [],
        scanned: candidates.length,
        embedded: 0,
        needs_indexing: candidates.length,
      });
    }

    const queryVec = await embedText(query);

    const results = rankLoops(embedded, queryVec, limit).map(({ loop, score }) => ({
      id: loop.id,
      title: loop.title,
      file_url: loop.file_url,
      category: loop.category,
      bpm: loop.bpm,
      key: loop.key,
      duration_seconds: loop.duration_seconds,
      tags: loop.tags || [],
      license: loop.license,
      attribution: loop.attribution,
      is_public: loop.is_public,
      is_mine: loop.user_id === user.id,
      score: Math.round(score * 1000) / 1000,
    }));

    return Response.json({
      results,
      scanned: candidates.length,
      embedded: embedded.length,
      needs_indexing: candidates.length - embedded.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}