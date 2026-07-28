// Public passthrough that streams a stored Base44 audio file to external AI providers.
// Base44's file API returns 404 on HEAD, which causes Sonic's /sonic/upload fetcher
// to reject. This endpoint handles HEAD + GET correctly, and accepts the target URL
// as a base64url-encoded path segment so the proxy URL ends in ".mp3" (some providers
// validate the URL's file extension before fetching).
//
// Usage:
//   GET  /.../streamAudioForProvider/<base64url(target)>.mp3
//   GET  /.../streamAudioForProvider?u=<encoded target>   (legacy, still supported)
//
// Auth: intentionally unauthenticated — the URL itself is the capability.
// Only Base44-owned hosts are proxied to prevent open-proxy abuse.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

// Strict suffix match on Base44-owned domains only — no substring checks,
// so lookalike hosts (e.g. preview-sandbox-attacker.com) are rejected.
function isAllowedHost(hostname) {
  return /(^|\.)base44\.(app|com|dev)$/.test(hostname);
}

// Fetch with redirect: 'manual' and re-validate the target host on every
// redirect hop, so a base44-owned URL that 302s to an internal/metadata
// address can't turn this proxy into an SSRF sink.
async function safeFetch(target, init = {}) {
  let r = await fetch(target, { ...init, redirect: 'manual' });
  let hops = 0;
  let current = target;
  while (r.status >= 300 && r.status < 400 && hops < 5) {
    const loc = r.headers.get('location');
    if (!loc) break;
    let next;
    try { next = new URL(loc, current).toString(); }
    catch { return new Response('Bad redirect', { status: 400 }); }
    if (!isAllowedHost(new URL(next).hostname)) {
      return new Response('Forbidden redirect host', { status: 403 });
    }
    r = await fetch(next, { ...init, redirect: 'manual' });
    current = next;
    hops++;
  }
  return r;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let target = url.searchParams.get('u');

    // Path-based form: /.../streamAudioForProvider/<b64url>.<ext>
    if (!target) {
      const segs = url.pathname.split('/').filter(Boolean);
      const last = segs[segs.length - 1] || '';
      const stripped = last.replace(/\.(mp3|wav|m4a|ogg|flac)$/i, '');
      if (stripped && stripped !== 'streamAudioForProvider') {
        try { target = b64urlDecode(stripped); } catch { /* ignore */ }
      }
    }
    if (!target) return new Response('Missing target', { status: 400 });

    // Only proxy Base44-owned hosts
    let host;
    try { host = new URL(target).hostname; }
    catch { return new Response('Bad url', { status: 400 }); }
    if (!isAllowedHost(host)) return new Response('Forbidden host', { status: 403 });

    // HEAD: probe upstream with a tiny GET (Base44 file API 404s on HEAD), then return headers.
    if (req.method === 'HEAD') {
      const upstream = await safeFetch(target, { method: 'GET', headers: { Range: 'bytes=0-1' } });
      if (upstream.status === 403 || upstream.status === 400) return upstream;
      const headers = new Headers();
      const ct = upstream.headers.get('content-type'); headers.set('content-type', ct || 'audio/mpeg');
      const cl = upstream.headers.get('content-length'); if (cl) headers.set('content-length', cl);
      headers.set('accept-ranges', 'bytes');
      return new Response(null, { status: upstream.ok || upstream.status === 206 ? 200 : upstream.status, headers });
    }

    // GET (with optional Range): stream through
    const fwdHeaders = {};
    const range = req.headers.get('range'); if (range) fwdHeaders['Range'] = range;
    const upstream = await safeFetch(target, { headers: fwdHeaders });
    if (upstream.status === 403 || upstream.status === 400) return upstream;
    const headers = new Headers();
    const ct = upstream.headers.get('content-type'); headers.set('content-type', ct || 'audio/mpeg');
    const cl = upstream.headers.get('content-length'); if (cl) headers.set('content-length', cl);
    const cr = upstream.headers.get('content-range'); if (cr) headers.set('content-range', cr);
    headers.set('accept-ranges', 'bytes');
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    return new Response('Proxy error: ' + error.message, { status: 500 });
  }
});