import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Loader2, Sparkles, Download, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import InfoTip from '@/components/common/InfoTip';

const TASKS = [
  { value: 'cover', label: '🎨 Cover', desc: 'Keep the song structure, restyle it completely with new tags' },
  { value: 'repaint', label: '🖌️ Repaint', desc: 'Regenerate only a time section — the rest stays untouched' },
  { value: 'extract', label: '🔬 Extract', desc: 'Pull one instrument track out of the mix' },
];
const EXTRACT_TRACKS = ['vocals', 'drums', 'bass', 'guitar', 'piano'];
const COST = 10;

export default function CodaEditPanel({ audioUrl, selectedSegment }) {
  const [task, setTask] = useState('cover');
  const [tags, setTags] = useState('');
  const [strength, setStrength] = useState(0.8);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [trackName, setTrackName] = useState('vocals');
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | running | done | error
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  // Waveform segment selection prefills the repaint window
  useEffect(() => {
    if (selectedSegment && task === 'repaint') {
      setStart(selectedSegment.startTime?.toFixed(1) ?? '');
      setEnd(selectedSegment.endTime?.toFixed(1) ?? '');
    }
  }, [selectedSegment, task]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const run = async () => {
    setError('');
    setResult(null);
    if ((task === 'cover' || task === 'repaint') && !tags.trim()) {
      toast.error('Describe the target style in tags first');
      return;
    }
    setPhase('running');
    setProgress('Submitting to the Coda engine…');
    try {
      const res = await base44.functions.invoke('generateCodaEdit', {
        task,
        src_audio_url: audioUrl,
        tags: tags.trim(),
        cover_strength: task === 'cover' ? strength : undefined,
        repaint_start: task === 'repaint' ? Number(start) : undefined,
        repaint_end: task === 'repaint' ? Number(end) : undefined,
        track_name: task === 'extract' ? trackName : undefined,
        title: title.trim(),
      });
      const jobId = res.data?.job_id;
      if (!jobId) throw new Error(res.data?.error || 'Submission failed');
      setProgress('Rendering on the engine (GPU may need a cold start)…');
      pollRef.current = setInterval(async () => {
        try {
          const p = await base44.functions.invoke('pollCodaEditJob', { job_id: jobId });
          if (p.data?.status === 'completed') {
            clearInterval(pollRef.current);
            setResult(p.data.output_url);
            setPhase('done');
            toast.success('Edit complete — saved to your library');
          } else if (p.data?.status === 'failed') {
            clearInterval(pollRef.current);
            setError(p.data.error || 'Engine failure');
            setPhase('error');
          } else if (p.data?.progress) {
            setProgress(p.data.progress);
          }
        } catch { /* transient — keep polling */ }
      }, 5000);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      setPhase('error');
    }
  };

  const running = phase === 'running';

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-foreground text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-orange-400" /> Coda AI Edit
          <InfoTip text="Runs on our self-hosted ACE-Step 1.5 engine. Works best on WAV/FLAC sources (generated tracks are WAV). Output is 48kHz WAV, auto-saved to your library." />
        </h3>
        <span className="text-xs text-muted-foreground font-bold">{COST} credits</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TASKS.map(t => (
          <button key={t.value} onClick={() => { setTask(t.value); setPhase('idle'); setResult(null); setError(''); }}
            disabled={running}
            className={`p-2.5 rounded-xl border text-left transition-all ${task === t.value ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-card hover:border-border/80'}`}>
            <p className="text-xs font-bold text-foreground">{t.label}</p>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{TASKS.find(t => t.value === task)?.desc}</p>

      {(task === 'cover' || task === 'repaint') && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Target style tags</label>
          <Textarea value={tags} onChange={e => setTags(e.target.value)} rows={2} disabled={running}
            placeholder="e.g. synthwave, analog synths, driving drums, 120 bpm" className="rounded-xl text-xs" />
        </div>
      )}

      {task === 'cover' && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
            Source adherence: {strength.toFixed(2)}
            <InfoTip text="1.0 follows the source structure strictly; lower values give the new style more freedom." />
          </label>
          <Slider value={[strength]} onValueChange={v => setStrength(v[0])} min={0.2} max={1} step={0.05} disabled={running} />
        </div>
      )}

      {task === 'repaint' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Start (s)</label>
            <Input type="number" value={start} onChange={e => setStart(e.target.value)} disabled={running} className="rounded-xl text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">End (s)</label>
            <Input type="number" value={end} onChange={e => setEnd(e.target.value)} disabled={running} className="rounded-xl text-xs" />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">Tip: drag a selection on the waveform above to set the window.</p>
        </div>
      )}

      {task === 'extract' && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Track to extract</label>
          <div className="flex flex-wrap gap-1.5">
            {EXTRACT_TRACKS.map(t => (
              <button key={t} onClick={() => setTrackName(t)} disabled={running}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold capitalize transition-all ${trackName === t ? 'border-orange-500 bg-orange-500/10 text-foreground' : 'border-border text-muted-foreground hover:border-border/80'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase">Result title (optional)</label>
        <Input value={title} onChange={e => setTitle(e.target.value)} disabled={running}
          placeholder={task === 'extract' ? `${trackName} stem` : 'My edited track'} className="rounded-xl text-xs" />
      </div>

      <Button onClick={run} disabled={running || !audioUrl} className="w-full rounded-xl font-bold gap-2 merc-button">
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {running ? 'Rendering…' : `Run ${TASKS.find(t => t.value === task)?.label.replace(/^\S+ /, '')}`}
      </Button>

      {running && <p className="text-xs text-muted-foreground">{progress}</p>}
      {phase === 'error' && <p className="text-xs text-red-400">{error}</p>}

      {phase === 'done' && result && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Saved to your library</p>
          <audio controls className="w-full rounded-xl" src={result} />
          <a href={result} download>
            <Button variant="outline" size="sm" className="w-full rounded-xl gap-2 text-xs"><Download className="w-3.5 h-3.5" /> Download WAV</Button>
          </a>
        </div>
      )}
    </div>
  );
}