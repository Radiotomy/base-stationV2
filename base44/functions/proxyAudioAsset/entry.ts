// Server-side proxy: fetches an external audio URL and re-uploads it to
// Base44 storage so it can be played with CORS + Web Audio analysis.
// Used by the AI Mastering panel when a user picks a library track whose
// file_url is on an external CDN without CORS headers.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { source_url, filename } = await req.json();
    if (!source_url) return Response.json({ error: 'Missing source_url' }, { status: 400 });

    // If it's already on Base44 storage, just return it as-is
    if (/base44|app\.base44\.com/i.test(source_url)) {
      return Response.json({ file_url: source_url, proxied: false });
    }

    // Fetch the external file
    const r = await fetch(source_url);
    if (!r.ok) {
      return Response.json({ error: `Fetch failed: ${r.status}` }, { status: 502 });
    }
    const blob = await r.blob();
    const safeName = (filename || 'track.mp3').replace(/[^\w.\-]/g, '_');
    const file = new File([blob], safeName, { type: blob.type || 'audio/mpeg' });

    const uploaded = await base44.integrations.Core.UploadFile({ file });
    return Response.json({ file_url: uploaded.file_url, proxied: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});