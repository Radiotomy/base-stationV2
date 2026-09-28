import { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { FileMusic, Loader2, Save, Mic2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

import StudioPageHeader from '@/components/studio/StudioPageHeader';
import ScoreMetaBar from '@/components/leadsheet/ScoreMetaBar';
import ChordChartInput from '@/components/leadsheet/ChordChartInput';
import LyricSheetInput from '@/components/leadsheet/LyricSheetInput';
import MelodySheetInput from '@/components/leadsheet/MelodySheetInput';
import VoicebankPicker from '@/components/leadsheet/VoicebankPicker';
import VoicebankUploadPanel from '@/components/leadsheet/VoicebankUploadPanel';
import { useAuth } from '@/lib/AuthContext';
import ScoreProvenanceCard from '@/components/leadsheet/ScoreProvenanceCard';
import VocalResultPanel from '@/components/leadsheet/VocalResultPanel';
import BedRenderPanel from '@/components/leadsheet/BedRenderPanel';
import { parseMelody, scoreSeconds } from '@/utils/leadSheetScore';
import { pollJob } from '@/lib/polling/pollJob';

/**
 * Lead Sheet Studio — write the score, then have it sung.
 *
 * The score is saved BEFORE any render can start, on purpose: the engine reads the
 * melody from the stored lead sheet, so the authored artifact always exists (and is
 * hashed) before audio derived from it does.
 */
export default function LeadSheetStudio() {
  const { user } = useAuth();
  const [meta, setMeta] = useState({ key: 'C major', bpm: 120, time_signature: '4/4' });
  const [title, setTitle] = useState('');
  const [chords, setChords] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [melody, setMelody] = useState('');

  const [sheet, setSheet] = useState(null);
  const [saving, setSaving] = useState(false);

  const [banks, setBanks] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [voicebank, setVoicebank] = useState('');

  const [rendering, setRendering] = useState(false);
  const [asset, setAsset] = useState(null);
  const watchRef = useRef(null);

  useEffect(() => () => watchRef.current?.cancel(), []);

  const loadBanks = async () => {
    setLoadingBanks(true);
    try {
      const r = await base44.functions.invoke('listDiffSingerVoicebanks', {});
      const list = r.data?.data?.voicebanks || r.data?.voicebanks || [];
      setBanks(list);
      const firstUsable = list.find(b => b.renderable !== false);
      if (firstUsable) setVoicebank(v => v || firstUsable.id);
    } catch {
      // The picker renders its own empty state; without this the failure was
      // silent and looked like "this engine has no voices".
      setBanks([]);
      toast.error('Could not reach the voice engine — try refreshing the voice list.');
    } finally {
      setLoadingBanks(false);
    }
  };

  useEffect(() => { loadBanks(); }, []);

  const { notes, errors } = useMemo(() => parseMelody(melody), [melody]);
  const seconds = useMemo(() => scoreSeconds(notes, meta.bpm), [notes, meta.bpm]);

  const save = async () => {
    if (!title.trim()) { toast.error('Give your score a title'); return null; }
    setSaving(true);
    try {
      const r = await base44.functions.invoke('saveLeadSheet', {
        id: sheet?.id,
        title, ...meta,
        chord_chart: chords, lyrics, melody, score: notes,
      });
      setSheet(r.data);
      toast.success('Score saved', { icon: '📄' });
      return r.data;
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not save the score');
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Cantor renders one job at a time on CPU, so a queued render can wait behind
  // another creator's. Cadence and deadline come from the shared 'engine' polling
  // policy — asking a busy single-worker engine more often cannot speed it up.
  const poll = (jobId) => {
    watchRef.current = pollJob(
      async () => (await base44.functions.invoke('pollDiffSingerVocals', { job_id: jobId })).data || {},
      'engine',
    );
    watchRef.current.promise.then(({ outcome, data, error }) => {
      setRendering(false);
      if (outcome === 'completed') {
        setAsset(data.asset);
        toast.success('Vocal rendered', { icon: '🎤' });
      } else if (outcome === 'failed') {
        toast.error(error || 'Vocal render failed');
      } else {
        toast.error('The render is taking longer than expected — the vocal will land in your library when it finishes.');
      }
    });
  };

  const render = async () => {
    if (notes.length === 0) { toast.error('Write a melody first'); return; }
    if (!voicebank) { toast.error('Pick a voice first'); return; }

    // Always save first — the render reads the stored score, never the form.
    const saved = await save();
    if (!saved) return;

    setRendering(true);
    setAsset(null);
    try {
      const r = await base44.functions.invoke('generateVocalsDiffSinger', {
        leadSheetId: saved.id, voicebank,
      });
      // Without this guard a missing job id polled `undefined` 120 times over ten
      // minutes and then reported a timeout, hiding the real failure.
      const jobId = r.data?.job_id;
      if (!jobId) {
        setRendering(false);
        toast.error('The engine did not start a render — nothing was charged.');
        return;
      }
      toast.success('Render started — this takes a few minutes.');
      poll(jobId);
    } catch (e) {
      setRendering(false);
      toast.error(e?.response?.data?.error || 'Could not start the render');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={FileMusic} accent="emerald"
        title="Lead Sheet Studio"
        subtitle="Write the chords, lyrics and melody yourself — then have a voice sing your score."
        badge="Cantor engine" />

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Song title" className="mt-1 rounded-lg" />
            </div>
            <ScoreMetaBar meta={meta} onChange={setMeta} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5">
            <ChordChartInput value={chords} onChange={setChords} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5">
            <MelodySheetInput value={melody} onChange={setMelody}
              notes={notes} errors={errors} seconds={seconds} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5">
            <LyricSheetInput value={lyrics} onChange={setLyrics} />
          </div>
        </div>

        {/* Voice + actions */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Mic2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-black">Voice</h3>
            </div>
            <VoicebankPicker banks={banks} selected={voicebank} onSelect={setVoicebank}
              loading={loadingBanks} onRefresh={loadBanks} />
            <VoicebankUploadPanel isAdmin={user?.role === 'admin'} onInstalled={loadBanks} />
          </div>

          <Button onClick={render} disabled={rendering || notes.length === 0}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 gap-2 font-bold">
            {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic2 className="w-4 h-4" />}
            {rendering ? 'Rendering…' : 'Sing This Score'}
          </Button>
          <Button onClick={save} disabled={saving} variant="outline"
            className="w-full rounded-xl gap-2 text-xs font-bold">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Score Only
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Costs 2 credits — charged only if the render succeeds.
          </p>

          {rendering && (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <Loader2 className="w-7 h-7 mx-auto mb-3 animate-spin text-emerald-400" />
              <p className="text-sm font-bold">Singing your score…</p>
              <p className="text-xs text-muted-foreground mt-1">
                A few minutes. You can leave this page — the vocal lands in your library.
              </p>
            </div>
          )}

          {asset && <VocalResultPanel asset={asset} />}

          <BedRenderPanel chords={chords} onSaveScore={save} />

          <ScoreProvenanceCard leadSheet={sheet} />
        </div>
      </div>
    </div>
  );
}