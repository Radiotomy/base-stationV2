import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Layers, Loader2, Wand2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import StudioPageHeader from '@/components/studio/StudioPageHeader';
import AssetPicker from '@/components/studio/AssetPicker';
import StemDeck from '@/components/stems/StemDeck';
import ProvenancePanel from '@/components/studio/ProvenancePanel';
import AddToProjectButton from '@/components/studio/AddToProjectButton';
import OnDeviceStemPanel from '@/components/stems/OnDeviceStemPanel';

// Sever runs HTDemucs-6s, which produces six sources — guitar and piano are
// pulled out separately instead of being buried in "other".
const OUTPUT_STEMS = [
  { id: 'vocals', label: 'Vocals', emoji: '🎤' },
  { id: 'drums', label: 'Drums', emoji: '🥁' },
  { id: 'bass', label: 'Bass', emoji: '🎵' },
  { id: 'guitar', label: 'Guitar', emoji: '🎸' },
  { id: 'piano', label: 'Piano', emoji: '🎹' },
  { id: 'other', label: 'Other', emoji: '🎺' },
];

export default function StemCreatorStudio() {
  const params = new URLSearchParams(window.location.search);
  const preselected = params.get('assetId');

  const [selected, setSelected] = useState(preselected ? [preselected] : []);
  const [running, setRunning] = useState(false);
  const [stems, setStems] = useState(null);
  // The on-device path needs the actual file to decode, not just an id.
  const [sourceAsset, setSourceAsset] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!selected[0]) { setSourceAsset(null); return; }
    base44.entities.UserAsset.filter({ id: selected[0] })
      .then(rows => setSourceAsset(rows[0] || null));
  }, [selected]);

  const poll = (jobId, attempt = 0) => {
    // Sever separates on CPU and runs one job at a time, so a queued job can
    // wait behind another creator's track — allow ~10 minutes before giving up.
    if (attempt > 120) {
      setRunning(false);
      toast.error('Separation is taking longer than expected — check your library shortly.');
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await base44.functions.invoke('pollSeverStems', { job_id: jobId });
        if (r.data?.status === 'completed') {
          setStems(r.data.stems || []);
          setRunning(false);
          toast.success(`Separated ${r.data.stems?.length || 0} stems`, { icon: '🎛️' });
        } else if (r.data?.status === 'failed') {
          setRunning(false);
          toast.error(r.data.error || 'Stem separation failed');
        } else {
          poll(jobId, attempt + 1);
        }
      } catch {
        poll(jobId, attempt + 1);
      }
    }, 5000);
  };

  const generate = async () => {
    if (selected.length === 0) { toast.error('Pick a track first'); return; }
    setRunning(true);
    setStems(null);
    try {
      const r = await base44.functions.invoke('separateStemsSever', { assetId: selected[0] });
      toast.success('Separation started — this takes a minute or two.');
      poll(r.data?.job_id);
    } catch (e) {
      setRunning(false);
      toast.error(e?.response?.data?.error || 'Stem separation failed');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={Layers} accent="emerald"
        title="Stem Creator Studio"
        subtitle="Split any track into six stems — vocals, drums, bass, guitar, piano and other."
        badge="Sever engine" />

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-black">1. Source Track</h3>
            <AssetPicker assetType="track" selected={selected} onChange={setSelected} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black">2. What You Get</h3>
            <p className="text-xs text-muted-foreground">
              Sever splits the whole mix in one pass and returns all six together, so there's
              no subset to pick. It runs on our own engine — one track at a time, so a busy
              queue means a longer wait rather than a failure.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {OUTPUT_STEMS.map(s => (
                <div key={s.id} className="p-3 rounded-xl border border-border bg-muted/30">
                  <div className="text-xl mb-1">{s.emoji}</div>
                  <p className="text-xs font-bold">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={generate} disabled={running || selected.length === 0}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 gap-2 font-bold">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {running ? 'Separating…' : 'Separate Stems'}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Costs 2 credits — charged only if separation succeeds.
          </p>

          <OnDeviceStemPanel asset={sourceAsset} onComplete={setStems} />
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {!stems && !running && (
            <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
              <Layers className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Pick a track to split into stems.</p>
            </div>
          )}

          {running && (
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-emerald-400" />
              <p className="text-sm font-bold">Separating stems…</p>
              <p className="text-xs text-muted-foreground mt-1">
                Usually a minute or two. You can leave this page — the stems land in your library.
              </p>
            </div>
          )}

          {stems?.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm font-bold">{stems.length} stems ready</p>
                </div>
                <AddToProjectButton asset={stems[0]} tool="stem_creator" toolRoute="/stem-creator" />
              </div>
              <StemDeck stems={stems} />
            </>
          )}

          {stems?.[0] && <ProvenancePanel asset={stems[0]} />}
        </div>
      </div>
    </div>
  );
}