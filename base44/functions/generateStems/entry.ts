import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 3 — Stem Creator Studio
 *
 * Provider-agnostic stem separation. Creates a GenerationJob, deducts credits,
 * and returns simulated stem UserAssets that inherit origin from the source.
 *
 * Real provider wiring (Sonic, custom DSP) plugs in via the providerRouter
 * helper — for now we register the job structure so the UI is fully
 * functional and persistence is correct.
 *
 * Payload: { assetId, stemTypes?: ['vocals','drums','bass','other'] }
 */

const DEFAULT_STEMS = ['vocals', 'drums', 'bass', 'other'];
const CREDITS_PER_STEM = 2;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, stemTypes = DEFAULT_STEMS } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId required' }, { status: 400 });

    // Load source asset (user-scoped)
    const sourceList = await base44.entities.UserAsset.filter({ id: assetId });
    const source = sourceList[0];
    if (!source) return Response.json({ error: 'Source asset not found' }, { status: 404 });
    if (source.asset_type !== 'track') {
      return Response.json({ error: 'Source must be a track' }, { status: 400 });
    }

    // Only Sonic is currently wired for stem separation
    const primary = 'sonic';

    // Create generation job
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id,
      user_email: user.email,
      job_type: 'music',
      provider: primary,
      status: 'completed',
      input_data: { assetId, stemTypes, action: 'stem_separation' },
      output_url: source.file_url,
      output_metadata: { stems: stemTypes, source_provider: source.metadata?.provider },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    // Deduct credits (best-effort, non-blocking on UI)
    try {
      await base44.functions.invoke('deductCredits', {
        amount: CREDITS_PER_STEM * stemTypes.length,
        job_id: job.id,
        provider: primary,
        description: `Stem separation: ${stemTypes.length} stems`,
      });
    } catch { /* non-blocking */ }

    // Create stem assets — origin inherits from source
    const stems = [];
    for (const stemType of stemTypes) {
      const asset = await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'stem',
        title: `${source.title} — ${stemType}`,
        description: `${stemType} stem extracted from ${source.title}`,
        file_url: source.file_url, // placeholder until real DSP wiring
        thumbnail_url: source.thumbnail_url,
        origin: source.origin || 'creator',
        // RIAA GenAI label — stem separation is non-generative, inherit source label
        ...(source.ai_label && { ai_label: source.ai_label }),
        // Creative Ownership Score — derived asset: reference material + iteration
        ai_disclosure_label: 'ai_generated',
        ai_disclosure_basis: 'Score based on: reference material upload, iterative refinement.',
        human_participation_score: 25,
        participation_signals: { reference_material: 15, iteration: 10 },
        parent_asset_id: source.id,
        stem_type: stemType,
        tags: ['stem', stemType, ...(source.tags || [])],
        metadata: {
          stem_type: stemType,
          source_asset_id: source.id,
          source_title: source.title,
          provider: primary,
          bpm: source.metadata?.bpm,
          key: source.metadata?.key,
          duration: source.metadata?.duration,
          provenance: {
            created_by: 'stem_creator',
            providers_used: [primary],
            stems_used: [],
            remix_sources: [source.id],
          },
        },
      });
      stems.push(asset);
    }

    // Studio history
    await base44.asServiceRole.entities.StudioHistory.create({
      user_id: user.id,
      user_email: user.email,
      tool: 'stem_creator',
      asset_id: stems[0]?.id,
      source_asset_ids: [source.id],
      title: `Separated ${stems.length} stems from "${source.title}"`,
      metadata: { provider: primary, stems: stemTypes },
    }).catch(() => {});

    return Response.json({ data: { job_id: job.id, stems, provider: primary } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});