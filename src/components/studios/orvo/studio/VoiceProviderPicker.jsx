/**
 * VoiceProviderPicker — persona voice provider toggle (ElevenLabs | Inworld).
 * STUB: prop contract defined in Phase 1+2, activated in Phase 3.
 *
 * Props:
 *   provider: 'elevenlabs' | 'inworld'
 *   onProviderChange: (provider) => void
 *   voiceId: string
 *   onVoiceIdChange: (voiceId) => void
 *   inworldMode?: 'tts' | 'llm_plus_tts' | 'realtime'
 *   onInworldModeChange?: (mode) => void
 *   disabled?: boolean
 */
export default function VoiceProviderPicker({
  provider = 'elevenlabs',
  onProviderChange,
  voiceId,
  onVoiceIdChange,
  inworldMode,
  onInworldModeChange,
  disabled = false,
}) {
  return (
    <div className="merc-card rounded-xl p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-[#FF9A4D] mb-1">Voice Provider</p>
      <p className="text-sm text-white/50">
        Provider selection ({provider}) activates in Phase 3 — ElevenLabs and Inworld TTS-2 with per-generation mode selection.
      </p>
    </div>
  );
}