import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Music, Upload, Zap, Save, ArrowLeft, Loader2, Download, CheckCircle, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import WaveformVisualizer from '@/components/audio/WaveformVisualizer';
import StemTrack from '@/components/audio/StemTrack';

const EDIT_TASKS = [
  { value: 'extract_stems', label: '🎚️ Extract Stems', desc: 'Separate vocals, drums, bass & other' },
  { value: 'remaster', label: '✨ Remaster', desc: 'Enhance & normalize audio levels' },
  { value: 'vox_isolate', label: '🎙️ VOX Isolate', desc: 'Extract clean vocal track only', group: 'vox' },
  { value: 'vox_remove', label: '🔇 VOX Remove', desc: 'Remove vocals — instrumental only', group: 'vox' },
  { value: 'vox_enhance', label: '✨ VOX Enhance', desc: 'De-noise & enhance vocal clarity', group: 'vox' },
  { value: 'replace_section', label: '✂️ Replace Section', desc: 'Swap a segment of the audio' },
];

const STEM_TIERS = [
  { value: 'basic', label: 'Basic', desc: '4 stems — vocals, drums, bass, other' },
  { value: 'advanced', label: 'Advanced', desc: 'Full multi-stem breakdown (vocals, backing vocals, drums, kick, snare, bass, guitar, piano, synth, strings, fx & more)' },
];

