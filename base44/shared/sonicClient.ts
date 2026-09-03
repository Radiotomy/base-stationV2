/**
 * Shared Sonic (aimusicapi.ai) client used by the newer Sonic functions
 * (stems, edit tools). Re-hosting + upload mirror the pattern proven in
 * generateCoverSong / extendUploadedMusic / generateMashup.
 */
import { assertSafeUrl } from './safeUrl.ts';

export const AI_BASE = 'https://api.aimusicapi.ai/api/v1';
const SONIC_API_KEY = Deno.env.get('SONIC_API_KEY');
const PINATA_JWT = Deno.env.get('PINATA_JWT');
const WEBHOOK_SECRET = Deno.env.get('AIMUSICAPI_WEBHOOK_SECRET') || '';

export const sonicHeaders = () => ({
  'Authorization': `Bearer ${SONIC_API_KEY}`,
  'Content-Type': 'application/json',
});

export function webhookConfig() {
  const url = Deno.env.get('AIMUSICAPI_WEBHOOK_URL');
  if (!url || !WEBHOOK_SECRET || !url.startsWith('https://') || url.length > 1024) return null;
  return { webhook_url: url, webhook_secret: WEBHOOK_SECRET };
}

/** POST to a Sonic endpoint; throws with providerStatus on non-2xx. */
export async function sonicPost(path: string, body: any, timeoutMs = 30000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${AI_BASE}${path}`, {
      method: 'POST', headers: sonicHeaders(), body: JSON.stringify(body), signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    console.log(`Sonic ${path} →`, res.status, JSON.stringify(data).slice(0, 500));
    if (!res.ok) {
      const err: any = new Error(data?.detail || data?.error || data?.message || `Sonic HTTP ${res.status}`);
      err.providerStatus = res.status;
      err.providerType = data?.type || null;
      throw err;
    }
    return data;
  } finally { clearTimeout(t); }
}

// Sonic HEAD-probes source URLs; Base44 file URLs 404 on HEAD, so they're pinned to IPFS first.
function isAlreadyPublic(u: string) {
  try {
    const h = new URL(u).hostname;
    if (h === 'media.base44.com') return true;
    if (h.endsWith('pinata.cloud') || h.endsWith('ipfs.io') || h.endsWith('w3s.link')) return true;
    if (h.endsWith('cdn1.suno.ai') || h.endsWith('cdn.suno.ai')) return true;
    return !/(^|\.)base44\.(app|com)$/.test(h) && !h.includes('preview-sandbox');
  } catch { return false; }
}

export async function ensurePublicUrl(sourceUrl: string) {
  if (isAlreadyPublic(sourceUrl)) return sourceUrl;
  if (!PINATA_JWT) throw new Error('PINATA_JWT not configured — cannot re-host audio for Sonic');
  const fileRes = await fetch(assertSafeUrl(sourceUrl));
  if (!fileRes.ok) throw new Error(`Failed to fetch source file (HTTP ${fileRes.status})`);
  const name = (sourceUrl.split('/').pop() || 'source.mp3').split('?')[0].replace(/[^\w.\-]/g, '_');
  const form = new FormData();
  form.append('file', await fileRes.blob(), name);
  form.append('pinataMetadata', JSON.stringify({ name }));
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST', headers: { 'Authorization': `Bearer ${PINATA_JWT}` }, body: form,
  });
  if (!res.ok) throw new Error(`Pinata upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
}

/** Upload a public URL to Sonic → clip_id (2 upstream credits). */
export async function uploadToSonic(publicUrl: string) {
  try {
    const data = await sonicPost('/sonic/upload', { url: publicUrl }, 60000);
    if (!data.clip_id) throw new Error('Sonic upload returned no clip_id');
    return data.clip_id as string;
  } catch (e: any) {
    const m = String(e.message).toLowerCase();
    if (m.includes('matches an existing recording') || m.includes('catalog')) {
      e.message = 'Sonic blocked this track: the source audio matches a copyrighted commercial recording in their catalog. Try an original, royalty-free, or AI-generated track instead.';
    }
    throw e;
  }
}

/**
 * Resolve a UserAsset to a Sonic clip_id. A Sonic-generated track already carries
 * one in metadata; anything else is uploaded once and the id cached on the asset.
 * `requireUploaded` forces the API-uploaded kind (add_vocals / add_instrumental only
 * accept clips that came through /sonic/upload).
 */
export async function resolveClipId(base44: any, asset: any, { requireUploaded = false } = {}) {
  const meta = asset.metadata || {};
  if (!requireUploaded && meta.clip_id) return { clipId: meta.clip_id as string, uploaded: false };
  if (meta.sonic_upload_clip_id) return { clipId: meta.sonic_upload_clip_id as string, uploaded: false };
  if (!asset.file_url) throw new Error('Source track has no audio file');
  const publicUrl = await ensurePublicUrl(asset.file_url);
  const clipId = await uploadToSonic(publicUrl);
  await base44.asServiceRole.entities.UserAsset.update(asset.id, {
    metadata: { ...meta, sonic_upload_clip_id: clipId, sonic_upload_at: new Date().toISOString() },
  }).catch(() => {});
  return { clipId, uploaded: true };
}

/** Map a Sonic stem name onto the UserAsset.stem_type enum (unknown → 'other'). */
export function sonicStemType(name: string) {
  const n = String(name || '').toLowerCase();
  if (n.includes('backing') || n.includes('harmony')) return 'harmony';
  if (n.includes('vocal') || n.includes('vox')) return 'vocals';
  if (n.includes('drum') || n.includes('percussion')) return 'drums';
  if (n.includes('bass')) return 'bass';
  if (n.includes('fx') || n.includes('effect')) return 'fx';
  if (n.includes('instrument')) return 'instruments';
  if (n.includes('synth') || n.includes('string') || n.includes('brass') || n.includes('wood') || n.includes('key') || n.includes('piano') || n.includes('guitar')) return 'melody';
  return 'other';
}