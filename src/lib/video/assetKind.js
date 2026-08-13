/**
 * Decides which Shotstack asset type a file/library item should become
 * on the timeline: 'video' | 'audio' | 'image'.
 */
const VIDEO = ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'];
const AUDIO = ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac', 'oga'];
const IMAGE = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'];

// asset_type values that are always audio / always visual
const AUDIO_TYPES = ['track', 'master', 'stem', 'sfx', 'mashup', 'harmony'];
const IMAGE_TYPES = ['coverart'];
const VIDEO_TYPES = ['video', 'visualizer'];

export function kindFromUrl(url = '', fallback = 'video') {
  const ext = String(url).split('?')[0].split('.').pop()?.toLowerCase() || '';
  if (VIDEO.includes(ext)) return 'video';
  if (AUDIO.includes(ext)) return 'audio';
  if (IMAGE.includes(ext)) return 'image';
  return fallback;
}

export function kindFromAsset(asset) {
  if (AUDIO_TYPES.includes(asset.asset_type)) return kindFromUrl(asset.file_url, 'audio');
  if (IMAGE_TYPES.includes(asset.asset_type)) return kindFromUrl(asset.file_url, 'image');
  if (VIDEO_TYPES.includes(asset.asset_type)) return kindFromUrl(asset.file_url, 'video');
  return kindFromUrl(asset.file_url, 'video');
}

export function kindFromFile(file) {
  if (file.type?.startsWith('video/')) return 'video';
  if (file.type?.startsWith('audio/')) return 'audio';
  if (file.type?.startsWith('image/')) return 'image';
  return kindFromUrl(file.name, 'video');
}