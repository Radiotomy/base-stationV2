import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Using jsmediatags to read ID3v2 and write back
// For simplicity, we'll handle ID3v2.4 tags via fetching the file and re-encoding with new tags

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { audio_url, tags = {}, cover_image_url } = await req.json();
    if (!audio_url) return Response.json({ error: 'Missing audio_url' }, { status: 400 });

    // Fetch the audio file
    const audioRes = await fetch(audio_url);
    if (!audioRes.ok) throw new Error('Failed to fetch audio file');
    const audioBuffer = await audioRes.arrayBuffer();

    // Prepare ID3v2.4 frame data
    const id3Frames = {
      TIT2: tags.title || '', // Title
      TPE1: tags.artist || '', // Artist
      TALB: tags.album || '', // Album
      TYER: tags.year ? String(tags.year) : '', // Year
      TCON: tags.genre || '', // Genre
      TRCK: tags.track ? String(tags.track) : '', // Track number
      TPE2: tags.albumArtist || '', // Album artist
      TCOM: tags.composer || '', // Composer
      COMM: tags.comment || '', // Comments
    };

    // Build ID3v2.4 header and frames
    let frameData = new Uint8Array();
    
    // Add text frames
    for (const [frameId, frameText] of Object.entries(id3Frames)) {
      if (!frameText) continue;
      const textBuffer = new TextEncoder().encode(frameText);
      const frameSize = textBuffer.length + 1; // +1 for encoding byte
      frameData = concatArrays(frameData, buildFrame(frameId, frameSize, textBuffer));
    }

    // Add cover image if provided
    if (cover_image_url) {
      try {
        const imgRes = await fetch(cover_image_url);
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer();
          const imgArray = new Uint8Array(imgBuffer);
          frameData = concatArrays(frameData, buildAPICFrame(imgArray));
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

    // Upload the modified file
    const modifiedBlob = new Blob([finalAudio], { type: 'audio/mpeg' });
    const uploadRes = await base44.integrations.Core.UploadFile({ file: modifiedBlob });
    
    return Response.json({
      download_url: uploadRes.file_url,
      tags_applied: Object.keys(id3Frames).filter(k => id3Frames[k]).length,
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

// Helper: Build APIC (attached picture) frame
function buildAPICFrame(imageBuffer) {
  const mimeType = 'image/jpeg'; // assume JPEG for simplicity
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

// Helper: Concatenate two Uint8Arrays
function concatArrays(a, b) {
  const result = new Uint8Array(a.length + b.length);
  result.set(a);
  result.set(b, a.length);
  return result;
}