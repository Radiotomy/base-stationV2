/**
 * One generation = one library record.
 *
 * WHY THIS EXISTS: a finished generation is already written to the library
 * server-side (so the track survives a closed tab), and the studio page then
 * saved its own copy of the SAME recording under the ID3-tagged file URL. Two
 * rows, same audio, same job — the mirrored cards creators were seeing in their
 * workspace. Sonic legitimately returns two takes; nothing else does, so any
 * second card for a single take was a duplicate, not a variant.
 *
 * The page's payload is the richer one (tagged file, lyrics, masters brief,
 * full COS signals), so it WINS — but it lands as an update on the existing row
 * rather than as a new record.
 */

import { base44 } from '@/api/base44Client';

/**
 * @param matchUrl  the untagged provider/persisted URL the server saved under —
 *                  the only value both writers are guaranteed to share.
 */
export async function upsertTrackAsset({ userId, matchUrl, jobId = '', payload }) {
  let existing = null;
  // The job id is the durable identity: by the time the page saves, the server
  // row's file_url may already have been rewritten by the BASE Mark cascade.
  if (jobId) {
    const rows = await base44.entities.UserAsset
      .filter({ 'metadata.generation_job_id': jobId }, '-created_date', 20)
      .catch(() => []);
    existing = (rows || []).find((r) => !r.metadata?.take_number) || rows?.[0] || null;
  }
  if (!existing && userId && matchUrl) {
    const rows = await base44.entities.UserAsset.filter(
      { user_id: userId, asset_type: 'track', file_url: matchUrl },
      '-created_date',
      1,
    );
    existing = rows?.[0] || null;
  }

  if (!existing) return await base44.entities.UserAsset.create(payload);

  // Keep whatever the server recorded that the page has no view of —
  // content hash, generation_job_id, take number — and layer the page's
  // richer values on top.
  return await base44.entities.UserAsset.update(existing.id, {
    ...payload,
    metadata: { ...(existing.metadata || {}), ...(payload.metadata || {}) },
  });
}