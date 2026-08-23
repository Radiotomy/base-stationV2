import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Loader2, Sparkles, CheckCircle2, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import CostBadge from '@/components/credits/CostBadge';
import { handleCreditError, refreshCreditsFromResponse, getProviderErrorMessage } from '@/utils/creditErrors';
import { calculateHumanParticipationScore } from '@/utils/participationScore';

const MODELS = [
  { value: 'music_v1', label: 'Music v1', desc: 'Flagship — vocals or instrumental' },
  { value: 'music_v2', label: 'Music v2', desc: 'Latest — highest fidelity 48kHz' },
];

/**
 * Base Eleven Music generation — the untrained model, living alongside My Sound
 * finetunes because both run on ElevenLabs and nothing else.
 */
export default function ElevenMusicPanel() {
  const [model, setModel] = useState('music_v1');
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [duration, setDuration] = useState([0]); // 0 = let the model decide
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (!prompt.trim()) return toast.error('Describe the track you want');
    setGenerating(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('generateMusic', {
        provider: 'elevenlabs',
        model,
        sound_prompt: prompt.trim(),
        title: title.trim() || undefined,
        ...(lyrics.trim() && { lyrics: lyrics.trim() }),
        ...(duration[0] > 0 && { duration: duration[0] }),
        ...(!lyrics.trim() && { tempolor_mode: 'instrumental' }),
      });
      if (res.data?.error) throw new Error(res.data.error);
      refreshCreditsFromResponse(res.data);
      setResult(res.data);
      toast.success('🎧 Track ready — MP3, C2PA provenance-signed');
    } catch (err) {
      const msg = getProviderErrorMessage(err) || err?.response?.data?.message || err.message;
      if (!handleCreditError(err)) toast.error(msg);
    }
    setGenerating(false);
  };

  const saveToLibrary = async () => {
    if (!result?.audio_url) return;
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const participation = await calculateHumanParticipationScore({
        userProvidedContent: !!lyrics.trim(),
        prompt,
        styleOrTags: [],
        personaOrTemplate: false,
        isIteration: false,
      });
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: title.trim() || prompt.slice(0, 40),
        file_url: result.audio_url,
        is_public: false,
        ai_label: participation.label,
        ai_disclosure_label: participation.label,
        ai_disclosure_basis: participation.basis,
        human_participation_score: participation.score,
        participation_signals: participation.signals,
        ddex_ai_metadata: participation.ddex,
        metadata: {
          provider: 'elevenlabs',
          model,
          sound_prompt: prompt,
          lyrics: lyrics.trim(),
          duration: duration[0] || result.duration || undefined,
          ai_assisted: true,
        },
      });
      toast.success('Saved to your library');
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message);
    }
    setSaving(false);
  };

  return (
    <div className="bg-card border border-violet-500/30 rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Headphones className="w-4 h-4 text-violet-400" /> Generate with Eleven Music
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          The base model — no training needed. Returns instantly as a C2PA-signed MP3.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Model</p>
        <div className="grid grid-cols-2 gap-1.5">
          {MODELS.map(m => (
            <button key={m.value} type="button" onClick={() => setModel(m.value)}
              className={`px-2.5 py-2 rounded-lg border text-left transition-all ${model === m.value ? 'border-violet-500 bg-violet-500/10' : 'border-border bg-card hover:border-border/60'}`}>
              <p className="text-xs font-bold text-foreground">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Track Title (Optional)</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Leave blank to name it from your prompt"
          maxLength={80}
          className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Describe the track</label>
        <Textarea
          placeholder='e.g. "Warm neo-soul with Rhodes piano, live bass groove, late-night feel at 92 BPM"'
          value={prompt} onChange={e => setPrompt(e.target.value)}
          rows={3} maxLength={4000}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">
          Lyrics (Optional — leave blank for an instrumental)
        </label>
        <Textarea
          placeholder="Paste your lyrics here…"
          value={lyrics} onChange={e => setLyrics(e.target.value)}
          rows={4}
        />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-muted-foreground w-28 flex-shrink-0">
          Length: {duration[0] ? `${duration[0]}s` : 'Auto'}
        </span>
        <Slider value={duration} onValueChange={setDuration} min={0} max={300} step={10} className="flex-1" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Cost: <strong className="text-foreground">10 credits</strong> per track</p>
        <Button onClick={generate} disabled={generating || !prompt.trim()} className="gap-2">
          {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Composing…</> : <><Sparkles className="w-4 h-4" /> Generate Track</>}
          {!generating && <CostBadge cost={10} size="sm" />}
        </Button>
      </div>

      {result?.audio_url && (
        <div className="p-3 rounded-xl bg-secondary/60 border border-border space-y-2">
          <p className="text-xs font-semibold text-emerald-400 inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Track ready
          </p>
          <audio controls src={result.audio_url} className="w-full" />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={saveToLibrary} disabled={saving} className="rounded-lg bg-emerald-600 hover:bg-emerald-500">
              {saving ? 'Saving…' : 'Save to Library'}
            </Button>
            <a href={result.audio_url} download>
              <Button size="sm" variant="outline" className="rounded-lg">Download MP3</Button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}