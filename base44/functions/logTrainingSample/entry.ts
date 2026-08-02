// Opt-in training telemetry for BASE-Harmonix.
//
// Consent is enforced HERE, server-side, not in the UI — a client that forgets
// to check the flag must not be able to create a sample anyway. Without an
// active opt-in this returns { skipped: true } rather than an error, so the
// caller can fire it unconditionally and ignore the result.
//
// Stores no audio and no third-party output. See ModelTrainingSample.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

export const CONSENT_VERSION = '2026-08-v1';

// Section tags only — never the lyric text. "[verse]\nline\n[chorus]" -> "verse,chorus"
function structureOf(lyrics = '') {
  const tags = String(lyrics).match(/^\[([a-z-]+)\]$/gim) || [];
  return tags.map((t) => t.replace(/[[\]]/g, '').toLowerCase()).join(',');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { sample_id, rating, rating_reason, outcome, asset_id } = body;

    if (!user.training_opt_in) return Response.json({ skipped: true, reason: 'no_consent' });

    // Update path — attaching a rating or outcome to an existing sample.
    if (sample_id) {
      const existing = await base44.asServiceRole.entities.ModelTrainingSample.get(sample_id).catch(() => null);
      if (!existing || existing.user_id !== user.id) {
        return Response.json({ error: 'Sample not found' }, { status: 404 });
      }
      const patch = {};
      if (rating) patch.rating = rating;
      if (rating_reason) patch.rating_reason = String(rating_reason).slice(0, 500);
      if (outcome) patch.outcome = outcome;
      if (asset_id) patch.asset_id = asset_id;
      const updated = await base44.asServiceRole.entities.ModelTrainingSample.update(sample_id, patch);
      return Response.json({ ok: true, sample: updated });
    }

    // Create path — a new generation was just run.
    const { provider, model, prompt, lyrics, genre, mood, duration, used_masters_engine, paired_with_id } = body;
    if (!provider) return Response.json({ error: 'provider is required' }, { status: 400 });

    const sample = await base44.asServiceRole.entities.ModelTrainingSample.create({
      user_id: user.id,
      provider,
      model: model || '',
      prompt: String(prompt || '').slice(0, 2000),
      lyrics_structure: structureOf(lyrics),
      genre: genre || '',
      mood: mood || '',
      duration: duration || undefined,
      used_masters_engine: !!used_masters_engine,
      outcome: outcome || 'generated',
      paired_with_id: paired_with_id || '',
      asset_id: asset_id || '',
      consent_version: CONSENT_VERSION,
    });

    return Response.json({ ok: true, sample_id: sample.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});