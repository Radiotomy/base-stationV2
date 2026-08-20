// Tempolor Stem Separation — shared client.
//
// Docs:
//   POST /open-apis/v1/stems        { url, callback_url }  -> { data: { item_ids: [id] } }
//   POST /open-apis/v1/stems/query  { item_ids: [id] }     -> { data: { stems: [{ item_id, status, stems_url }] } }
//
// Auth: Authorization header is the RAW API key (no "Bearer"), same convention as
// song/generate and song/extend.

export const TEMPOLOR_BASE = 'https://api.tempolor.com/open-apis/v1';

export const STEM_LABELS = ['vocals', 'drums', 'bass', 'other'];

function authHeaders() {
  const key = Deno.env.get('TEMPCOLOR_API_KEY');
  if (!key) throw new Error('TEMPCOLOR_API_KEY not configured');
  return { Authorization: key, 'Content-Type': 'application/json; charset=utf-8' };
}

// Submit a separation task. Returns the Tempolor item_id.
export async function createStemTask(sourceUrl: string): Promise<string> {
  const callbackBase = Deno.env.get('TEMPOLOR_WEBHOOK_URL') || '';
  const res = await fetch(`${TEMPOLOR_BASE}/stems`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      url: sourceUrl,
      // callback_url is required by the API. We still poll for the result, because
      // the stems callback is a separate interface from the song callback our
      // existing tempolorWebhook understands — polling keeps the two from crossing.
      callback_url: callbackBase || 'https://example.com/unused-stems-callback',
    }),
  });
  const json = await res.json();
  if (!res.ok || json?.status !== 200000) {
    throw new Error(json?.message || `Tempolor stems request failed (HTTP ${res.status})`);
  }
  const itemId = json?.data?.item_ids?.[0];
  if (!itemId) throw new Error('Tempolor returned no stems item_id');
  return itemId;
}

// Poll a separation task.
export async function queryStemTask(itemId: string) {
  const res = await fetch(`${TEMPOLOR_BASE}/stems/query`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ item_ids: [itemId] }),
  });
  const json = await res.json();
  if (!res.ok || json?.status !== 200000) {
    throw new Error(json?.message || `Tempolor stems query failed (HTTP ${res.status})`);
  }
  return json?.data?.stems?.[0] || null;
}

/**
 * Normalize `stems_url` into [{ stem_type, url }].
 *
 * The documented example shows a single opaque `stems_url` string, but the field
 * carries different shapes depending on the model tier (v2 = 4 stems, v3 = 8), so
 * every plausible shape is handled explicitly. An unrecognized single URL is
 * returned as one `bundle` entry rather than being silently relabelled as
 * "vocals" — mislabelling a stem is worse than admitting it's a bundle.
 */
export function normalizeStemUrls(stemsUrl: unknown): Array<{ stem_type: string; url: string }> {
  if (!stemsUrl) return [];

  // Shape: { vocals: url, drums: url, ... }
  if (typeof stemsUrl === 'object' && !Array.isArray(stemsUrl)) {
    return Object.entries(stemsUrl as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string' && v)
      .map(([k, v]) => ({ stem_type: normalizeLabel(k), url: v as string }));
  }

  // Shape: [{ name|stem|type, url }] or [url, url, ...]
  if (Array.isArray(stemsUrl)) {
    return stemsUrl
      .map((entry, i) => {
        if (typeof entry === 'string') return { stem_type: STEM_LABELS[i] || `stem_${i + 1}`, url: entry };
        const e = entry as Record<string, unknown>;
        const url = (e.url || e.audio_url || e.file_url) as string;
        if (!url) return null;
        const label = (e.name || e.stem || e.type || e.stem_type) as string;
        return { stem_type: label ? normalizeLabel(label) : (STEM_LABELS[i] || `stem_${i + 1}`), url };
      })
      .filter(Boolean) as Array<{ stem_type: string; url: string }>;
  }

  // Shape: single URL string — an archive of all stems, or one rendered file.
  if (typeof stemsUrl === 'string') {
    return [{ stem_type: 'bundle', url: stemsUrl }];
  }

  return [];
}

const AUDIO_EXT = /\.(wav|mp3|flac|m4a|aac|ogg|opus)$/i;

/**
 * Expand a Tempolor stems archive into individual audio files.
 *
 * Tempolor delivers a separation as ONE `stems_url` download, so the four stems
 * only become separately usable assets after the archive is unpacked. Returns []
 * when the payload isn't a zip (e.g. a single rendered file), so the caller can
 * fall back to treating it as one file instead of guessing.
 */
export async function expandStemArchive(
  bytes: Uint8Array,
): Promise<Array<{ stem_type: string; filename: string; bytes: Uint8Array }>> {
  // Zip magic: PK\x03\x04
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) return [];

  const { unzipSync } = await import('npm:fflate@0.8.2');
  const entries = unzipSync(bytes);

  return Object.entries(entries)
    .filter(([name, data]) => AUDIO_EXT.test(name) && (data as Uint8Array).length > 0)
    .map(([name, data]) => {
      const base = name.split('/').pop() || name;
      return {
        // The stem name lives in the filename ("vocals.wav", "drums.wav", …)
        stem_type: normalizeLabel(base.replace(AUDIO_EXT, '')),
        filename: base,
        bytes: data as Uint8Array,
      };
    });
}

// Map provider stem names onto the UserAsset.stem_type enum where they line up.
function normalizeLabel(raw: string): string {
  const s = String(raw).toLowerCase().replace(/[^a-z]/g, '');
  if (s.includes('vocal') && (s.includes('back') || s.includes('harmon'))) return 'harmony';
  if (s.includes('vocal')) return 'vocals';
  if (s.includes('drum')) return 'drums';
  if (s.includes('bass')) return 'bass';
  if (s.includes('guitar') || s.includes('piano') || s.includes('instrument')) return 'instruments';
  if (s.includes('melody')) return 'melody';
  return 'other';
}