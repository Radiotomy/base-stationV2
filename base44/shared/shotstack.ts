// Shotstack Edit API helpers — the platform's video composition engine
// (replaces the retired NextCut integration).
//
// Docs: https://shotstack.io/docs/api/
//   POST {base}/render        → { response: { id } }   (async)
//   GET  {base}/render/{id}   → { response: { status, url, poster, duration } }

const SHOTSTACK_KEY = Deno.env.get('SHOTSTACK_API');
const PEXELS_KEY = Deno.env.get('PEXELS_API_KEY');

export const SHOTSTACK_BASES = [
  'https://api.shotstack.io/edit/v1',
  'https://api.shotstack.io/edit/stage',
];

// Shotstack transition names (our UI uses NextCut-era slugs — map them over)
const TRANSITION_MAP = {
  crossfade: 'fade',
  fade: 'fade',
  'slide-left': 'slideLeft',
  'slide-right': 'slideRight',
  'slide-up': 'slideUp',
  'slide-down': 'slideDown',
  'wipe-left': 'wipeLeft',
  'wipe-right': 'wipeRight',
  zoom: 'zoom',
  reveal: 'reveal',
};

/** Resolve one Pexels stock video file URL for a search query. */
export async function resolvePexelsClip(query, orientation = 'landscape') {
  if (!PEXELS_KEY || !query?.trim()) return null;
  const orient = ['landscape', 'portrait', 'square'].includes(orientation) ? orientation : 'landscape';
  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=${orient}`,
    { headers: { Authorization: PEXELS_KEY } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const video = data.videos?.[0];
  if (!video) return null;
  // Pick the highest-quality mp4 file that isn't oversized
  const files = (video.video_files || []).filter(f => f.file_type === 'video/mp4');
  const best = files.sort((a, b) => (b.width || 0) - (a.width || 0)).find(f => (f.width || 0) <= 2560) || files[0];
  if (!best?.link) return null;
  return {
    src: best.link,
    photographer: video.user?.name || null,
    photographer_url: video.user?.url || null,
    pexels_url: video.url || null,
  };
}

// Animated rich-text presets exposed in the composer UI
const TEXT_ANIMATIONS = new Set(['ascend', 'shift', 'typewriter']);

/**
 * Build a Shotstack `Edit` from a flat scene list.
 * scenes: [{ kind: 'broll'|'video'|'solid', query?, src?, color?, durationSeconds, transitionOut?, text?, textAnimation? }]
 * captions: { enabled: boolean, style?: 'karaoke'|'clean' } — auto-transcribed from the audio track
 */
export function buildEdit(scenes, { width, height, fps, audioUrl, audioVolume = 1, captions = null }) {
  const captionsOn = !!(captions?.enabled && audioUrl);
  const videoClips = [];
  const textClips = [];
  let cursor = 0;

  scenes.forEach((scene, idx) => {
    const length = Math.max(1, scene.durationSeconds || 4);
    const transitionIn = TRANSITION_MAP[scenes[idx - 1]?.transitionOut] || null;
    const transitionOut = TRANSITION_MAP[scene.transitionOut] || null;

    let asset;
    if (scene.kind === 'solid') {
      asset = {
        type: 'shape',
        shape: 'rectangle',
        rectangle: { width, height },
        fill: { color: scene.color || '#000000' },
      };
    } else if (scene.kind === 'image') {
      asset = { type: 'image', src: scene.src };
    } else {
      // 'broll' queries are resolved to Pexels sources before this call
      asset = { type: 'video', src: scene.src, volume: 0 };
    }

    const clip = { asset, start: cursor, length, fit: 'cover', scale: 1 };
    if (transitionIn || transitionOut) {
      clip.transition = {};
      if (transitionIn) clip.transition.in = transitionIn;
      if (transitionOut) clip.transition.out = transitionOut;
    }
    videoClips.push(clip);

    if (scene.text?.trim()) {
      const asset = {
        type: 'rich-text',
        text: scene.text.trim(),
        font: { family: 'Montserrat', size: Math.round(height / 14), weight: 800, color: '#ffffff' },
        style: { letterSpacing: 2 },
        stroke: { width: 3, color: '#000000', opacity: 1 },
        shadow: { offsetX: 4, offsetY: 4, blur: 10, color: '#000000', opacity: 0.6 },
        align: { horizontal: 'center', vertical: 'middle' },
      };
      if (TEXT_ANIMATIONS.has(scene.textAnimation)) {
        asset.animation = {
          preset: scene.textAnimation,
          duration: Math.min(1.5, Math.max(0.5, length / 3)),
          style: scene.textAnimation === 'typewriter' ? 'character' : 'word',
        };
      }
      textClips.push({
        asset,
        start: cursor,
        length,
        width: Math.round(width * 0.8),
        height: Math.round(height * 0.3),
        // captions own the lower third — push scene titles up when they're on
        position: captionsOn ? 'top' : 'bottom',
        offset: { y: captionsOn ? -0.06 : 0.06 },
        transition: { in: 'fade', out: 'fade' },
      });
    }

    cursor += length;
  });

  const tracks = [];

  // Auto-captions: the audio must live on a track (not the soundtrack) so it can
  // carry an alias for Shotstack's transcription engine to reference.
  if (captionsOn) {
    const caption = {
      type: 'rich-caption',
      src: 'alias://vocals',
      font: { family: 'Montserrat', size: Math.round(height / 18), weight: 700, color: '#ffffff' },
      align: { vertical: 'bottom' },
      stroke: { width: 3, color: '#000000', opacity: 1 },
      style: { textTransform: 'uppercase' },
    };
    if (captions.style !== 'clean') {
      caption.animation = { style: 'highlight' };
      caption.active = { font: { background: '#FF9A4D', color: '#14100C' } };
    }
    tracks.push({ clips: [{ asset: caption, start: 0, length: 'end' }] });
  }

  if (textClips.length) tracks.push({ clips: textClips }); // above video
  tracks.push({ clips: videoClips });

  if (captionsOn) {
    tracks.push({
      clips: [{
        alias: 'vocals',
        asset: { type: 'audio', src: audioUrl, volume: audioVolume, effect: 'fadeOut' },
        start: 0,
        length: cursor,
      }],
    });
  }

  const timeline = { background: '#000000', tracks };
  if (audioUrl && !captionsOn) timeline.soundtrack = { src: audioUrl, effect: 'fadeOut', volume: audioVolume };

  return {
    edit: { timeline, output: { format: 'mp4', size: { width, height }, fps } },
    totalSeconds: cursor,
  };
}

/** Submit a render. Falls back from the production host to stage for sandbox keys. */
export async function submitRender(edit) {
  if (!SHOTSTACK_KEY) throw new Error('SHOTSTACK_API not configured');
  let lastError = 'Shotstack render failed';
  for (const base of SHOTSTACK_BASES) {
    const res = await fetch(`${base}/render`, {
      method: 'POST',
      headers: { 'x-api-key': SHOTSTACK_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(edit),
    });
    const text = await res.text();
    if (res.ok) {
      const data = JSON.parse(text);
      const id = data?.response?.id;
      if (id) return { id, base };
      lastError = data?.message || 'Shotstack returned no render id';
      break;
    }
    lastError = text.slice(0, 600);
    // 401/403 means wrong environment for this key — try the other host
    if (res.status !== 401 && res.status !== 403) break;
  }
  throw new Error(lastError);
}

/** Poll a render. Returns { status, video_url?, poster?, duration?, error? }. */
export async function getRender(renderId, base) {
  const bases = base ? [base, ...SHOTSTACK_BASES.filter(b => b !== base)] : SHOTSTACK_BASES;
  for (const b of bases) {
    const res = await fetch(`${b}/render/${renderId}`, { headers: { 'x-api-key': SHOTSTACK_KEY } });
    if (!res.ok) continue;
    const data = await res.json();
    const r = data?.response || {};
    if (r.status === 'done') {
      return { status: 'completed', video_url: r.url, poster: r.poster || null, duration: r.duration };
    }
    if (r.status === 'failed') {
      return { status: 'failed', error: r.error || 'Shotstack render failed' };
    }
    return { status: 'processing', stage: r.status };
  }
  return { status: 'processing' };
}