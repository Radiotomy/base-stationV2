/**
 * PersonaManager — configure host & guest personas for the AI podcast agent.
 * STUB: prop contract defined in Phase 1+2, activated in Phase 3.
 *
 * Props:
 *   personas: [{ id: 'host'|'guest_1'|…, label, provider: 'elevenlabs'|'inworld',
 *                voice_id?: string, clone_source_url?: string, voice_design_prompt?: string }]
 *   onChange: (personas) => void
 *   maxGuests?: number (default 3)
 *   disabled?: boolean
 */
export default function PersonaManager({ personas = [], onChange, maxGuests = 3, disabled = false }) {
  return (
    <div className="merc-card rounded-xl p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-[#FF9A4D] mb-1">Personas</p>
      <p className="text-sm text-white/50">
        Persona configuration ({personas.length} configured) activates in Phase 3 — host TTS voice plus guest voice cloning / voice design per persona.
      </p>
    </div>
  );
}