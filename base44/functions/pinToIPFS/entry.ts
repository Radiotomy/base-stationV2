import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Pin track metadata (and optionally the audio file) to IPFS via Pinata.
 *
 * Returns a content-addressed CID + ipfs:// + https gateway URL — the
 * canonical "metadata_uri" written into BaseTrackRegistry / SolanaTrackRegistry.
 *
 * Payload (one of):
 *   { mode: 'metadata', metadata: {...}, name?: string }
 *     → pinJSONToIPFS, returns { cid, ipfs_uri, gateway_url }
 *
 *   { mode: 'file', file_url: string, name?: string }
 *     → fetches the file, pinFileToIPFS, returns { cid, ipfs_uri, gateway_url, size }
 *
 *   { mode: 'track', track: { title, artist, file_url, cover_url?, fingerprint_hash?, genre?, ai_tools_used?, description?, blockchain: 'base'|'solana' } }
 *     → pins audio + cover (if provided), then pins NFT-style metadata JSON
 *       that references them. Returns { metadata_cid, metadata_uri, audio_cid, cover_cid, gateway_url }.
 */

const PINATA_JWT = Deno.env.get('PINATA_JWT');
const PINATA_BASE = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

async function pinJSON(payload, name) {
  const res = await fetch(`${PINATA_BASE}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PINATA_JWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataMetadata: { name: name || 'basestation-metadata' },
      pinataContent: payload,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata pinJSON failed (${res.status}): ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.IpfsHash;
}

// SSRF guard — only allow public http(s) hostnames, never IP literals or internal hosts
function assertSafeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('Invalid URL'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only http(s) URLs are allowed');
  const host = u.hostname.toLowerCase();
  const ipv4 = /^\d{1,3}(\.\d{1,3}){3}$/;
  if (
    ipv4.test(host) || host.includes(':') ||
    host === 'localhost' || host.endsWith('.localhost') ||
    host.endsWith('.local') || host.endsWith('.internal') ||
    !host.includes('.')
  ) throw new Error('URL host not allowed');
  return u.toString();
}

async function pinFileFromUrl(fileUrl, name) {
  // Fetch the asset (URL validated against internal/loopback targets)
  const fileRes = await fetch(assertSafeUrl(fileUrl));
  if (!fileRes.ok) throw new Error(`Failed to fetch source file: ${fileRes.status}`);
  const blob = await fileRes.blob();

  // Build multipart form
  const form = new FormData();
  form.append('file', blob, name || 'asset');
  form.append('pinataMetadata', JSON.stringify({ name: name || 'basestation-asset' }));

  const res = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata pinFile failed (${res.status}): ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return { cid: data.IpfsHash, size: data.PinSize };
}

function cidToUris(cid) {
  return {
    cid,
    ipfs_uri: `ipfs://${cid}`,
    gateway_url: `${PINATA_GATEWAY}/${cid}`,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!PINATA_JWT) {
      return Response.json({ error: 'PINATA_JWT not configured' }, { status: 500 });
    }

    const { mode = 'metadata', metadata, file_url, name, track } = await req.json();

    // ── Mode: metadata ── pin a JSON blob ─────────────────────────────────
    if (mode === 'metadata') {
      if (!metadata || typeof metadata !== 'object') {
        return Response.json({ error: 'metadata object required' }, { status: 400 });
      }
      const cid = await pinJSON(metadata, name);
      return Response.json(cidToUris(cid));
    }

    // ── Mode: file ── pin a single file by URL ────────────────────────────
    if (mode === 'file') {
      if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });
      const { cid, size } = await pinFileFromUrl(file_url, name);
      return Response.json({ ...cidToUris(cid), size });
    }

    // ── Mode: track ── full provenance bundle for Base/Solana registration ─
    if (mode === 'track') {
      if (!track?.title || !track?.file_url) {
        return Response.json({ error: 'track.title and track.file_url required' }, { status: 400 });
      }

      // 1. Pin the audio file
      const audio = await pinFileFromUrl(track.file_url, `${track.title}-audio`);

      // 2. Pin cover art if provided
      let cover = null;
      if (track.cover_url) {
        try {
          cover = await pinFileFromUrl(track.cover_url, `${track.title}-cover`);
        } catch (_) {
          // non-fatal — continue without cover CID
          cover = null;
        }
      }

      // 3. Build NFT-style metadata JSON (ERC-721 / Metaplex compatible shape)
      const metadataJson = {
        name: track.title,
        description: track.description || `${track.title} by ${track.artist || 'Unknown'} — registered on ${track.blockchain || 'blockchain'} via Base Station`,
        image: cover ? `ipfs://${cover.cid}` : (track.cover_url || ''),
        animation_url: `ipfs://${audio.cid}`,
        external_url: `${PINATA_GATEWAY}/${audio.cid}`,
        attributes: [
          { trait_type: 'Artist', value: track.artist || 'Unknown' },
          { trait_type: 'Genre', value: track.genre || 'Unknown' },
          { trait_type: 'AI Tools', value: track.ai_tools_used || 'None' },
          { trait_type: 'Blockchain', value: track.blockchain || 'unknown' },
          { trait_type: 'Fingerprint (SHA-256)', value: track.fingerprint_hash || '' },
          { trait_type: 'Registered Via', value: 'Base Station' },
          { trait_type: 'Registered At', value: new Date().toISOString() },
        ],
        properties: {
          artist_id: track.artist_id || null,
          audio_cid: audio.cid,
          cover_cid: cover?.cid || null,
          fingerprint_hash: track.fingerprint_hash || null,
          blockchain: track.blockchain || null,
        },
      };

      const metadataCid = await pinJSON(metadataJson, `${track.title}-metadata`);

      return Response.json({
        metadata_cid: metadataCid,
        metadata_uri: `ipfs://${metadataCid}`,
        gateway_url: `${PINATA_GATEWAY}/${metadataCid}`,
        audio_cid: audio.cid,
        audio_uri: `ipfs://${audio.cid}`,
        cover_cid: cover?.cid || null,
        cover_uri: cover ? `ipfs://${cover.cid}` : null,
      });
    }

    return Response.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});