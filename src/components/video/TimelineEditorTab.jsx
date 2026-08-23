import { useCallback, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Play, Undo2, Redo2, Clapperboard, Download, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useShotstackStudio } from '@/hooks/useShotstackStudio';
import { useJobPolling } from '@/hooks/useJobPolling';
import { handleCreditError } from '@/utils/creditErrors';
import { buildStarterTemplate } from '@/lib/video/starterTemplate';
import TimelineAssetPanel from './TimelineAssetPanel';
import RenderStatusMonitor from './RenderStatusMonitor';
import InfoTip from '@/components/common/InfoTip';

/**
 * Drag-and-drop timeline editor powered by the browser Shotstack Studio SDK.
 * The canvas preview and timeline mount into the data-shotstack-* containers.
 */
export default function TimelineEditorTab() {
  const template = useMemo(() => buildStarterTemplate(), []);
  const { edit, ready, error } = useShotstackStudio(template);
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onComplete = useCallback((data) => { setResult(data); toast.success('🎬 Render complete!'); }, []);
  const onError = useCallback((msg) => toast.error(msg || 'Render failed'), []);
  // 5s polling so the render phase shown here tracks Shotstack closely
  const { status, stage, progress, elapsedSeconds } = useJobPolling(jobId, onComplete, onError, 120, 5000);
  const rendering = !!jobId && status === 'processing';

  const addClip = async (kind, value) => {
    const e = edit.current;
    if (!e) return;
    try {
      const start = e.totalDuration || 0;
      if (kind === 'audio') {
        // audio lives on its own track so it never collides with visual clips
        await e.addTrack(1, { clips: [{ asset: { type: 'audio', src: value }, start: 0, length: Math.max(10, e.totalDuration || 10) }] });
      } else if (kind === 'video' || kind === 'image') {
        await e.addClip(0, { asset: { type: kind, src: value }, start, length: 5 });
      } else {
        await e.addClip(0, {
          asset: {
            type: 'rich-text',
            text: value,
            font: { family: 'Work Sans', size: 48, weight: 600, color: '#ffffff', opacity: 1 },
            align: { horizontal: 'center', vertical: 'middle' },
          },
          start,
          length: 3,
          width: 900,
          height: 200,
        });
      }
      toast.success('Clip added — drag it on the timeline to position it');
    } catch (err) {
      toast.error(err.message || 'Could not add that clip');
    }
  };

  const render = async () => {
    const e = edit.current;
    if (!e) return;
    setSubmitting(true);
    setResult(null);
    try {
      const json = e.getEdit();
      const res = await base44.functions.invoke('renderShotstackEdit', { edit: json });
      setJobId(res.data.job_id);
      toast.success(`Rendering ${res.data.clip_count} clips — ${res.data.credit_cost} credits`);
    } catch (err) {
      if (!handleCreditError(err)) toast.error(err?.response?.data?.error || err.message);
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <Clapperboard className="w-4 h-4 text-indigo-400" /> Timeline Editor
        </h3>
        <InfoTip text="Drag clips to move them, drag their edges to trim, and use the transport controls to preview. Costs 5 credits + 1 per clip to render." />
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" disabled={!ready} onClick={() => edit.current?.play()}>
          <Play className="w-3.5 h-3.5" /> Preview
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" disabled={!ready} onClick={() => edit.current?.undo()}>
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" disabled={!ready} onClick={() => edit.current?.redo()}>
          <Redo2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-400 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
          Timeline editor failed to load: {error}
        </p>
      )}

      <div className="relative rounded-xl overflow-hidden border border-border bg-black">
        <div data-shotstack-studio className="w-full aspect-video" />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        )}
      </div>

      <div data-shotstack-timeline className="w-full rounded-xl overflow-x-auto border border-border bg-card" />

      <TimelineAssetPanel onAdd={addClip} disabled={!ready} />

      <Button onClick={render} disabled={!ready || submitting || rendering}
        className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-base py-5 gap-2">
        {submitting || rendering
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Rendering… {progress || 0}%</>
          : <><Clapperboard className="w-5 h-5" /> Render Timeline</>}
      </Button>

      {!!jobId && !result?.video_url && (
        <RenderStatusMonitor stage={stage} status={status} elapsedSeconds={elapsedSeconds} label="Timeline render" />
      )}

      {result?.video_url && (
        <div className="bg-card rounded-2xl border border-emerald-500/30 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-emerald-400">Render Ready</span>
          </div>
          <video controls className="w-full rounded-xl" src={result.video_url} />
          <a href={result.video_url} download>
            <Button variant="outline" className="w-full gap-2 rounded-xl">
              <Download className="w-4 h-4" /> Download
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}