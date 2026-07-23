import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

// Lightweight audio metadata extractor: probes the file headers to estimate
// duration + format without loading the entire file. For richer analysis
// (key, BPM detection) the provider-returned values should be preferred —
// this function is the fallback when no provider metadata exists.

async function probeMp3Duration(arrayBuffer) {
  // MP3 ID3v2 header (if present): skip past it to find first frame.
  const view = new Uint8Array(arrayBuffer);
  let offset = 0;
  if (view.length > 10 && view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) {
    const size = ((view[6] & 0x7f) << 21) | ((view[7] & 0x7f) << 14) | ((view[8] & 0x7f) << 7) | (view[9] & 0x7f);
    offset = 10 + size;
  }
  // Find first MPEG frame sync (0xFF 0xFB/0xFA/0xF3/0xF2)
  for (let i = offset; i < Math.min(view.length - 4, offset + 4096); i++) {
    if (view[i] === 0xFF && (view[i + 1] & 0xE0) === 0xE0) {
      const versionBits = (view[i + 1] >> 3) & 0x03;   // 11=MPEG1, 10=MPEG2
      const layerBits   = (view[i + 1] >> 1) & 0x03;   // 01=LayerIII
      const bitrateIdx  = (view[i + 2] >> 4) & 0x0F;
      const sampleIdx   = (view[i + 2] >> 2) & 0x03;
      // MPEG1 Layer III bitrate table (kbps)
      const BITRATE = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
      const SAMPLERATE = [44100, 48000, 32000, 0];
      const bitrate = BITRATE[bitrateIdx] * 1000;
      const sampleRate = SAMPLERATE[sampleIdx];
      if (bitrate > 0 && sampleRate > 0) {
        // duration_seconds = file_size_bytes / (bitrate / 8)
        const durationSec = (arrayBuffer.byteLength * 8) / bitrate;
        return { duration: Math.round(durationSec), bitrate, sampleRate, container: 'mp3' };
      }
      break;
    }
  }
  return null;
}

function detectContainer(arrayBuffer) {
  const v = new Uint8Array(arrayBuffer, 0, Math.min(arrayBuffer.byteLength, 12));
  const s = String.fromCharCode(...v);
  if (s.startsWith('ID3') || (v[0] === 0xFF && (v[1] & 0xE0) === 0xE0)) return 'mp3';
  if (s.startsWith('RIFF') && s.includes('WAVE')) return 'wav';
  if (s.startsWith('fLaC')) return 'flac';
  if (s.includes('ftypM4A') || s.includes('ftypmp4') || s.includes('ftypisom')) return 'm4a';
  if (s.startsWith('OggS')) return 'ogg';
  return 'unknown';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const audio_url = body.audio_url || body.audioUrl;
    if (!audio_url) return Response.json({ error: 'Missing audio_url parameter' }, { status: 400 });

    // SSRF guard — reject non-http(s), IP-literal, loopback, and internal hosts
    let safeUrl;
    try {
      safeUrl = assertSafeUrl(audio_url);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    // Fetch only enough of the file to read headers (Range request)
    // — full duration calc needs file size, which we get from Content-Length.
    const headRes = await fetch(safeUrl, { method: 'HEAD', redirect: 'error' }).catch(() => null);
    const fileSize = headRes?.headers.get('content-length') ? parseInt(headRes.headers.get('content-length'), 10) : null;

    // Pull first 64KB for header analysis
    const partialRes = await fetch(safeUrl, { headers: { Range: 'bytes=0-65535' }, redirect: 'error' });
    const partial = await partialRes.arrayBuffer();
    const container = detectContainer(partial);

    let probe = null;
    if (container === 'mp3') {
      probe = await probeMp3Duration(partial);
      // Recompute duration using full file size if HEAD provided it (CBR assumption)
      if (probe && fileSize && probe.bitrate) {
        probe.duration = Math.round((fileSize * 8) / probe.bitrate);
      }
    }

    const metadata = {
      container,
      file_size: fileSize,
      duration: probe?.duration || null,
      bitrate: probe?.bitrate || null,
      sample_rate: probe?.sampleRate || null,
      // These need full audio analysis (librosa/essentia) — left null intentionally
      // so callers know to fall back to provider-returned values.
      bpm: null,
      key: null,
    };

    return Response.json({
      audio_url,
      metadata,
      extraction_timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});