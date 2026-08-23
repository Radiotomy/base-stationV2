import { Plus, Trash2 } from 'lucide-react';

const ROLES = ['host', 'cohost', 'guest', 'analyst'];
const field = 'bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF9A4D]/60';

/** The AI participants performing the show — name, role and the voice that speaks them. */
export default function AiCastEditor({ cast, onChange, voices = [], disabled }) {
  const update = (i, patch) => onChange(cast.map((c, n) => (n === i ? { ...c, ...patch } : c)));

  const add = () => onChange([
    ...cast,
    {
      persona_id: `guest_${Date.now().toString(36)}`,
      name: '',
      role: 'guest',
      voice_id: voices[0]?.voice_id || 'Ashley',
      provider: 'inworld',
      persona: '',
    },
  ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40">Cast ({cast.length})</p>
        <button
          onClick={add}
          disabled={disabled || cast.length >= 4}
          className="merc-button-dark rounded-full px-3 py-1 text-[11px] font-bold flex items-center gap-1 disabled:opacity-40"
        >
          <Plus className="w-3 h-3" /> Add character
        </button>
      </div>

      {cast.map((c, i) => (
        <div key={c.persona_id} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
          <div className="flex gap-2">
            <input
              className={`${field} flex-1`}
              placeholder="Character name"
              value={c.name}
              onChange={(e) => update(i, { name: e.target.value })}
              disabled={disabled}
            />
            <select className={field} value={c.role} onChange={(e) => update(i, { role: e.target.value })} disabled={disabled}>
              {ROLES.map((r) => <option key={r} value={r} className="bg-[#14100C] capitalize">{r}</option>)}
            </select>
            {cast.length > 1 && (
              <button
                onClick={() => onChange(cast.filter((_, n) => n !== i))}
                disabled={disabled}
                className="text-white/30 hover:text-red-400 px-1 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <select
              className={`${field} flex-1`}
              value={c.provider}
              onChange={(e) => update(i, { provider: e.target.value })}
              disabled={disabled}
            >
              <option value="inworld" className="bg-[#14100C]">Inworld TTS-2</option>
              <option value="elevenlabs" className="bg-[#14100C]">ElevenLabs</option>
            </select>
            {c.provider === 'inworld' && voices.length > 0 ? (
              <select
                className={`${field} flex-1`}
                value={c.voice_id}
                onChange={(e) => update(i, { voice_id: e.target.value })}
                disabled={disabled}
              >
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id} className="bg-[#14100C]">{v.name || v.voice_id}</option>
                ))}
              </select>
            ) : (
              <input
                className={`${field} flex-1`}
                placeholder="Voice ID"
                value={c.voice_id}
                onChange={(e) => update(i, { voice_id: e.target.value })}
                disabled={disabled}
              />
            )}
          </div>

          <textarea
            className={`${field} w-full`}
            rows={2}
            placeholder="Character notes — how they speak, what they care about"
            value={c.persona || ''}
            onChange={(e) => update(i, { persona: e.target.value })}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}