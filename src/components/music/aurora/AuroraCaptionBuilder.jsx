import { useState } from 'react';
import { Layers, FileText, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InfoTip from '@/components/common/InfoTip';
import { compileStructuredCaption } from '@/lib/music/auroraCaption';

/**
 * The three-block Structured Caption MiniMax Music 3 was trained to follow —
 * Global Metadata, Vocal Details, Arrangement. Collected as real fields rather
 * than one textarea because the model's own card states this representation is
 * what lets it follow the song's DEVELOPMENT over time, not just a global vibe;
 * a creator typing free prose has no way to express section-level evolution.
 *
 * The compiled caption is shown on demand so nothing about what the engine
 * actually receives is hidden.
 */
const BLOCKS = [
  {
    title: 'Global Metadata',
    hint: 'Genre, tempo, key and the emotional arc of the whole song.',
    fields: [
      { k: 'genre', label: 'Genre', placeholder: 'Electric Blues' },
      { k: 'subgenre', label: 'Subgenre', placeholder: 'Blues Rock' },
      { k: 'bpm', label: 'BPM', placeholder: '92' },
      { k: 'key', label: 'Key', placeholder: 'E' },
      { k: 'scale', label: 'Scale', placeholder: 'minor' },
      { k: 'emotional_progression', label: 'Emotional Progression', area: true, placeholder: 'Confident, gritty swagger from the outset; tension builds through restrained verses and releases in explosive instrumental breaks.' },
      { k: 'scenario', label: 'Scenario & Imagery', area: true, placeholder: 'A smoky, dimly lit blues club late at night.' },
      { k: 'production', label: 'Sonics & Production Profile', area: true, placeholder: 'Live organic feel, wide soundstage, warm mid-forward response, relatively uncompressed dynamics.' },
    ],
  },
  {
    title: 'Vocal Details',
    hint: 'Leave every field blank for an instrumental.',
    fields: [
      { k: 'vocal_gender', label: 'Vocal Gender', placeholder: 'Male' },
      { k: 'vocal_timbre', label: 'Timbre', placeholder: 'Deep gravelly baritone, raspy and textured' },
      { k: 'vocal_style', label: 'Performance Style', area: true, placeholder: 'Conversational and storytelling in the verses, shifting to melodic and soulful in the refrains.' },
      { k: 'harmony', label: 'Harmony / Backing Vocals', area: true, placeholder: 'No separate backing singers; the lead layers his own voice in the chorus.' },
      { k: 'vocal_fx', label: 'Vocal FX', area: true, placeholder: 'Moderate plate reverb with a subtle slapback delay.' },
    ],
  },
  {
    title: 'Arrangement',
    hint: 'Section-level instrument evolution is what Aurora does that shorter models cannot.',
    fields: [
      { k: 'primary_instruments', label: 'Primary Instruments', area: true, placeholder: 'Slightly overdriven electric guitar carrying both rhythm comping and lead lines, present intro to outro.' },
      { k: 'secondary_instruments', label: 'Secondary Instruments', area: true, placeholder: 'Walking electric bass throughout; Hammond-style organ swelling in the choruses.' },
      { k: 'instrument_evolution', label: 'Instrument Lifecycle / Section Evolution', area: true, placeholder: 'Sparse in verse one, organ enters verse two, full band from the first chorus, stripped bridge, densest in the final chorus.' },
      { k: 'groove', label: 'Groove', placeholder: 'Steady mid-tempo shuffle' },
      { k: 'percussion', label: 'Percussion', placeholder: 'Acoustic kit, crisp snare on 2 and 4, swinging hi-hat' },
      { k: 'bass', label: 'Bass', placeholder: 'Melodic walking bass locked to the kick' },
      { k: 'textures', label: 'Embellishments & Textures', area: true, placeholder: 'Guitar slides and string squeals as transitional flourishes.' },
      { k: 'spatial_fx', label: 'Spatial FX', area: true, placeholder: 'Room reverb on the kit, lead guitar placed slightly off-centre.' },
    ],
  },
];

const inputCls = 'w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export default function AuroraCaptionBuilder({ mode, onModeChange, caption, onCaptionChange, prose, onProseChange, disabled }) {
  const [showCompiled, setShowCompiled] = useState(false);
  const set = (k, v) => onCaptionChange({ ...caption, [k]: v });
  const compiled = compileStructuredCaption(caption);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant={mode === 'structured' ? 'default' : 'outline'} disabled={disabled}
          onClick={() => onModeChange('structured')} className="rounded-xl gap-1.5 text-xs">
          <Layers className="w-3.5 h-3.5" /> Structured Caption
        </Button>
        <Button size="sm" variant={mode === 'prose' ? 'default' : 'outline'} disabled={disabled}
          onClick={() => onModeChange('prose')} className="rounded-xl gap-1.5 text-xs">
          <FileText className="w-3.5 h-3.5" /> Plain description
        </Button>
        <InfoTip text="MiniMax-Music3 was trained on a three-block structured caption, which is how you steer section-by-section development. A plain paragraph also works and is passed through exactly as written." />
      </div>

      {mode === 'prose' ? (
        <textarea value={prose} onChange={(e) => onProseChange(e.target.value)} rows={5} disabled={disabled}
          placeholder="A warm acoustic pop song with intimate female vocals, fingerpicked guitar, soft piano, and a gradual emotional build into a wide final chorus."
          className={`${inputCls} resize-none`} />
      ) : (
        <div className="space-y-4">
          {BLOCKS.map((block) => (
            <div key={block.title} className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
              <div>
                <p className="text-sm font-bold">{block.title}</p>
                <p className="text-[11px] text-muted-foreground">{block.hint}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {block.fields.map((f) => (
                  <div key={f.k} className={f.area ? 'sm:col-span-2' : ''}>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5">{f.label}</p>
                    {f.area ? (
                      <textarea value={caption[f.k] || ''} onChange={(e) => set(f.k, e.target.value)} rows={2}
                        disabled={disabled} placeholder={f.placeholder} className={`${inputCls} resize-none`} />
                    ) : (
                      <input type="text" value={caption[f.k] || ''} onChange={(e) => set(f.k, e.target.value)}
                        disabled={disabled} placeholder={f.placeholder} className={inputCls} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Button size="sm" variant="ghost" onClick={() => setShowCompiled((v) => !v)} className="rounded-xl gap-1.5 text-xs">
            {showCompiled ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showCompiled ? 'Hide' : 'Preview'} the caption Aurora will receive
          </Button>
          {showCompiled && (
            <pre className="text-[11px] whitespace-pre-wrap font-mono p-3 rounded-xl bg-muted/40 border border-border text-muted-foreground max-h-64 overflow-y-auto">
              {compiled || 'Fill in a few fields above to build the caption.'}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}