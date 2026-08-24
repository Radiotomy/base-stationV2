import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PanelRightOpen, BookOpen, Sliders, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import InfoTip from '@/components/common/InfoTip';
import useSubStationEngine from '@/hooks/useSubStationEngine';
import TransportHeader from '@/components/substation/TransportHeader';
import TrackManager from '@/components/substation/TrackManager';
import AssetImportBrowser from '@/components/substation/AssetImportBrowser';
import ClipInspector from '@/components/substation/ClipInspector';
import TimelineStage from '@/components/substation/TimelineStage';
import SpectrumCanvas from '@/components/substation/SpectrumCanvas';
import SynthKeypad from '@/components/substation/SynthKeypad';
import InspectorDrawer from '@/components/substation/InspectorDrawer';
import ExportModal from '@/components/substation/ExportModal';
import OnboardingView from '@/components/substation/OnboardingView';
import {
  loadSession, saveSession, demoSession, emptySession,
  hasOnboarded, markOnboarded, newTrack, quantize, uid,
} from '@/lib/substation/session';
import { drainHandoff } from '@/lib/substation/handoff';
import { midiToFreq } from '@/lib/substation/engine';

export default function SubStation() {
  const { toast } = useToast();
  const [session, setSession] = useState(() => loadSession());
  const [onboarding, setOnboarding] = useState(() => !loadSession() && !hasOnboarded());
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const drained = useRef(false);

  const active = session || emptySession();
  const engineApi = useSubStationEngine(active);
  const { engine, playing, recording, setRecording, position, cpu, play, pause, stop, seek } = engineApi;

  // Persist on every change — an arrangement in progress must survive a reload
  useEffect(() => { if (session) saveSession(session); }, [session]);

  useEffect(() => {
    if (session && !selectedTrackId) setSelectedTrackId(session.tracks[0]?.id || null);
  }, [session, selectedTrackId]);

  const patch = (p) => setSession((s) => ({ ...(s || emptySession()), ...p }));
  const patchTrack = (id, p) => patch({ tracks: active.tracks.map(t => (t.id === id ? { ...t, ...p } : t)) });

  // Drain the cross-module inbox (Foundry patches, studio assets) once loaded
  useEffect(() => {
    if (!session || drained.current) return;
    drained.current = true;
    const items = drainHandoff();
    if (!items.length) return;
    setSession((s) => {
      let tracks = [...s.tracks];
      items.forEach((item, i) => {
        if (item.kind === 'patch') {
          const t = newTrack('synth', tracks.length + i);
          t.name = item.title;
          t.patch = { plugin_id: item.plugin_id, title: item.title, category: item.category };
          tracks.push(t);
        } else if (item.kind === 'asset') {
          const t = newTrack('audio', tracks.length + i);
          t.name = item.title;
          t.clips = [{ id: uid('c'), name: item.title, kind: 'audio', start: 0, length: 16, url: item.file_url, asset_id: item.asset_id, gain: 1, offset: 0 }];
          tracks.push(t);
        }
      });
      return { ...s, tracks };
    });
    toast({ title: `${items.length} item${items.length > 1 ? 's' : ''} loaded into SUB-Station` });
  }, [session, toast]);

  const selectedTrack = active.tracks.find(t => t.id === selectedTrackId) || null;
  const selectedClip = useMemo(
    () => active.tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId) || null,
    [active.tracks, selectedClipId]
  );

  const addTrack = (kind) => {
    const t = newTrack(kind, active.tracks.length);
    patch({ tracks: [...active.tracks, t] });
    setSelectedTrackId(t.id);
  };

  const moveTrack = (id, dir) => {
    const i = active.tracks.findIndex(t => t.id === id);
    const j = i + dir;
    if (j < 0 || j >= active.tracks.length) return;
    const next = [...active.tracks];
    [next[i], next[j]] = [next[j], next[i]];
    patch({ tracks: next });
  };

  const removeTrack = (id) => {
    patch({ tracks: active.tracks.filter(t => t.id !== id) });
    if (selectedTrackId === id) setSelectedTrackId(active.tracks.find(t => t.id !== id)?.id || null);
  };

  const addClip = (trackId, beat) => {
    const track = active.tracks.find(t => t.id === trackId);
    if (!track) return;
    const clip = track.kind === 'audio'
      ? { id: uid('c'), name: 'Empty Slot', kind: 'audio', start: beat, length: 4, gain: 1, offset: 0 }
      : { id: uid('c'), name: 'Note Clip', kind: 'synth', start: beat, length: 4, pitch: 220, gain: 1 };
    patchTrack(trackId, { clips: [...track.clips, clip] });
    setSelectedClipId(clip.id);
  };

  const patchClip = (p) => {
    if (!selectedClip) return;
    patch({
      tracks: active.tracks.map(t => ({
        ...t,
        clips: t.clips.map(c => (c.id === selectedClipId ? { ...c, ...p } : c)),
      })),
    });
  };

  const duplicateClip = () => {
    if (!selectedClip) return;
    const copy = { ...selectedClip, id: uid('c'), start: selectedClip.start + selectedClip.length };
    patch({
      tracks: active.tracks.map(t => (
        t.clips.some(c => c.id === selectedClipId) ? { ...t, clips: [...t.clips, copy] } : t
      )),
    });
    setSelectedClipId(copy.id);
  };

  const removeClip = () => {
    patch({ tracks: active.tracks.map(t => ({ ...t, clips: t.clips.filter(c => c.id !== selectedClipId) })) });
    setSelectedClipId(null);
  };

  const importAsset = (asset) => {
    const target = selectedTrack?.kind === 'audio'
      ? selectedTrack
      : active.tracks.find(t => t.kind === 'audio');
    const clip = {
      id: uid('c'), name: asset.title, kind: 'audio',
      start: quantize(position, active.snap), length: 16,
      url: asset.file_url, asset_id: asset.id, gain: 1, offset: 0,
    };
    if (target) {
      patchTrack(target.id, { clips: [...target.clips, clip] });
      setSelectedTrackId(target.id);
    } else {
      const t = newTrack('audio', active.tracks.length);
      t.name = asset.title;
      t.clips = [clip];
      patch({ tracks: [...active.tracks, t] });
      setSelectedTrackId(t.id);
    }
    setSelectedClipId(clip.id);
    engine.loadBuffer(asset.file_url);
    toast({ title: 'Imported to timeline', description: asset.title });
  };

  // Recording captures played notes as synth clips on the armed (or selected) track
  const onNote = (midi) => {
    if (!recording) return;
    const target = active.tracks.find(t => t.arm) || selectedTrack;
    if (!target) return;
    const clip = {
      id: uid('c'), name: `Note ${midi}`, kind: 'synth',
      start: quantize(position, active.snap), length: 1,
      pitch: Math.round(midiToFreq(midi)), gain: 1,
    };
    patchTrack(target.id, { clips: [...target.clips, clip] });
  };

  const reset = () => {
    if (!window.confirm('Clear this arrangement and start empty?')) return;
    stop();
    setSession(emptySession());
    setSelectedClipId(null);
  };

  if (onboarding) {
    return (
      <OnboardingView
        onDemo={() => { markOnboarded(); setSession(demoSession()); setOnboarding(false); }}
        onEmpty={() => { markOnboarded(); setSession(emptySession()); setOnboarding(false); }}
      />
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#09090b' }}>
      <div className="max-w-[1800px] mx-auto px-3 py-3 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Sliders className="w-4 h-4 text-[#14b8a6]" />
          <h1 className="text-lg font-display text-white">SUB-Station Studio</h1>
          <input
            value={active.name}
            onChange={(e) => patch({ name: e.target.value })}
            className="bg-transparent text-xs font-mono text-white/50 outline-none focus:text-white border-b border-transparent focus:border-white/20"
          />
          <InfoTip size="sm" side="bottom" text="A multi-track arrangement workstation. Sessions autosave to this browser; bounce a master to keep it." />
          <div className="flex-1" />
          <button onClick={reset} className="text-[10px] font-mono text-white/35 hover:text-[#fb7185] inline-flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
          <Link to="/sub-station/help" className="text-[10px] font-mono text-[#FFC98A] hover:text-white inline-flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> Guide
          </Link>
          {!drawerOpen && (
            <button onClick={() => setDrawerOpen(true)} className="text-white/45 hover:text-white">
              <PanelRightOpen className="w-4 h-4" />
            </button>
          )}
        </div>

        <TransportHeader
          session={active}
          patch={patch}
          playing={playing}
          recording={recording}
          position={position}
          cpu={cpu}
          onPlay={() => play()}
          onPause={pause}
          onStop={stop}
          onToggleRecord={() => setRecording(r => !r)}
          onExport={() => setExportOpen(true)}
        />

        <div className="flex flex-col lg:flex-row gap-2.5 items-stretch">
          {/* Left — track manager + asset inspector */}
          <div className="w-full lg:w-[272px] shrink-0 rounded-xl border border-white/10 bg-[#09090b]/80 p-2.5 space-y-4 lg:max-h-[calc(100vh-150px)] lg:overflow-y-auto">
            <TrackManager
              tracks={active.tracks}
              selectedId={selectedTrackId}
              onSelect={setSelectedTrackId}
              onAdd={addTrack}
              onPatch={patchTrack}
              onMove={moveTrack}
              onRemove={removeTrack}
            />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/45 font-mono mb-2">Clip Inspector</p>
              <ClipInspector
                clip={selectedClip}
                onPatch={patchClip}
                onDuplicate={duplicateClip}
                onRemove={removeClip}
              />
            </div>
            <AssetImportBrowser onImport={importAsset} />
          </div>

          {/* Center — timeline, visualizer, keypad */}
          <div className="flex-1 min-w-0 flex flex-col gap-2.5">
            <div className="flex-1 min-h-[300px] lg:max-h-[calc(100vh-380px)] flex">
              <TimelineStage
                session={active}
                patch={patch}
                selectedTrackId={selectedTrackId}
                onSelectTrack={setSelectedTrackId}
                selectedClipId={selectedClipId}
                onSelectClip={setSelectedClipId}
                onPatchClip={patchClip}
                onAddClip={addClip}
                position={position}
                onSeek={seek}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              <SpectrumCanvas engine={engine} height={104} />
              <SynthKeypad engine={engine} trackId={selectedTrackId} onNote={onNote} />
            </div>
          </div>

          {/* Right — inspector drawer */}
          {drawerOpen && (
            <div className="w-full lg:w-[340px] shrink-0 lg:max-h-[calc(100vh-150px)] flex">
              <div className="flex-1 min-h-0">
                <InspectorDrawer session={active} patch={patch} onClose={() => setDrawerOpen(false)} />
              </div>
            </div>
          )}
        </div>
      </div>

      <ExportModal open={exportOpen} onOpenChange={setExportOpen} engine={engine} session={active} />
    </div>
  );
}