import { INWORLD_MODES } from '@/lib/studios/orvo/inworldConfig';
import VoiceCatalogBrowser from '@/components/studios/orvo/studio/VoiceCatalogBrowser';

const chip = (active) =>
  `px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${
    active
      ? 'text-[#2A1508] border-black bg-gradient-to-b from-[#FFC26E] to-[#FF9A4D]'
      : 'text-white/60 border-black/60 bg-gradient-to-b from-[#28211A] to-[#171310] hover:text-[#FF9A4D]'
  }`;

/**
 * VoiceProviderPicker — provider toggle + Inworld mode, with the live
 * per-provider voice catalog for browsing, auditioning and selecting.
 */
export default function VoiceProviderPicker({
  provider = 'inworld',
  onProviderChange,
  voiceId = '',
  onVoiceIdChange,
  inworldMode = 'tts',
  onInworldModeChange,
  disabled = false,
}) {
  return (
    <div className="merc-card rounded-xl p-4 space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#FF9A4D] mb-2">Voice Provider</p>
        {/* ElevenLabs is hidden as a TTS provider — it stays reserved for music/SFX
            generation elsewhere in BASE Station. Inworld handles voiceover. */}
        <div className="flex gap-2">
          {['inworld'].map((p) => (
            <button key={p} disabled={disabled} onClick={() => onProviderChange?.(p)} className={chip(provider === p)}>
              Inworld TTS-2
            </button>
          ))}
        </div>
      </div>

      {provider === 'inworld' && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Mode</p>
          <div className="flex flex-wrap gap-2">
            {INWORLD_MODES.filter((m) => m.id !== 'realtime').map((m) => (
              <button key={m.id} disabled={disabled} onClick={() => onInworldModeChange?.(m.id)} className={chip(inworldMode === m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Voice Catalog</p>
        <VoiceCatalogBrowser
          provider={provider}
          voiceId={voiceId}
          onVoiceIdChange={onVoiceIdChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}