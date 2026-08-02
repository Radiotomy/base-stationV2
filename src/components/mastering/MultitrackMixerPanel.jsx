import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Upload, Loader2, Volume2, Trash2, Play, Pause, Save, Layers, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import MixdownButton from './MixdownButton';

/**
 * MultitrackMixerPanel
 * Load multiple stems/tracks, adjust per-track volume/pan/mute/solo,
 * sync-play them, and save the mixer state to the library.
 *
 * The mixdown is rendered client-side using Web Audio API channels
 * so users get instant feedback. Final export captures the live mix
 * via OfflineAudioContext (best-effort) or stores the recipe for later.
 */
export default function MultitrackMixerPanel() {
  const [tracks, setTracks] = useState([]); // [{ id, name, url, volume, pan, muted, solo }]
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRefs = useRef({}); // { trackId: HTMLAudioElement }

  const addTrackFromUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const r = await base44.integrations.Core.UploadFile({ file });
      const newTrack = {
        id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        url: r.file_url,
        volume: 80,
        pan: 0,
        muted: false,
        solo: false,
      };
      setTracks(prev => [...prev, newTrack]);
      toast.success(`Added "${newTrack.name}"`);
    } catch (err) { toast.error(err.message); }
    setUploading(false);
    e.target.value = '';
  };

  const loadFromLibrary = async () => {
    try {
      const user = await base44.auth.me();
      const assets = await base44.entities.UserAsset.filter({ user_id: user.id, asset_type: 'track' }, '-created_date', 10);
      if (!assets.length) return toast.error('No tracks in your library yet');
      // Take the most recent track
      const a = assets[0];
      setTracks(prev => [...prev, {
        id: `t_${Date.now()}`,
        name: a.title,
        url: a.file_url,
        volume: 80, pan: 0, muted: false, solo: false,
      }]);
      toast.success(`Added "${a.title}" from library`);
    } catch (err) { toast.error(err.message); }
  };

  const updateTrack = (id, key, value) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, [key]: value } : t));
  };

  const removeTrack = (id) => {
    if (audioRefs.current[id]) {
      audioRefs.current[id].pause();
      delete audioRefs.current[id];
    }
    setTracks(prev => prev.filter(t => t.id !== id));
  };

  // Apply mixer state (volume, mute, solo) to playing audio elements
  useEffect(() => {
    const anySolo = tracks.some(t => t.solo);
    tracks.forEach(t => {
      const el = audioRefs.current[t.id];
      if (!el) return;
      const effectiveMute = t.muted || (anySolo && !t.solo);
      el.volume = effectiveMute ? 0 : Math.max(0, Math.min(1, t.volume / 100));
    });
  }, [tracks]);

  const playAll = async () => {
    if (tracks.length === 0) return toast.error('Add at least one track');
    try {
      // Restart all to 0 and play simultaneously
      const els = tracks.map(t => audioRefs.current[t.id]).filter(Boolean);
      els.forEach(el => { el.currentTime = 0; });
      await Promise.all(els.map(el => el.play()));
      setPlaying(true);
    } catch (err) { toast.error('Playback failed: ' + err.message); }
  };

  const pauseAll = () => {
    Object.values(audioRefs.current).forEach(el => el.pause());
    setPlaying(false);
  };

  const saveMixState = async () => {
    if (!tracks.length) return;
    try {
      const user = await base44.auth.me();
      // Save mix recipe — final mixdown rendering can be triggered server-side later
      await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'project',
        title: `Multitrack Mix — ${new Date().toLocaleDateString()}`,
        file_url: tracks[0]?.url || '',
        is_public: false,
        metadata: {
          mix_type: 'multitrack',
          tracks: tracks.map(t => ({
            name: t.name, url: t.url, volume: t.volume, pan: t.pan, muted: t.muted, solo: t.solo,
          })),
        },
      });
      toast.success('Mix recipe saved to library!');
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <label className={`cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          <input type="file" accept="audio/*" onChange={addTrackFromUpload} className="hidden" />
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Track
          </div>
        </label>
        <Button onClick={loadFromLibrary} variant="outline" className="rounded-xl gap-2">
          <Upload className="w-4 h-4" /> From Library
        </Button>
        <div className="flex-1" />
        <Button onClick={playing ? pauseAll : playAll} disabled={tracks.length === 0}
          className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-500">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {playing ? 'Pause All' : 'Play All'}
        </Button>
        <Button onClick={saveMixState} disabled={tracks.length === 0} variant="outline" className="rounded-xl gap-2">
          <Save className="w-4 h-4" /> Save Mix
        </Button>
        <MixdownButton tracks={tracks} />
      </div>

      {/* Mixer */}
      {tracks.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-border p-16 flex flex-col items-center justify-center min-h-80">
          <Layers className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
          <p className="text-muted-foreground font-medium">Add tracks to start mixing</p>
          <p className="text-xs text-muted-foreground mt-1">Upload stems, vocals, instrumentals — mix them down</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-5 overflow-x-auto">
          <div className="flex gap-3 min-w-max">
            {tracks.map((track, i) => {
              const anySolo = tracks.some(t => t.solo);
              const effectiveMute = track.muted || (anySolo && !track.solo);
              return (
                <div key={track.id} className={`w-40 p-3 bg-muted/30 rounded-xl space-y-3 border ${effectiveMute ? 'border-border opacity-60' : 'border-blue-500/30'}`}>
                  {/* Header */}
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs px-1.5">{i + 1}</Badge>
                    <Input value={track.name} onChange={e => updateTrack(track.id, 'name', e.target.value)}
                      className="rounded-lg text-xs h-7 flex-1" />
                    <Button size="icon" variant="ghost" onClick={() => removeTrack(track.id)}
                      className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Audio element (hidden, controlled by mixer) */}
                  <audio
                    ref={el => { if (el) audioRefs.current[track.id] = el; }}
                    src={track.url}
                    onEnded={() => setPlaying(false)}
                  />

                  {/* Volume */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold">Vol</span>
                      <span className="font-mono">{track.volume}</span>
                    </div>
                    <Slider value={[track.volume]} onValueChange={([v]) => updateTrack(track.id, 'volume', v)}
                      min={0} max={100} step={1} />
                  </div>

                  {/* Pan */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold">Pan</span>
                      <span className="font-mono">{track.pan > 0 ? `R${track.pan}` : track.pan < 0 ? `L${Math.abs(track.pan)}` : 'C'}</span>
                    </div>
                    <Slider value={[track.pan]} onValueChange={([v]) => updateTrack(track.id, 'pan', v)}
                      min={-100} max={100} step={1} />
                  </div>

                  {/* Mute / Solo */}
                  <div className="flex gap-1">
                    <Button size="sm" variant={track.muted ? 'default' : 'outline'}
                      onClick={() => updateTrack(track.id, 'muted', !track.muted)}
                      className={`flex-1 rounded-lg text-xs h-7 ${track.muted ? 'bg-destructive hover:bg-destructive/90' : ''}`}>
                      <Volume2 className="w-3 h-3" /> M
                    </Button>
                    <Button size="sm" variant={track.solo ? 'default' : 'outline'}
                      onClick={() => updateTrack(track.id, 'solo', !track.solo)}
                      className={`flex-1 rounded-lg text-xs h-7 ${track.solo ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : ''}`}>
                      S
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-muted/20 rounded-xl p-3 flex items-start gap-2">
        <Scissors className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <p>
          Tip: import stems from the Audio Remix Studio tab, then drop them here for full multitrack mixdown control.
          "Save Mix" stores the recipe; "Mix Down &amp; Mark" renders a real WAV master and BASE Marks it —
          that's the file worth protecting, not the individual loops.
        </p>
      </div>
    </div>
  );
}