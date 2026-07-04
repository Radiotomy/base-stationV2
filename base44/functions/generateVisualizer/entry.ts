import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 3 — AI Visualizer Studio
 *
 * Provider-agnostic visualizer video generation (LTX, custom shader templates).
 *
 * Payload: { assetId, style: 'spectrum' | 'particles' | 'waveform' | 'liquid' | 'cinematic' }
 */

const CREDITS_PER_VISUALIZER = 12;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId, style = 'milkdrop', preset = null } = await req.json();
    if (!assetId) return Response.json({ error: 'assetId required' }, { status: 400 });
    if (typeof style !== 'string' || !style.trim()) {
      return Response.json({ error: 'style (MilkDrop preset name) required' }, { status: 400 });
    }

    const arr = await base44.entities.UserAsset.filter({ id: assetId });
    const source = arr[0];
    if (!source) return Response.json({ error: 'Source asset not found' }, { status: 404 });

    // Visuals render client-side with Butterchurn (MilkDrop engine) — no external provider.
    const primary = 'milkdrop';

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id,
      user_email: user.email,
      job_type: 'video',
      provider: 'sonic', // schema enum compatibility — real renderer is milkdrop (see output_metadata)
      status: 'completed',
      input_data: { assetId, style, action: 'visualizer' },
      output_url: source.file_url,
      output_metadata: { visualizer_style: style, video_provider: primary },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    try {
      await base44.functions.invoke('deductCredits', {
        amount: CREDITS_PER_VISUALIZER,
        job_id: job.id,
        provider: 'sonic',
        description: `Visualizer (${style}) for ${source.title}`,
      });
    } catch { /* non-blocking */ }

    const visualizer = await base44.entities.UserAsset.create({
      user_id: user.id,
      user_email: user.email,
      asset_type: 'visualizer',
      title: `${source.title} — ${style} visualizer`,
      description: `${style} visualizer generated from ${source.title}`,
      file_url: source.file_url,
      thumbnail_url: source.thumbnail_url,
      origin: source.origin === 'audius' ? 'audius' : 'creator',
      parent_asset_id: source.id,
      tags: ['visualizer', style, 'video'],
      metadata: {
        visualizer_style: style,
        milkdrop_preset: preset,
        source_asset_id: source.id,
        source_title: source.title,
        provider: primary,
        provenance: {
          created_by: 'visualizer_studio',
          providers_used: [primary],
          visualizer_style: style,
          remix_sources: [source.id],
        },
      },
    });

    await base44.asServiceRole.entities.StudioHistory.create({
      user_id: user.id,
      user_email: user.email,
      tool: 'visualizer_studio',
      asset_id: visualizer.id,
      source_asset_ids: [source.id],
      title: `Generated ${style} visualizer for "${source.title}"`,
      metadata: { provider: primary, style },
    }).catch(() => {});

    return Response.json({ data: { job_id: job.id, asset: visualizer, provider: primary } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});