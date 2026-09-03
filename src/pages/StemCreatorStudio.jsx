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
import StemEngineSelector, { STEM_ENGINES } from '@/components/stems/StemEngineSelector';
import { pollJob } from '@/lib/polling/pollJob';

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
  // 'sever' (ours, 6 stems) | 'sonic_basic' (2) | 'sonic_full' (12) — Sonic is the paid upgrade
  const [engine, setEngine] = useState('sever');
  const [running, setRunning] = useState(false);
  const [stems, setStems] = useState(null);
  // The on-device path needs the actual file to decode, not just an id.
  const [sourceAsset, setSourceAsset] = useState(null);
  const watchRef = useRef(null);

  useEffect(() => () => watchRef.current?.cancel(), []);

  useEffect(() => {
    if (!selected[0]) { setSourceAsset(null); return; }
    base44.entities.UserAsset.filter({ id: selected[0] })
      .then(rows => setSourceAsset(rows[0] || null));
  }, [selected]);

  // Sever separates on CPU one job at a time, so a queued job can wait behind
  // another creator's track. Cadence and deadline come from the shared 'engine'
  // polling policy — hammering a busy single-worker engine cannot speed it up.
  const poll = (jobId, pollFn) => {
    watchRef.current = pollJob(
      async () => (await base44.functions.invoke(pollFn, { job_id: jobId })).data || {},
      'engine',
    );
    watchRef.current.promise.then(({ outcome, data, error }) => {
      setRunning(false);
      if (outcome === 'completed') {
        setStems(data.stems || []);
        toast.success(`Separated ${data.stems?.length || 0} stems`, { icon: '🎛️' });
      } else if (outcome === 'failed') {
        toast.error(error || 'Stem separation failed');
      } else {
        toast.error('Separation is taking longer than expected — the stems will land in your library when it finishes.');
      }
    });
  };

  const generate = async () => {
    if (selected.length === 0) { toast.error('Pick a track first'); return; }
    setRunning(true);
    setStems(null);
    try {
      const isSonic = engine !== 'sever';
      const r = isSonic
        ? await base44.functions.invoke('separateStemsSonic', { assetId: selected[0], tier: engine === 'sonic_full' ? 'full' : 'basic' })
        : await base44.functions.invoke('separateStemsSever', { assetId: selected[0] });
      const jobId = r.data?.data?.job_id || r.data?.job_id;
      if (!jobId) {
        setRunning(false);
        toast.error('The engine did not start a separation — nothing was charged.');
        return;
      }
      toast.success('Separation started — this takes a minute or two.');
      poll(jobId, isSonic ? 'pollSonicStems' : 'pollSeverStems');
    } catch (e) {
      setRunning(false);
      toast.error(e?.response?.data?.error || 'Stem separation failed');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={Layers} accent="emerald"
        title="Stem Creator Studio"
        subtitle="Split any track into stems — six on our Sever engine, or up to twelve on Sonic Studio."
        badge={engine === 'sever' ? 'Sever engine' : 'Sonic engine'} />

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-black">1. Source Track</h3>
            <AssetPicker assetType="track" selected={selected} onChange={setSelected} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black">2. Engine</h3>
            <StemEngineSelector value={engine} onChange={setEngine}
              needsUpload={!!sourceAsset && !sourceAsset.metadata?.clip_id && !sourceAsset.metadata?.sonic_upload_clip_id} />
          </div>

          {engine === 'sever' && (
            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <h3 className="text-sm font-black">3. What You Get</h3>
              <p className="text-xs text-muted-foreground">
                Sever splits the whole mix in one pass and returns all six together. It runs on
                our own engine — one track at a time, so a busy queue means a longer wait rather
                than a failure.
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
          )}

          <Button onClick={generate} disabled={running || selected.length === 0}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 gap-2 font-bold">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {running ? 'Separating…' : 'Separate Stems'}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Costs {STEM_ENGINES.find(e => e.id === engine)?.cost} credits — charged only if separation succeeds.
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