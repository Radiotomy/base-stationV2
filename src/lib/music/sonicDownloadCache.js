import { base44 } from '@/api/base44Client';

/**
 * One Sonic /download call per clip, shared across the session.
 *
 * The provider charges 2 credits per CALL no matter how many formats are asked
 * for, so we always request mp3 + wav + m4a together and cache the result: a
 * creator who grabs the WAV and then the MP3 pays once, not twice. In-flight
 * promises are cached too, so two buttons rendering at the same time can't
 * both spend.
 *
 * A 202 means the files are still copying to the CDN and costs nothing, so a
 * pending response is NOT cached — the next click retries.
 */
const cache = new Map();

export const SONIC_DOWNLOAD_FORMATS = ['mp3', 'wav', 'm4a'];

export function getSonicDownload(clipId, { assetId } = {}) {
  if (cache.has(clipId)) return cache.get(clipId);

  const promise = base44.functions
    .invoke('getWavUrl', {
      clip_id: clipId,
      provider: 'sonic',
      format: SONIC_DOWNLOAD_FORMATS,
      ...(assetId ? { asset_id: assetId } : {}),
    })
    .then((res) => {
      const data = res?.data || {};
      if (data.pending) {
        cache.delete(clipId);
        throw new Error('Sonic is still preparing the files — try again in a few seconds.');
      }
      return data;
    })
    .catch((err) => {
      cache.delete(clipId);
      throw err;
    });

  cache.set(clipId, promise);
  return promise;
}