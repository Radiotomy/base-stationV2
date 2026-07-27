import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Mic2, Play, Pause, Loader2, Download, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import CostBadge from '@/components/credits/CostBadge';
import { handleCreditError, refreshCreditsFromResponse } from '@/utils/creditErrors';

export default function VoiceSynthesisPanel({ persona }) {
  const [text, setText] = useState('');
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const pollRef = useRef(null);

  const synthesize = async () => {
    if (!text.trim()) { toast.error('Enter text to synthesize'); return; }
    setLoading(true);
    setAudioUrl(null);
    setTaskId(null);
    try {
      const res = await base44.functions.invoke('synthesizeVoice', {
        text,
        persona_name: persona?.name || 'Default Voice',
        voice_type: persona?.voice_type || 'male',
        accent: persona?.accent || 'neutral',
        characteristics: persona?.characteristics || [],
        speed,
        pitch,
      });
      const data = res.data;
      refreshCreditsFromResponse(data);
      if (data?.audio_url) {
        setAudioUrl(data.audio_url);
        setLoading(false);
        toast.success('Voice synthesized!');
      } else if (data?.task_id) {
        setTaskId(data.task_id);
        pollRef.current = setInterval(async () => {
          try {
            const pollRes = await base44.functions.invoke('pollGenerationJob', { job_id: data.task_id });
            const status = pollRes.data?.status;
            if (status === 'completed') {
              setAudioUrl(pollRes.data.output_url);
              setLoading(false);
              clearInterval(pollRef.current);
              toast.success('Voice ready!');
            } else if (status === 'failed') {
              setLoading(false);
              clearInterval(pollRef.current);
              toast.error('Synthesis failed');
            }
          } catch { clearInterval(pollRef.current); setLoading(false); }
        }, 3000);
      } else {
        setLoading(false);
        toast.error(data?.error || 'Synthesis failed');
      }
    } catch (err) {
      setLoading(false);
      if (!handleCreditError(err)) toast.error(err?.response?.data?.message || err.message);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Mic2 className="w-5 h-5 text-pink-400" />
        <h4 className="font-black text-foreground">Test Voice Synthesis</h4>
        {persona && (
          <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-xs">{persona.name}</Badge>
        )}
      </div>

      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Enter text to synthesize with this voice persona…"
        rows={3}
        className="rounded-xl text-sm"
        maxLength={500}
      />
      <p className="text-xs text-muted-foreground text-right">{text.length}/500</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Speed</label>
          <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={0.5} max={2} step={0.1} />
          <p className="text-xs text-muted-foreground text-center">{speed.toFixed(1)}x</p>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Pitch</label>
          <Slider value={[pitch]} onValueChange={([v]) => setPitch(v)} min={-12} max={12} step={1} />
          <p className="text-xs text-muted-foreground text-center">{pitch > 0 ? '+' : ''}{pitch} st</p>
        </div>
      </div>

      <Button onClick={synthesize} disabled={loading || !text.trim()} className="w-full bg-pink-600 hover:bg-pink-500 rounded-xl font-bold gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {loading ? 'Synthesizing…' : 'Synthesize Voice'}
        {!loading && <CostBadge cost={2} size="sm" />}
      </Button>

      {audioUrl && (
        <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
          <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
          <div className="flex gap-2">
            <Button onClick={togglePlay} size="sm" className="bg-pink-600 hover:bg-pink-500 rounded-xl gap-2 flex-1">
              {isPlaying ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Play Result</>}
            </Button>
            <a href={audioUrl} download="synthesized_voice.mp3">
              <Button size="sm" variant="outline" className="rounded-xl">
                <Download className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}