// Shared media persistence helpers — copy external provider/CDN URLs into
// Base44 storage so files never expire. Used by persistExternalMedia.

import { assertSafeUrl } from './safeUrl.ts';

// SSRF guard — delegates to the shared validator (public http(s) hostnames only)
export function isSafeUrl(raw) {
  try { assertSafeUrl(raw); return true; } catch { return false; }
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
    // redirect: 'manual' + manual hop validation — a public URL must not be
    // able to redirect the server into internal/metadata addresses
    let r = await fetch(url, { redirect: 'manual' });
    let hops = 0;
    while (r.status >= 300 && r.status < 400 && hops < 3) {
      const loc = r.headers.get('location');
      if (!loc) return { url: null, persisted: false };
      const next = new URL(loc, url).toString();
      if (!isSafeUrl(next)) return { url: null, persisted: false };
      r = await fetch(next, { redirect: 'manual' });
      hops++;
    }
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