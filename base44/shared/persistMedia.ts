// Shared media persistence helpers — copy external provider/CDN URLs into
// Base44 storage so files never expire. Used by persistExternalMedia.

// SSRF guard — only allow public http(s) hostnames, never IP literals or internal hosts
export function isSafeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.toLowerCase();
  const ipv4 = /^\d{1,3}(\.\d{1,3}){3}$/;
  if (
    ipv4.test(host) || host.includes(':') ||
    host === 'localhost' || host.endsWith('.localhost') ||
    host.endsWith('.local') || host.endsWith('.internal') ||
    !host.includes('.')
  ) return false;
  return true;
}

// True when the URL is external (not already on Base44 storage)
export function isExternalUrl(url) {
  return !!url && typeof url === 'string' && /^https?:\/\//i.test(url) && !/base44/i.test(url);
}

// Fetch an external URL and re-upload it to Base44 storage.
// Returns { url, persisted } — url is the new permanent URL on success,
// the original URL when it's already internal, or null when the source is dead.
export async function persistUrl(base44, url, filename) {
  if (!isExternalUrl(url)) return { url, persisted: false };
  if (!isSafeUrl(url)) return { url: null, persisted: false };
  try {
    const r = await fetch(url);
    if (!r.ok) return { url: null, persisted: false }; // expired / dead link
    const blob = await r.blob();
    const safeName = (filename || 'file').replace(/[^\w.\-]/g, '_');
    const file = new File([blob], safeName, { type: blob.type || 'application/octet-stream' });
    const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    return up?.file_url ? { url: up.file_url, persisted: true } : { url: null, persisted: false };
  } catch {
    return { url: null, persisted: false };
  }
}