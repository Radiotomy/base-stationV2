import { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { COVER_PRESETS, PRESET_CATEGORIES } from './coverPresets';

/**
 * Browse curated cover-style presets (comic, dark, parody, genre flips, eras…)
 * and apply one in a single tap. The picker calls `onApply(preset.fields)` —
 * the parent decides how to map those fields onto its state.
 */
export default function CoverPresetPicker({ sourceLabel, onApply }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState('all');
  const [applied, setApplied] = useState(null);

  const filtered = cat === 'all' ? COVER_PRESETS : COVER_PRESETS.filter(p => p.category === cat);

  const handlePick = (preset) => {
    const baseName = (sourceLabel || '').replace(/\.[^/.]+$/, '').trim();
    const title = baseName ? `${baseName} ${preset.fields.title_suffix}` : preset.fields.title_suffix.replace(/^[()]+|[()]+$/g, '');
    const fields = { ...preset.fields, title };
    delete fields.title_suffix;
    onApply(fields, preset);
    setApplied(preset.id);
    toast.success(`Applied "${preset.name}" preset!`, { icon: preset.emoji });
    setTimeout(() => { setOpen(false); setApplied(null); }, 600);
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant="outline"
        className="w-full rounded-xl text-xs gap-2 border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/15 text-rose-200"
      >
        <Sparkles className="w-4 h-4" />
        Style Templates — Comic, Dark, Parody, Genre…
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" /> Cover Style Templates
            </DialogTitle>
            <DialogDescription>
              Pick a preset to instantly fill every field with a curated style. You can fine-tune after.
            </DialogDescription>
          </DialogHeader>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5 sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
            {PRESET_CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  cat === c.id
                    ? 'border-rose-500 bg-rose-500/15 text-rose-200'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-rose-500/40'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Preset grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => handlePick(p)}
                className={`text-left p-3 rounded-xl border transition-all hover:border-rose-500/60 hover:bg-rose-500/5 ${
                  applied === p.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-muted/20'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-2xl leading-none">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-black text-foreground truncate">{p.name}</p>
                      {applied === p.id && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <Badge variant="outline" className="text-[9px] border-rose-500/30 text-rose-300">{p.fields.genre}</Badge>
                      {p.fields.instrumental && (
                        <Badge variant="outline" className="text-[9px] border-cyan-500/30 text-cyan-300">Instrumental</Badge>
                      )}
                      {p.fields.vocal_gender === 'f' && (
                        <Badge variant="outline" className="text-[9px] border-fuchsia-500/30 text-fuchsia-300">Female</Badge>
                      )}
                      {p.fields.vocal_gender === 'm' && (
                        <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-300">Male</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground text-center pt-1">
            {filtered.length} template{filtered.length === 1 ? '' : 's'} • Vocal Gender only applies on supported models
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}