import { Input } from '@/components/ui/input';
import { INWORLD_MODES } from '@/lib/studios/orvo/inworldConfig';

const INWORLD_VOICES = ['Ashley', 'Alex', 'Deborah', 'Ronald', 'Sarah', 'Dennis', 'Elizabeth', 'Mark', 'Olivia', 'Hades'];

const chip = (active) =>
  `px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${
    active
      ? 'text-[#2A1508] border-black bg-gradient-to-b from-[#FFC26E] to-[#FF9A4D]'
      : 'text-white/60 border-black/60 bg-gradient-to-b from-[#28211A] to-[#171310] hover:text-[#FF9A4D]'
  }`;

/**
 * VoiceProviderPicker — persona voice provider toggle (ElevenLabs | Inworld).
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
        <div className="flex gap-2">
          {['inworld', 'elevenlabs'].map((p) => (
            <button key={p} disabled={disabled} onClick={() => onProviderChange?.(p)} className={chip(provider === p)}>
              {p === 'inworld' ? 'Inworld TTS-2' : 'ElevenLabs'}
            </button>
          ))}
        </div>
      </div>

      {provider === 'inworld' && (
        <>
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
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Voice</p>
            <div className="flex flex-wrap gap-2">
              {INWORLD_VOICES.map((v) => (
                <button key={v} disabled={disabled} onClick={() => onVoiceIdChange?.(v)} className={chip((voiceId || 'Ashley') === v)}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {provider === 'elevenlabs' && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">ElevenLabs Voice ID</p>
          <Input
            value={voiceId}
            disabled={disabled}
            onChange={(e) => onVoiceIdChange?.(e.target.value)}
            placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
          />
        </div>
      )}
    </div>
  );
}