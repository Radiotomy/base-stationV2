import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Using jsmediatags to read ID3v2 and write back
// For simplicity, we'll handle ID3v2.4 tags via fetching the file and re-encoding with new tags

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { audio_url, tags = {}, cover_image_url, asset_id } = await req.json();
    if (!audio_url) return Response.json({ error: 'Missing audio_url' }, { status: 400 });

    // ── COS provenance auto-injection ──────────────────────────────────────
    // When asset_id is provided, pull the asset's COS/DDEX provenance and embed
    // it as TXXX frames + a WXXX PROVENANCE_MANIFEST link to the public ledger.
    let provenanceEmbedded = false;
    if (asset_id) {
      try {
        const rows = await base44.asServiceRole.entities.UserAsset.filter({ id: asset_id });
        const src = rows[0];
        if (src && (src.user_id === user.id || user.role === 'admin')) {
          const sig = src.participation_signals || {};
          const score = src.human_participation_score ?? 0;
          const ddex = (src.ddex_ai_metadata && Object.keys(src.ddex_ai_metadata).length > 0)
            ? src.ddex_ai_metadata
            : {
                ai_lyrical_content: !sig.user_content,
                ai_composition: score < 50,
                ai_instrumentation: !sig.reference_material,
                ai_generated_vocals: !!sig.persona_used,
                ai_post_production: src.asset_type === 'master',
              };
          tags.txxx = {
            BASE_STATION_COS: String(score),
            AI_DISCLOSURE_LABEL: src.ai_disclosure_label || src.ai_label || 'ai_generated',
            DDEX_AI_PROFILE: JSON.stringify(ddex),
            ...(src.c2pa_provenance_hash ? { C2PA_HASH: src.c2pa_provenance_hash } : {}),
            ...(tags.txxx || {}),
          };
          tags.wxxx = {
            PROVENANCE_MANIFEST: `https://base44.app/api/apps/${Deno.env.get('BASE44_APP_ID')}/functions/getCosManifest?assetId=${asset_id}`,
            ...(tags.wxxx || {}),
          };
          provenanceEmbedded = true;
        }
      } catch (_) { /* non-fatal — tag without provenance */ }
    }

    // Fetch the audio file (URL validated against internal/loopback targets)
    const audioRes = await fetch(assertSafeUrl(audio_url));
    if (!audioRes.ok) throw new Error('Failed to fetch audio file');
    const audioBuffer = await audioRes.arrayBuffer();

    // Prepare ID3v2.4 frame data — comprehensive professional tagging
    const id3Frames = {
      TIT2: tags.title || '',           // Title
      TPE1: tags.artist || '',          // Lead artist
      TALB: tags.album || '',           // Album
      TYER: tags.year ? String(tags.year) : String(new Date().getFullYear()), // Year (ID3v2.3 fallback)
      TDRC: tags.year ? String(tags.year) : String(new Date().getFullYear()), // Recording date (ID3v2.4)
      TCON: tags.genre || '',           // Genre
      TRCK: tags.track ? String(tags.track) : '', // Track number
      TPE2: tags.albumArtist || tags.artist || '', // Album artist
      TCOM: tags.composer || tags.artist || '',    // Composer
      TPUB: tags.publisher || 'BASE Station',      // Publisher
      TENC: tags.encodedBy || 'BASE Station AI',   // Encoded by
      TSSE: tags.softwareUsed || `BASE Station (${tags.txxx?.BASE_PROVIDER || 'AI'})`, // Software/tool
      COMM: tags.comment || '',         // Comments
      TBPM: tags.bpm ? String(Math.round(tags.bpm)) : '', // BPM (integer)
      TKEY: tags.key || '',             // Musical key
      TLEN: tags.duration ? String(Math.round(tags.duration * 1000)) : '', // Length in ms
      TCOP: tags.copyright || `${new Date().getFullYear()} BASE Station AI`, // Copyright
      TMOO: tags.mood || '',            // Mood (ID3v2.4)
      TSRC: tags.isrc || '',            // ISRC if provided
      WOAR: tags.artistUrl || '',       // Official artist webpage
    };

    // Build ID3v2.4 header and frames
    let frameData = new Uint8Array();

    // Add standard text frames
    for (const [frameId, frameText] of Object.entries(id3Frames)) {
      if (!frameText) continue;
      const textBuffer = new TextEncoder().encode(frameText);
      const frameSize = textBuffer.length + 1; // +1 for encoding byte
      frameData = concatArrays(frameData, buildFrame(frameId, frameSize, textBuffer));
    }

    // Add TXXX custom frames (e.g. content_hash, ai_provider, ai_model)
    if (tags.txxx && typeof tags.txxx === 'object') {
      for (const [key, value] of Object.entries(tags.txxx)) {
        if (!value) continue;
        frameData = concatArrays(frameData, buildTXXXFrame(key, String(value)));
      }
    }

    // Add WXXX (user-defined URL) frames — e.g. PROVENANCE_MANIFEST
    if (tags.wxxx && typeof tags.wxxx === 'object') {
      for (const [key, value] of Object.entries(tags.wxxx)) {
        if (!value) continue;
        frameData = concatArrays(frameData, buildWXXXFrame(key, String(value)));
      }
    }

    // Add USLT (unsynchronised lyrics) frame — embeds full lyrics in the MP3 so any
    // player (iTunes, Windows Media Player, mobile lock screens) can display them.
    if (tags.lyrics && typeof tags.lyrics === 'string' && tags.lyrics.trim().length > 0) {
      frameData = concatArrays(frameData, buildUSLTFrame(tags.lyrics, tags.lyricsLanguage || 'eng'));
    }

    // Add SYLT (synchronised lyrics) frame if word-level alignment data is provided.
    // Layout: [encoding:1][language:3][timestamp_format:1][content_type:1][description+\0]
    //         then repeated: [text+\0][timestamp:4 bytes BE in ms]
    // Powers karaoke views, lyric scrubbing, and lock-screen highlight on supporting players.
    if (Array.isArray(tags.aligned_lyrics) && tags.aligned_lyrics.length > 0) {
      frameData = concatArrays(frameData, buildSYLTFrame(tags.aligned_lyrics, tags.lyricsLanguage || 'eng'));
    }

    // Add cover image if provided
    if (cover_image_url) {
      try {
        const imgRes = await fetch(assertSafeUrl(cover_image_url));
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer();
          const imgArray = new Uint8Array(imgBuffer);
          const imgMime = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
          frameData = concatArrays(frameData, buildAPICFrame(imgArray, imgMime));
        }
      } catch (e) {
        console.warn('Failed to embed cover art:', e.message);
      }
    }

    // Build ID3v2.4 tag
    const id3Size = synchsafeInt(frameData.length);
    const id3Header = new Uint8Array([
      0x49, 0x44, 0x33, // "ID3"
      0x04, 0x00, // Version 2.4.0
      0x00, // Flags (no unsynchronization, no extended header)
      ...id3Size
    ]);

    const id3Tag = concatArrays(id3Header, frameData);

    // Remove existing ID3v2 tag if present (skip first 10 bytes + size)
    let newAudioData = audioBuffer;
    if (audioBuffer.byteLength > 10) {
      const header = new Uint8Array(audioBuffer, 0, 3);
      const headerStr = String.fromCharCode(...header);
      if (headerStr === 'ID3') {
        const existingSize = 10 + getSynchsafeSize(new Uint8Array(audioBuffer, 6, 4));
        newAudioData = audioBuffer.slice(existingSize);
      }
    }

    // Combine ID3 tag + audio data
    const finalAudio = concatArrays(id3Tag, new Uint8Array(newAudioData));

    // Upload the modified file — must be a File (with a filename), a bare Blob
    // serializes to an empty object and the upload is rejected.
    const safeTitle = (tags.title || 'track').replace(/[^\w.\-]/g, '_').slice(0, 60);
    const modifiedFile = new File([finalAudio], `${safeTitle}_tagged.mp3`, { type: 'audio/mpeg' });
    const uploadRes = await base44.integrations.Core.UploadFile({ file: modifiedFile });
    
    return Response.json({
      download_url: uploadRes.file_url,
      tags_applied: Object.keys(id3Frames).filter(k => id3Frames[k]).length,
      lyrics_embedded: !!(tags.lyrics && tags.lyrics.trim().length > 0),
      sylt_embedded: Array.isArray(tags.aligned_lyrics) && tags.aligned_lyrics.length > 0,
      cover_embedded: !!cover_image_url,
      txxx_count: tags.txxx ? Object.values(tags.txxx).filter(Boolean).length : 0,
      wxxx_count: tags.wxxx ? Object.values(tags.wxxx).filter(Boolean).length : 0,
      provenance_embedded: provenanceEmbedded,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper: Build synchsafe integer (ID3v2.4 size format)
function synchsafeInt(value) {
  const out = new Uint8Array(4);
  out[0] = (value >> 21) & 0x7F;
  out[1] = (value >> 14) & 0x7F;
  out[2] = (value >> 7) & 0x7F;
  out[3] = value & 0x7F;
  return out;
}

// Helper: Read synchsafe integer
function getSynchsafeSize(bytes) {
  return (bytes[0] << 21) | (bytes[1] << 14) | (bytes[2] << 7) | bytes[3];
}

// Helper: Build ID3v2.4 text frame
function buildFrame(frameId, size, textBuffer) {
  const sizeBytes = synchsafeInt(size);
  const frame = new Uint8Array(10 + size);
  
  // Frame ID (4 bytes)
  frame.set(new TextEncoder().encode(frameId), 0);
  // Frame size (4 synchsafe bytes)
  frame.set(sizeBytes, 4);
  // Frame flags (2 bytes) - no flags set
  frame[8] = 0x00;
  frame[9] = 0x00;
  // Encoding: UTF-8 (3)
  frame[10] = 0x03;
  // Text data
  frame.set(textBuffer, 11);
  
  return frame;
}

// Helper: Build TXXX (user-defined text) frame
function buildTXXXFrame(description, value) {
  const descBytes = new TextEncoder().encode(description + '\x00');
  const valueBytes = new TextEncoder().encode(value);
  const frameSize = 1 + descBytes.length + valueBytes.length; // encoding byte + desc + value
  const sizeBytes = synchsafeInt(frameSize);

  const frame = new Uint8Array(10 + frameSize);
  frame.set(new TextEncoder().encode('TXXX'), 0);
  frame.set(sizeBytes, 4);
  frame[8] = 0x00;
  frame[9] = 0x00;

  let offset = 10;
  frame[offset++] = 0x03; // UTF-8
  frame.set(descBytes, offset); offset += descBytes.length;
  frame.set(valueBytes, offset);
  return frame;
}

// Helper: Build WXXX (user-defined URL) frame
// Layout: [encoding:1][description+\0 (per encoding)][URL as latin-1 bytes]
function buildWXXXFrame(description, url) {
  const descBytes = new TextEncoder().encode(description + '\x00');
  // URL portion is always ISO-8859-1 per spec — URLs are ASCII-safe
  const urlBytes = new Uint8Array([...url].map(c => c.charCodeAt(0) & 0xFF));
  const frameSize = 1 + descBytes.length + urlBytes.length;
  const sizeBytes = synchsafeInt(frameSize);

  const frame = new Uint8Array(10 + frameSize);
  frame.set(new TextEncoder().encode('WXXX'), 0);
  frame.set(sizeBytes, 4);
  frame[8] = 0x00;
  frame[9] = 0x00;

  let offset = 10;
  frame[offset++] = 0x03; // UTF-8 for description
  frame.set(descBytes, offset); offset += descBytes.length;
  frame.set(urlBytes, offset);
  return frame;
}

// Helper: Build APIC (attached picture) frame
function buildAPICFrame(imageBuffer, mimeType = 'image/jpeg') {
  const description = '';
  const pictureType = 0x03; // Front cover
  
  const mimeBytes = new TextEncoder().encode(mimeType + '\x00');
  const descBytes = new TextEncoder().encode(description + '\x00');
  
  const frameSize = 1 + mimeBytes.length + descBytes.length + 1 + imageBuffer.length;
  const sizeBytes = synchsafeInt(frameSize);
  
  const frame = new Uint8Array(10 + frameSize);
  frame.set(new TextEncoder().encode('APIC'), 0);
  frame.set(sizeBytes, 4);
  frame[8] = 0x00;
  frame[9] = 0x00;
  
  let offset = 10;
  frame[offset++] = 0x03; // UTF-8 encoding
  frame.set(mimeBytes, offset);
  offset += mimeBytes.length;
  frame[offset++] = pictureType;
  frame.set(descBytes, offset);
  offset += descBytes.length;
  frame.set(imageBuffer, offset);
  
  return frame;
}

// Helper: Build USLT (unsynchronised lyrics) frame
// Layout: [encoding:1][language:3][description+\0][lyrics text]
function buildUSLTFrame(lyrics, language = 'eng') {
  const lang = (language + '   ').slice(0, 3); // pad to 3 chars
  const langBytes = new TextEncoder().encode(lang);
  const descBytes = new TextEncoder().encode('Lyrics\x00');
  const lyricsBytes = new TextEncoder().encode(lyrics);

  const frameSize = 1 + langBytes.length + descBytes.length + lyricsBytes.length;
  const sizeBytes = synchsafeInt(frameSize);

  const frame = new Uint8Array(10 + frameSize);
  frame.set(new TextEncoder().encode('USLT'), 0);
  frame.set(sizeBytes, 4);
  frame[8] = 0x00;
  frame[9] = 0x00;

  let offset = 10;
  frame[offset++] = 0x03; // UTF-8 encoding
  frame.set(langBytes, offset); offset += langBytes.length;
  frame.set(descBytes, offset); offset += descBytes.length;
  frame.set(lyricsBytes, offset);
  return frame;
}

// Helper: Build SYLT (synchronised lyrics) frame
// Input: alignment = [{ word: string, start_s: number, end_s: number }, ...]
// Format per ID3v2.4: encoding(1) + language(3) + timestamp_format(1) + content_type(1) + descriptor+\0
// followed by repeating { text+\0, timestamp_ms(4 BE) } pairs.
function buildSYLTFrame(alignment, language = 'eng') {
  const lang = (language + '   ').slice(0, 3);
  const langBytes = new TextEncoder().encode(lang);
  const descBytes = new TextEncoder().encode('Lyrics\x00');

  // Build the repeating body
  const enc = new TextEncoder();
  const chunks = [];
  let bodyLen = 0;
  for (const item of alignment) {
    const text = (typeof item.word === 'string') ? item.word : String(item.word || '');
    const tStart = Number(item.start_s);
    if (!Number.isFinite(tStart)) continue;
    const textBytes = enc.encode(text + '\x00');
    const ts = Math.max(0, Math.round(tStart * 1000));
    const tsBytes = new Uint8Array([
      (ts >> 24) & 0xFF, (ts >> 16) & 0xFF, (ts >> 8) & 0xFF, ts & 0xFF,
    ]);
    chunks.push(textBytes, tsBytes);
    bodyLen += textBytes.length + tsBytes.length;
  }

  const headerLen = 1 + langBytes.length + 1 + 1 + descBytes.length;
  const frameSize = headerLen + bodyLen;
  const sizeBytes = synchsafeInt(frameSize);

  const frame = new Uint8Array(10 + frameSize);
  frame.set(new TextEncoder().encode('SYLT'), 0);
  frame.set(sizeBytes, 4);
  frame[8] = 0x00; frame[9] = 0x00;

  let offset = 10;
  frame[offset++] = 0x03;                       // UTF-8
  frame.set(langBytes, offset); offset += langBytes.length;
  frame[offset++] = 0x02;                       // timestamp format: absolute milliseconds
  frame[offset++] = 0x01;                       // content type: lyrics
  frame.set(descBytes, offset); offset += descBytes.length;
  for (const c of chunks) { frame.set(c, offset); offset += c.length; }
  return frame;
}

// Helper: Concatenate two Uint8Arrays
function concatArrays(a, b) {
  const result = new Uint8Array(a.length + b.length);
  result.set(a);
  result.set(b, a.length);
  return result;
}