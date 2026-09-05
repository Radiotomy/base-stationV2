// backfillTrackGenres — labels tracks that were generated BEFORE the studios
// asked for a genre.
//
// Those rows carry no genre at all, which is why publishing them fell back to a
// platform default. This infers one from what the generation actually recorded
// (title, prompt, style tags), constrained to the same closed vocabulary the
// studios now offer, and writes it onto the asset so every later consumer reads a
// real value.
//
// Inference is marked as such: metadata.genre_source = 'inferred_backfill'. An
// inferred label must stay distinguishable from one the creator chose, otherwise
// a guess would be indistinguishable from an authored claim about the recording.
//
// Admin-only, and dry_run by default so the proposed labels can be reviewed
// before anything is written.
//
// Payload: { dry_run?: boolean, limit?: number }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { AUDIUS_GENRES } from '../../shared/audiusMetadata.ts';
import { normalizeGenre } from '../../shared/trackMetadata.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const { dry_run = true, limit = 50 } = await req.json().catch(() => ({}));

    const tracks = await base44.asServiceRole.entities.UserAsset.filter({ asset_type: 'track' }, '-created_date', 400);
    const unlabelled = tracks.filter((t) => !t.metadata?.genre).slice(0, Math.min(Number(limit) || 50, 100));

    if (unlabelled.length === 0) {
      return Response.json({ data: { scanned: tracks.length, unlabelled: 0, results: [] } });
    }

    // One LLM call for the whole batch — per-track calls would multiply cost for
    // a decision that only ever reads a short text description.
    const items = unlabelled.map((t, i) => ({
      i,
      title: t.title || '',
      prompt: String(t.metadata?.prompt || t.metadata?.style_prompt || t.metadata?.tags || '').slice(0, 300),
    }));

    const inferred = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are labelling finished music recordings with a release genre.

For each item below, choose the single best genre STRICTLY from this list:
${AUDIUS_GENRES.join(', ')}

If the description is too vague to support a real judgement, return an empty string for that item rather than guessing — an unlabelled track is better than a wrong label.

Items:
${JSON.stringify(items)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          labels: {
            type: 'array',
            items: {
              type: 'object',
              properties: { i: { type: 'number' }, genre: { type: 'string' } },
            },
          },
        },
      },
    });

    const byIndex = new Map();
    for (const l of inferred?.labels || []) {
      // Normalized rather than trusted: a model can return a near-miss ("Hip Hop")
      // that the distribution channels would reject.
      const g = normalizeGenre(l?.genre);
      if (g) byIndex.set(Number(l.i), g);
    }

    const results = [];
    for (let i = 0; i < unlabelled.length; i++) {
      const asset = unlabelled[i];
      const genre = byIndex.get(i);
      results.push({ id: asset.id, title: asset.title, genre: genre || null });
      if (!genre || dry_run) continue;
      await base44.asServiceRole.entities.UserAsset.update(asset.id, {
        metadata: { ...(asset.metadata || {}), genre, genre_source: 'inferred_backfill' },
      }).catch((e) => console.warn(`Backfill failed for ${asset.id}: ${e.message}`));
    }

    return Response.json({
      data: {
        dry_run,
        scanned: tracks.length,
        unlabelled: unlabelled.length,
        labelled: results.filter((r) => r.genre).length,
        results,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});