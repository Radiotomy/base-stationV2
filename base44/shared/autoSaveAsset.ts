// Auto-save a finished GenerationJob into the creator's library.
//
// WHY THIS EXISTS: until now the UserAsset was only created by the studio page
// when it saw the generation finish. The generation itself runs on the
// provider's servers and survives anything the browser does — but if the user
// refreshed, closed the tab, or the build reloaded, the audio was produced,
// paid for in credits, and then never written to the library. It could only be
// recovered by hand out of GenerationJob. The save now happens server-side at
// finalize time, so it does not depend on a page being open.
//
// Idempotent by output_url: finalizeJob is safe to call repeatedly, and the
// studio page may still create its own asset, so this must never double-write.

// GenerationJob.job_type -> UserAsset.asset_type.
// 'loop' is deliberately absent: loops are LoopSample records, not UserAssets.
// Mashups are also skipped here — finalizeMashupAsset already builds those with
// their parent lineage, which this generic path cannot reconstruct.
const ASSET_TYPE_BY_JOB = {
  music: 'track',
  video: 'video',
  sfx: 'sfx',
  cover_art: 'coverart',
};

export async function autoSaveJobAsset(base44, job, providerData, outputUrl) {
  const assetType = ASSET_TYPE_BY_JOB[job.job_type];
  if (!assetType || !outputUrl || !job.user_id) return null;
  if (job.input_data?.task_kind === 'mashup') return null;

  const svc = base44.asServiceRole || base44;

  const existing = await svc.entities.UserAsset.filter({ file_url: outputUrl }).catch(() => []);
  if (existing.length > 0) return existing[0];

  const p = providerData || {};
  const title = job.input_data?.title || p.title || `${job.provider} ${job.job_type}`;

  return await svc.entities.UserAsset.create({
    user_id: job.user_id,
    user_email: job.user_email,
    asset_type: assetType,
    title: String(title).slice(0, 120),
    file_url: outputUrl,
    thumbnail_url: p.cover_image_url || undefined,
    origin: 'creator',
    is_public: false,
    ...(job.job_type === 'music' && {
      ai_label: job.ai_label || 'ai_generated',
      ai_disclosure_label: 'ai_generated',
    }),
    metadata: {
      generation_job_id: job.id,
      provider: job.provider,
      tier: job.input_data?.tier || null,
      prompt: job.input_data?.prompt || job.input_data?.sound_prompt || null,
      duration: p.duration || job.input_data?.duration || null,
      bpm: p.bpm || null,
      key: p.key || null,
      genre: p.genre || job.input_data?.genre || null,
      mood: p.mood || job.input_data?.mood || null,
      lyrics: p.lyrics || null,
      cover_image_url: p.cover_image_url || null,
      wav_url: p.wav_url || null,
      model_version: p.model_version || job.input_data?.model || null,
      auto_saved: true,
      ...(p.needs_basemark && { needs_basemark: true }),
    },
  });
}