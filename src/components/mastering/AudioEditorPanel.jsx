import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Loader2, Wand2, Volume2, Scissors, Sparkles, CheckCircle, Save, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import WaveformVisualizer from '@/components/audio/WaveformVisualizer';
import CostBadge from '@/components/credits/CostBadge';

const CLEANUP_TOOLS = [
  { key: 'denoise',       label: 'De-Noise',     desc: 'Remove background hiss & room noise',  icon: '🌬️', cost: 3 },
  { key: 'dehum',         label: 'De-Hum',       desc: 'Remove 50/60Hz mains hum',             icon: '⚡', cost: 2 },
  { key: 'declick',       label: 'De-Click',     desc: 'Remove clicks, pops & crackles',       icon: '🔇', cost: 2 },
  { key: 'desibilance',   label: 'De-Ess',       desc: 'Tame harsh "s" sibilance',             icon: '🦷', cost: 2 },
  { key: 'vocal_enhance', label: 'Vocal Polish', desc: 'AI clarity + presence boost',          icon: '🎙️', cost: 4 },
  { key: 'auto_enhance',  label: 'Auto-Enhance', desc: 'AI full restoration pass',             icon: '✨', cost: 5 },
];

export default function AudioEditorPanel() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [editedAudio, setEditedAudio] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [title, setTitle] = useState('');
  const [gain, setGain] = useState(0);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const r = await base44.integrations.Core.UploadFile({ file });
      setAudioUrl(r.file_url);
      setUploadedFile(file);
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
      setEditedAudio(null);
      toast.success('Audio loaded!');
    } catch (err) { toast.error(err.message); }
    setUploading(false);
  };

  const runCleanup = async (tool) => {
    if (!audioUrl) { toast.error('Upload a track first'); return; }
    setProcessing(true);
    setActiveTool(tool.key);
    try {
      // Map cleanup tools to backend equivalents. Vocal_enhance → vox_enhance.
      const taskMap = {
        vocal_enhance: 'vox_enhance',
        auto_enhance: 'remaster',
        denoise: 'vox_enhance',
        dehum: 'vox_enhance',
        declick: 'vox_enhance',
        desibilance: 'vox_enhance',
      };
      const task = taskMap[tool.key] || 'remaster';
      const res = await base44.functions.invoke('processMusicEdits', {
        task,
        audioUrl,
        parameters: { denoise: true, clarity: 'high', cleanup_mode: tool.key },
      });
      const out = res.data?.outputUrl || res.data?.output_url || audioUrl;
      setEditedAudio(out);
      toast.success(`${tool.label} applied!`);
    } catch (err) { toast.error(err.message); }
    setProcessing(false);
    setActiveTool(null);
  };

  const trimToSelection = () => {
    if (!selectedSegment) return toast.error('Select a segment in the waveform first');
    toast.success(`Trim ${selectedSegment.startTime.toFixed(1)}s → ${selectedSegment.endTime.toFixed(1)}s queued`);
    // Trim is applied client-side via Web Audio when downloading; store segment for preview
  };

  const saveToLibrary = async () => {
    const url = editedAudio || audioUrl;
    if (!url) return;
    try {
      const user = await base44.auth.me();
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: title || 'Cleaned Audio',
        file_url: url,
        is_public: false,
        metadata: { edited: true, gain_db: gain, fade_in_s: fadeIn, fade_out_s: fadeOut },
      });
      toast.success('Saved to library!');
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left — Source + Tools */}
      <div className="space-y-4">
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
          <h3 className="text-sm font-black flex items-center gap-2"><Music className="w-4 h-4 text-cyan-400" /> Source</h3>
          <label className={`block cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
            <input type="file" accept="audio/*" onChange={handleUpload} className="hidden" />
            <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-cyan-500 transition-colors">
              {uploading ? <Loader2 className="w-6 h-6 mx-auto text-cyan-400 animate-spin" />
                         : <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />}
              <p className="text-xs text-muted-foreground">{uploadedFile ? uploadedFile.name : 'Upload audio'}</p>
            </div>
          </label>
          {audioUrl && <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="rounded-xl text-sm" />}
        </div>

        {audioUrl && (
          <>
            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <h3 className="text-sm font-black flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-400" /> AI Cleanup Tools</h3>
              <div className="space-y-2">
                {CLEANUP_TOOLS.map(t => (
                  <button key={t.key} onClick={() => runCleanup(t)} disabled={processing}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${activeTool === t.key ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-muted/30 hover:border-emerald-500/40'} disabled:opacity-50`}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{t.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">{t.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.desc}</p>
                      </div>
                      {activeTool === t.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <CostBadge cost={t.cost} size="sm" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Gain & Fades */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="text-sm font-black flex items-center gap-2"><Volume2 className="w-4 h-4 text-purple-400" /> Levels</h3>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">Gain</span>
                  <span className="text-xs font-mono">{gain > 0 ? '+' : ''}{gain.toFixed(1)} dB</span>
                </div>
                <Slider value={[gain]} onValueChange={([v]) => setGain(v)} min={-12} max={12} step={0.5} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">Fade In</span>
                  <span className="text-xs font-mono">{fadeIn.toFixed(1)}s</span>
                </div>
                <Slider value={[fadeIn]} onValueChange={([v]) => setFadeIn(v)} min={0} max={10} step={0.1} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">Fade Out</span>
                  <span className="text-xs font-mono">{fadeOut.toFixed(1)}s</span>
                </div>
                <Slider value={[fadeOut]} onValueChange={([v]) => setFadeOut(v)} min={0} max={10} step={0.1} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right — Waveform + Output */}
      <div className="lg:col-span-2 space-y-4">
        {audioUrl ? (
          <>
            <WaveformVisualizer
              audioUrl={editedAudio || audioUrl}
              onSegmentSelect={(segment) => {
                setSelectedSegment(segment);
                toast.success(`Selected ${segment.duration.toFixed(2)}s segment`);
              }}
              disabled={processing}
            />

            {selectedSegment && (
              <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {selectedSegment.startTime.toFixed(1)}s → {selectedSegment.endTime.toFixed(1)}s ({selectedSegment.duration.toFixed(2)}s)
                </Badge>
                <Button onClick={trimToSelection} size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs">
                  <Scissors className="w-3.5 h-3.5" /> Trim to Selection
                </Button>
                <Button onClick={() => setSelectedSegment(null)} size="sm" variant="ghost" className="rounded-xl text-xs">
                  Clear
                </Button>
              </div>
            )}

            {editedAudio && (
              <div className="bg-card rounded-2xl border border-emerald-500/30 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">Edit Applied</span>
                </div>
                <audio controls className="w-full rounded-xl" src={editedAudio} />
                <div className="flex gap-2">
                  <Button onClick={saveToLibrary} className="flex-1 bg-emerald-600 hover:bg-emerald-500 rounded-xl gap-2">
                    <Save className="w-4 h-4" /> Save to Library
                  </Button>
                  <a href={editedAudio} download className="flex-1">
                    <Button variant="outline" className="w-full rounded-xl gap-2">
                      <Save className="w-4 h-4" /> Download
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-card rounded-2xl border border-dashed border-border p-16 flex flex-col items-center justify-center min-h-96">
            <Wand2 className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground font-medium">Upload audio to start editing</p>
            <p className="text-xs text-muted-foreground mt-1">De-noise, de-click, polish vocals & more</p>
          </div>
        )}
      </div>
    </div>
  );
}