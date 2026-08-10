// ORVO × Inworld AI integration config — architected in Phase 1+2, ACTIVATED in Phase 3.
// Users select one of these modes per-generation. The backend function
// `generateVoiceover` routes on { provider: 'inworld', inworld_mode }.

export const MODE_TTS = {
  id: 'tts',
  label: 'Voiceover (TTS-2)',
  description: 'Stateless text-to-speech via Inworld TTS-2 REST. Supports emotion steering tags inline in text. Output: MP3.',
  transport: 'rest',
  endpoint: 'https://api.inworld.ai/tts/v1/voice',
  supportsEmotionTags: true,
  outputFormat: 'mp3',
};

export const MODE_LLM_PLUS_TTS = {
  id: 'llm_plus_tts',
  label: 'AI Script + Voiceover',
  description: 'Inworld Router chains LLM script generation → TTS-2 in one call. Used by the AI podcast agent for structured multi-segment output.',
  transport: 'rest',
  endpoint: 'https://api.inworld.ai/llm/v1/router',
  supportsEmotionTags: true,
  outputFormat: 'mp3',
};

export const MODE_REALTIME = {
  id: 'realtime',
  label: 'Live AI Host (Realtime)',
  description: 'WebSocket/WebRTC Realtime API for live AI-hosted podcast sessions. Activated with OrvoLiveEvent in Phase 4.',
  transport: 'websocket',
  endpoint: 'wss://api.inworld.ai/realtime/v1',
  supportsEmotionTags: true,
  outputFormat: 'pcm_stream',
};

export const INWORLD_MODES = [MODE_TTS, MODE_LLM_PLUS_TTS, MODE_REALTIME];

// Emotion steering tags surfaced in the segment editor (Phase 3)
export const EMOTION_TAGS = [
  '[enthusiastic]', '[laugh]', '[thoughtful]', '[sigh]', '[serious]',
  '[curious]', '[excited]', '[calm]', '[whisper]', '[dramatic]',
];

// AI podcast agent — structured script segment types
export const AGENT_SEGMENT_TYPES = ['intro', 'interview_qa', 'commentary', 'outro'];

// Persona slots the agent can assign segments to
export const AGENT_PERSONAS = {
  host: { id: 'host', label: 'Host', voiceSource: 'tts' },
  guest: { idPrefix: 'guest_', label: 'Guest', voiceSource: 'clone_or_design' },
};