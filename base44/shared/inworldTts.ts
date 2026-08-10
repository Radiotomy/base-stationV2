// Shared Inworld TTS-2 synthesis — used by generateVoiceover and the live AI co-host.

export async function synthesizeInworldSpeech(apiKey, { text, voiceId = 'Ashley', modelId = 'inworld-tts-1' }) {
  const res = await fetch('https://api.inworld.ai/tts/v1/voice', {
    method: 'POST',
    headers: { Authorization: `Basic ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId, modelId }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Inworld TTS failed (${res.status}): ${err.slice(0, 300)}`);
  }
  const json = await res.json();
  const b64 = json.audioContent || json.result?.audioContent;
  if (!b64) throw new Error('Inworld returned no audio content');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}