export default function AudioRemixStudio() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [selectedTask, setSelectedTask] = useState('extract_stems');
  const [stemTier, setStemTier] = useState('basic');
  const [taskParams, setTaskParams] = useState('');
  const [stems, setStems] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [editedAudio, setEditedAudio] = useState(null);
  const [assetTitle, setAssetTitle] = useState('Edited Mix');
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); // pending|processing|completed|failed
  const [metadata, setMetadata] = useState(null); // BPM, key, duration
  const [analyzingMeta, setAnalyzingMeta] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [applyingEffect, setApplyingEffect] = useState(false);

  // Poll job status
  useEffect(() => {
    if (!jobId || jobStatus === 'completed' || jobStatus === 'failed') return;
    const interval = setInterval(async () => {
      try {
        const res = await base44.functions.invoke('pollGenerationJob', { job_id: jobId });
        const status = res.data?.status;
        setJobStatus(status);
        if (status === 'completed') {
          const output = res.data?.output_url;
          if (selectedTask === 'extract_stems') {
            // output is an object keyed by stem name — basic tier returns 4 keys,
            // advanced tier returns the full multi-stem breakdown
            const stemData = res.data?.stems || {};
            setStems(Object.entries(stemData).map(([name, url]) => ({ name, url })).filter(s => s.url));
          } else {
            setEditedAudio(output);
          }
          setProcessing(false);
          toast.success('Processing complete!');
          clearInterval(interval);
        } else if (status === 'failed') {
          toast.error('Processing failed');
          setProcessing(false);
          clearInterval(interval);
        }
      } catch { clearInterval(interval); setProcessing(false); }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobId, jobStatus, selectedTask]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setAudioUrl(result.file_url);
      setUploadedFile(file);
      setStems([]);
      setEditedAudio(null);
      setJobId(null);
      toast.success('Audio uploaded!');
    } catch (error) { toast.error(error.message); }
    setProcessing(false);
  };

  const processAudio = async () => {
    if (!audioUrl) { toast.error('Upload audio first'); return; }
    setProcessing(true);
    setStems([]);
    setEditedAudio(null);
    setJobId(null);
    setJobStatus(null);
    try {
      let params = {};
      if (taskParams) { try { params = JSON.parse(taskParams); } catch { toast.error('Invalid JSON params'); setProcessing(false); return; } }
      if (selectedTask === 'extract_stems') params.tier = stemTier;
      const res = await base44.functions.invoke('processMusicEdits', { task: selectedTask, audioUrl, parameters: params });
      const data = res.data;
      if (data?.task_id) {
        // Async job — start polling
        setJobId(data.task_id);
        setJobStatus('pending');
        toast.success('Processing started — polling for results…');
      } else if (data?.stems) {
        // Synchronous stem result (array or object)
        const stemArr = Array.isArray(data.stems)
          ? data.stems.map((url, i) => ({ name: `Stem ${i + 1}`, url }))
          : Object.entries(data.stems).map(([name, url]) => ({ name, url })).filter(s => s.url);
        setStems(stemArr);
        setProcessing(false);
        toast.success('Stems extracted!');
      } else if (data?.outputUrl) {
        setEditedAudio(data.outputUrl);
        setProcessing(false);
        toast.success('Audio processed!');
      } else {
        setProcessing(false);
        toast.info('Processing complete');
      }
    } catch (error) { toast.error(error.message); setProcessing(false); }
  };

  const analyzeMetadata = async () => {
    if (!audioUrl) return;
    setAnalyzingMeta(true);
    try {
      const res = await base44.functions.invoke('extractAudioMetadata', { audioUrl });
      if (res.data?.metadata) {
        setMetadata(res.data.metadata);
        toast.success('Analysis complete!');
      } else if (res.data) {
        setMetadata(res.data);
        toast.success('Analysis complete!');
      } else {
        throw new Error('No metadata returned');
      }
    } catch (err) { 
      console.error('Metadata analysis error:', err);
      toast.error('Analysis failed: ' + err.message); 
    } finally {
      setAnalyzingMeta(false);
    }
  };

  const saveToLibrary = async () => {
    const urlToSave = editedAudio || audioUrl;
    if (!urlToSave) return;
    try {
      const user = await base44.auth.me();
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: assetTitle,
        file_url: urlToSave,
        is_public: false,
        metadata: { task: selectedTask, processed: !!editedAudio }
      });
      toast.success('Saved to library!');
    } catch (error) { toast.error(error.message); }
  };

  const applySegmentEffect = async (effect) => {
    if (!audioUrl || !selectedSegment) return;
    setApplyingEffect(true);
    try {
      const res = await base44.functions.invoke('applyAudioEffects', {
        audio_url: audioUrl,
        effect: effect,
        start_time: selectedSegment.startTime,
        end_time: selectedSegment.endTime,
      });
      if (res.data?.output_url) {
        setEditedAudio(res.data.output_url);
        toast.success('Effect applied!');
      }
    } catch (err) {
      toast.error('Effect failed: ' + err.message);
    }
    setApplyingEffect(false);
  };

  const jobStatusLabel = { pending: 'Queued…', processing: 'Processing…', completed: 'Done', failed: 'Failed' }[jobStatus] || '';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden pt-20 pb-12 px-6 bg-gradient-to-br from-blue-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">🎛️ Audio Remix Studio</h1>
          <p className="text-white/60 text-lg">Extract stems, VOX isolation, remaster, add vocals or instruments via AI.</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-black text-foreground">Edit Tools</h3>

              {/* Upload */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Upload Audio</label>
                <label className={`block cursor-pointer ${processing ? 'pointer-events-none opacity-50' : ''}`}>
                  <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                  <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-purple-500 transition-colors">
                    {processing && !audioUrl ? (
                      <Loader2 className="w-6 h-6 mx-auto text-purple-400 animate-spin mb-1" />
                    ) : (
                      <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                    )}
                    <p className="text-xs text-muted-foreground">{uploadedFile ? 'Change file' : 'Click to upload'}</p>
                  </div>
                </label>
                {uploadedFile && <Badge className="bg-emerald-500/20 text-emerald-400 border-0 w-full justify-center text-xs truncate">{uploadedFile.name}</Badge>}
              </div>

              {audioUrl && (
                <>
                  {/* Task Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Task</label>
                    <Select value={selectedTask} onValueChange={setSelectedTask}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EDIT_TASKS.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}{t.group === 'vox' ? ' 🎙' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{EDIT_TASKS.find(t => t.value === selectedTask)?.desc}</p>
                  </div>

                  {/* Tiered stem selector — Basic (4-stem) vs Advanced (full multi-stem) */}
                  {selectedTask === 'extract_stems' && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Separation Tier</label>
                      <div className="grid grid-cols-1 gap-2">
                        {STEM_TIERS.map(t => (
                          <button key={t.value} onClick={() => setStemTier(t.value)}
                            className={`p-2.5 rounded-xl border text-left transition-all ${stemTier === t.value ? 'border-purple-500 bg-purple-500/10' : 'border-border bg-card hover:border-border/80'}`}>
                            <p className="text-xs font-bold text-foreground">{t.label}</p>
                            <p className="text-xs text-muted-foreground">{t.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extra params for replace section */}
                  {selectedTask === 'replace_section' && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Parameters (JSON)</label>
                      <Textarea value={taskParams} onChange={e => setTaskParams(e.target.value)}
                        placeholder='{"startTime":10,"endTime":20,"newSegmentUrl":"..."}' rows={2} className="rounded-xl text-xs" />
                    </div>
                  )}

                  {/* Process */}
                  <Button onClick={processAudio} disabled={processing} className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl font-bold gap-2">
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {processing ? (jobStatusLabel || 'Processing…') : 'Run AI Task'}
                  </Button>

                  {/* Job status */}
                  {jobId && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {jobStatus !== 'completed' && jobStatus !== 'failed'
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : jobStatus === 'completed' ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : null}
                      <span>{jobStatusLabel}</span>
                    </div>
                  )}

                  {/* Save */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Asset Title</label>
                    <Input value={assetTitle} onChange={e => setAssetTitle(e.target.value)} className="rounded-xl text-xs" />
                    <Button onClick={saveToLibrary} variant="outline" className="w-full rounded-xl gap-2 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                      <Save className="w-4 h-4" /> Save to Library
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Editor Panel */}
          <div className="lg:col-span-2 space-y-4">
            {audioUrl ? (
              <>
                <WaveformVisualizer
                  audioUrl={audioUrl}
                  onSegmentSelect={(segment) => {
                    setSelectedSegment(segment);
                    toast.success(`Selected ${segment.duration.toFixed(2)}s segment`);
                  }}
                  disabled={processing}
                />

                {selectedSegment && (
                  <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                    <h3 className="font-black text-foreground text-sm">Apply Effect to Selection</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applySegmentEffect('reverb')}
                        disabled={applyingEffect}
                        className="rounded-lg text-xs"
                      >
                        {applyingEffect ? '⏳' : '💫'} Reverb
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applySegmentEffect('delay')}
                        disabled={applyingEffect}
                        className="rounded-lg text-xs"
                      >
                        {applyingEffect ? '⏳' : '🔁'} Delay
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applySegmentEffect('normalize')}
                        disabled={applyingEffect}
                        className="rounded-lg text-xs"
                      >
                        {applyingEffect ? '⏳' : '📊'} Normalize
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applySegmentEffect('pitch_shift')}
                        disabled={applyingEffect}
                        className="rounded-lg text-xs"
                      >
                        {applyingEffect ? '⏳' : '🎵'} Pitch
                      </Button>
                    </div>
                  </div>
                )}

                {/* BPM / Metadata Analysis */}
                <div className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-black text-foreground text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400" /> Audio Analysis</h3>
                    <Button onClick={analyzeMetadata} disabled={analyzingMeta} size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs">
                      {analyzingMeta ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                      {analyzingMeta ? 'Analyzing…' : 'Analyze BPM & Key'}
                    </Button>
                  </div>
                  {metadata ? (
                    <div className="flex flex-wrap gap-3">
                      {metadata.bpm && <div className="text-center"><p className="text-2xl font-black text-cyan-400">{metadata.bpm}</p><p className="text-xs text-muted-foreground">BPM</p></div>}
                      {metadata.key && <div className="text-center"><p className="text-2xl font-black text-purple-400">{metadata.key}</p><p className="text-xs text-muted-foreground">Key</p></div>}
                      {metadata.duration && <div className="text-center"><p className="text-2xl font-black text-emerald-400">{Math.round(metadata.duration)}s</p><p className="text-xs text-muted-foreground">Duration</p></div>}
                      {metadata.loudness && <div className="text-center"><p className="text-2xl font-black text-orange-400">{metadata.loudness}</p><p className="text-xs text-muted-foreground">Loudness</p></div>}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Click Analyze to extract BPM, musical key, duration and loudness.</p>
                  )}
                </div>

                {/* Stems */}
                {stems.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-black text-foreground mb-4">🎚️ Extracted Stems</h3>
                    <p className="text-xs text-muted-foreground mb-4">Play, volume-control, and mute each stem independently.</p>
                    <div className="space-y-3">
                      {stems.map((stem, i) => (
                        <StemTrack key={i} name={stem.name} url={stem.url} index={i} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Edited Output */}
                {editedAudio && (
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <h3 className="font-black text-foreground mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-400" /> Processed Output
                    </h3>
                    <audio controls className="w-full mb-4 rounded-xl" src={editedAudio} />
                    <a href={editedAudio} download="processed.mp3">
                      <Button className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl gap-2">
                        <Download className="w-4 h-4" /> Download
                      </Button>
                    </a>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-card rounded-2xl border border-dashed border-border p-16 flex flex-col items-center justify-center min-h-96">
                <Music className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
                <p className="text-muted-foreground font-medium">Upload audio to begin</p>
                <p className="text-xs text-muted-foreground mt-1">Supports MP3, WAV, FLAC, M4A</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}