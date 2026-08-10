import { base44 } from '@/api/base44Client';

/**
 * Upload a browser File to Pinata IPFS through BASE Station's existing
 * pinToIPFS backend function (ORVO never calls Pinata directly).
 *
 * 1. File → platform storage (Core.UploadFile) to get a fetchable URL
 * 2. URL → pinToIPFS (mode: 'file') → { cid, gateway_url }
 *
 * Returns { cid, gateway_url }.
 */
export async function uploadToPinata(file, name) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  const res = await base44.functions.invoke('pinToIPFS', {
    mode: 'file',
    file_url,
    name: name || file.name,
  });
  if (res.data?.error) throw new Error(res.data.error);
  return { cid: res.data.cid, gateway_url: res.data.gateway_url };
}

/** Extract audio duration (seconds) client-side before upload. */
export function extractAudioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}