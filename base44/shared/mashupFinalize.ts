// Idempotent server-side finalization of a completed Mashup GenerationJob into
// a UserAsset. Decouples the library save from the user staying on the
// MashupStudio page — previously the only save path was client-side inside
// useJobPolling's onComplete callback, which silently dropped the finished
// track from the library whenever the user navigated away or the poller
// stopped before the job completed.
//
// Called from both aimusicapiWebhook (primary completer when configured) and
// pollGenerationJob (fallback completer). Safe to call from both — idempotent
// via job.output_metadata.mashup_asset_id and a metadata.mashup_job_id scan.

import { cosForDerived } from './cosStamp.ts';

const MASHUP_DESCRIPTION = 'Sonic mashup of 2 tracks';

// Parse user-supplied tags string into an array, tolerating string or array forms.
function normalizeTags(raw) {
  if (Array.isArray(raw)) return raw.map(s => String(s).trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export async function finalizeMashupAsset(base44, jobId) {
  if (!jobId) return null;
  try {
    const jobs = await base44.asServiceRole.entities.GenerationJob.filter({ id: jobId });
    const job = jobs?.[0];
    if (!job) return null;
    if (job.input_data?.task_kind !== 'mashup') return null;
    if (job.status !== 'completed') return null;

    // Fast idempotency: already stamped on output_metadata
    const stampedAssetId = job.output_metadata?.mashup_asset_id;
    if (stampedAssetId) {
      const existing = await base44.asServiceRole.entities.UserAsset.get(stampedAssetId).catch(() => null);
      if (existing) return existing;
    }

    // Slow idempotency: scan recent mashups for a metadata.mashup_job_id match
    // (catches the case where the asset was created but the stamp update failed)
    const recent = await base44.asServiceRole.entities.UserAsset
      .filter({ user_id: job.user_id, asset_type: 'mashup' }, '-created_date', 50)
      .catch(() => []);
    const match = (recent || []).find(a => a.metadata?.mashup_job_id === jobId);
    if (match) {
      await base44.asServiceRole.entities.GenerationJob.update(job.id, {
        output_metadata: { ...(job.output_metadata || {}), mashup_asset_id: match.id },
      }).catch(() => {});
      return match;
    }

    const m = job.output_metadata || {};
    const fileUrl = job.output_url || m.audio_url || (Array.isArray(m.audio_urls) ? m.audio_urls[0] : null);
    if (!fileUrl) return null;

    const sourceTitles = Array.isArray(job.input_data?.source_titles) ? job.input_data.source_titles : [];
    const sourceIds = Array.isArray(job.input_data?.assetIds) ? job.input_data.assetIds : [];
    const title = m.title || job.input_data?.title || 'Mashup';
    const providerTags = normalizeTags(m.tags);

    const asset = await base44.asServiceRole.entities.UserAsset.create({
      user_id: job.user_id,
      user_email: job.user_email,
      asset_type: 'mashup',
      title,
      description: MASHUP_DESCRIPTION,
      file_url: fileUrl,
      thumbnail_url: m.cover_image_url || undefined,
      origin: 'creator',
      ai_label: job.ai_label || 'ai_generated',
      ...cosForDerived({
        prompt: job.input_data?.prompt || job.input_data?.sound_prompt || '',
        sourceCount: sourceIds.length || 2,
        styleOrTags: providerTags,
      }).fields,
      tags: ['mashup', 'creator', 'sonic', ...providerTags],
      metadata: {
        bpm: m.bpm || job.input_data?.bpm || undefined,
        key: m.key || job.input_data?.key || undefined,
        duration: m.duration,
        lyrics: m.lyrics,
        provider: 'sonic',
        model_version: m.model_version || job.input_data?.model || null,
        clip_id: m.clip_id || null,
        source_count: 2,
        mashup_job_id: jobId, // idempotency marker — survives even if the stamp update fails
        provenance: {
          created_by: 'mashup_studio',
          providers_used: ['sonic'],
          remix_sources: sourceIds,
          source_titles: sourceTitles,
        },
      },
    });

    // Stamp job for fast lookup next time (both webhook-then-poll and re-polls)
    await base44.asServiceRole.entities.GenerationJob.update(job.id, {
      output_metadata: { ...m, mashup_asset_id: asset.id },
    }).catch(() => {});

    return asset;
  } catch (e) {
    console.warn('finalizeMashupAsset failed:', e?.message || e);
    return null;
  }
}