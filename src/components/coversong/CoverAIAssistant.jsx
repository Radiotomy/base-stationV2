import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, Wand2, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

/**
 * AI assistant that fills any missing/empty Cover Studio fields with smart
 * suggestions. Reads the current form state, asks the LLM for completions
 * for ONLY the empty fields, then lets the user review & apply.
 */
export default function CoverAIAssistant({
  taskKind, sourceLabel,
  customMode, lyrics, aiDescription,
  title, tags, negativeTags, genre, mood, vocalGender, instrumental,
  onApply, // (suggestions) => void
}) {
  const [open, setOpen] = useState(false);
  const [vibeHint, setVibeHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [selected, setSelected] = useState({}); // field -> bool

  // Which fields are currently empty / need help
  const emptyFields = {
    title: !title.trim(),
    genre: !genre.trim(),
    mood: !mood.trim(),
    tags: !tags.trim(),
    negative_tags: !negativeTags.trim(),
    vocal_gender: !vocalGender && !instrumental,
    lyrics: customMode && !lyrics.trim() && !instrumental,
    ai_description: !customMode && !aiDescription.trim(),
  };
  const emptyCount = Object.values(emptyFields).filter(Boolean).length;

  const runAssist = async () => {
    setLoading(true);
    setSuggestions(null);
    try {
      const targets = Object.entries(emptyFields).filter(([, v]) => v).map(([k]) => k);
      if (targets.length === 0) {
        toast.info('All fields are already filled in!');
        setLoading(false);
        return;
      }

      const ctx = {
        task: taskKind === 'extend' ? 'extending a track with new sections' : 're-imagining a track as a cover in a new style',
        source_track_name: sourceLabel || 'an uploaded audio track',
        user_vibe_hint: vibeHint || '(none provided — pick something compelling and cohesive)',
        already_filled: {
          ...(title.trim() && { title }),
          ...(genre.trim() && { genre }),
          ...(mood.trim() && { mood }),
          ...(tags.trim() && { tags }),
          ...(negativeTags.trim() && { negative_tags: negativeTags }),
          ...(vocalGender && { vocal_gender: vocalGender }),
          ...(instrumental && { instrumental: true }),
          ...(customMode && lyrics.trim() && { existing_lyrics: lyrics.slice(0, 600) }),
          ...(!customMode && aiDescription.trim() && { ai_description: aiDescription }),
        },
        mode: customMode ? 'custom_lyrics' : 'ai_description',
      };

      const prompt = `You are a creative producer helping a user prepare a music ${ctx.task}.

Source: ${ctx.source_track_name}
User vibe hint: ${ctx.user_vibe_hint}
Mode: ${ctx.mode}
Already filled in: ${JSON.stringify(ctx.already_filled)}

Generate suggestions ONLY for these empty fields: ${targets.join(', ')}.

Rules:
- Be cohesive — every field must fit the same artistic vision.
- title: ≤ 60 chars, evocative.
- genre: 1-3 genre words (e.g. "indie folk", "synthwave").
- mood: 1-3 mood words (e.g. "melancholic, warm").
- tags: 4-8 comma-separated style descriptors (instruments, era, production cues). Max 200 chars.
- negative_tags: 2-5 things to avoid that would clash with the vibe. Max 200 chars.
- vocal_gender: "f" or "m" (omit only if instrumental).
- lyrics: full song with [Verse], [Chorus], [Bridge] tags. 12-32 lines total. Match the vibe.
- ai_description: 1-3 sentences describing the cover's style. Max 380 chars.

Return ONLY JSON with keys for the requested fields.`;

      const schema = {
        type: 'object',
        properties: {
          title: { type: 'string' },
          genre: { type: 'string' },
          mood: { type: 'string' },
          tags: { type: 'string' },
          negative_tags: { type: 'string' },
          vocal_gender: { type: 'string', enum: ['f', 'm', ''] },
          lyrics: { type: 'string' },
          ai_description: { type: 'string' },
        },
      };

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema,
      });

      // Only keep the fields we asked for
      const filtered = {};
      for (const k of targets) {
        if (result && typeof result[k] === 'string' && result[k].trim()) filtered[k] = result[k].trim();
      }

      if (Object.keys(filtered).length === 0) {
        toast.error('AI returned no usable suggestions. Try a different vibe hint.');
        setLoading(false);
        return;
      }

      setSuggestions(filtered);
      // Pre-select all suggestions
      const sel = {};
      for (const k of Object.keys(filtered)) sel[k] = true;
      setSelected(sel);
    } catch (err) {
      toast.error(err.message || 'AI assistant failed');
    }
    setLoading(false);
  };

  const apply = () => {
    if (!suggestions) return;
    const picked = {};
    for (const [k, v] of Object.entries(suggestions)) {
      if (selected[k]) picked[k] = v;
    }
    if (Object.keys(picked).length === 0) {
      toast.error('Select at least one suggestion to apply');
      return;
    }
    onApply(picked);
    toast.success(`Applied ${Object.keys(picked).length} suggestion${Object.keys(picked).length > 1 ? 's' : ''}!`, { icon: '✨' });
    // Reset & close
    setOpen(false);
    setSuggestions(null);
    setSelected({});
    setVibeHint('');
  };

  const fieldLabels = {
    title: 'Title',
    genre: 'Genre',
    mood: 'Mood',
    tags: 'Style Tags',
    negative_tags: 'Negative Tags',
    vocal_gender: 'Vocal Gender',
    lyrics: 'Lyrics',
    ai_description: 'AI Description',
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant="outline"
        className="w-full rounded-xl text-xs gap-2 border-fuchsia-500/40 bg-fuchsia-500/5 hover:bg-fuchsia-500/15 text-fuchsia-200"
      >
        <Sparkles className="w-4 h-4" />
        AI Assistant — Fill {emptyCount > 0 ? `${emptyCount} missing field${emptyCount > 1 ? 's' : ''}` : 'fields'}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSuggestions(null); setSelected({}); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-fuchsia-400" /> AI Assistant
            </DialogTitle>
            <DialogDescription>
              {emptyCount > 0
                ? `${emptyCount} field${emptyCount > 1 ? 's are' : ' is'} empty. Optionally describe the vibe, then let AI fill them in.`
                : 'Everything is filled in — but you can still get fresh suggestions for anything you want to regenerate by clearing those fields first.'}
            </DialogDescription>
          </DialogHeader>

          {!suggestions && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground">Vibe hint <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Textarea
                  value={vibeHint}
                  onChange={(e) => setVibeHint(e.target.value)}
                  placeholder="e.g. acoustic indie folk, melancholic and warm, female vocal, late-night autumn feel"
                  rows={3}
                  className="rounded-xl text-sm mt-1"
                  maxLength={400}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  The more direction you give, the more cohesive the suggestions. Leave blank for AI's choice.
                </p>
              </div>

              {emptyCount > 0 && (
                <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-muted/30 border border-border">
                  <p className="text-[10px] text-muted-foreground w-full mb-1">Will fill:</p>
                  {Object.entries(emptyFields).filter(([, v]) => v).map(([k]) => (
                    <Badge key={k} variant="outline" className="text-[10px] border-fuchsia-500/40 text-fuchsia-200">
                      {fieldLabels[k]}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {suggestions && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Review suggestions — uncheck any you don't want.</p>
              {Object.entries(suggestions).map(([k, v]) => (
                <label key={k} className={`block p-3 rounded-xl border cursor-pointer transition-colors ${
                  selected[k] ? 'border-fuchsia-500/60 bg-fuchsia-500/10' : 'border-border bg-muted/20'
                }`}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={!!selected[k]}
                      onChange={(e) => setSelected(s => ({ ...s, [k]: e.target.checked }))}
                      className="mt-1 accent-fuchsia-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        {selected[k] && <Check className="w-3 h-3 text-fuchsia-400" />}
                        {fieldLabels[k] || k}
                      </p>
                      <p className={`text-xs mt-1 ${k === 'lyrics' ? 'font-mono whitespace-pre-wrap' : ''} text-muted-foreground`}>
                        {k === 'vocal_gender'
                          ? (v === 'f' ? 'Female' : v === 'm' ? 'Male' : 'Auto')
                          : v}
                      </p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            {suggestions ? (
              <>
                <Button variant="outline" onClick={runAssist} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Regenerate
                </Button>
                <Button onClick={apply} className="bg-gradient-to-r from-fuchsia-600 to-rose-600 gap-2">
                  <Wand2 className="w-4 h-4" /> Apply Selected
                </Button>
              </>
            ) : (
              <Button onClick={runAssist} disabled={loading || emptyCount === 0}
                className="bg-gradient-to-r from-fuchsia-600 to-rose-600 gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? 'Thinking…' : 'Generate Suggestions'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}