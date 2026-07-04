import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Mic2, Loader, Music } from 'lucide-react';
import { toast } from 'sonner';
import AssetPicker from '@/components/studio/AssetPicker';

const SOURCES = [
  { value: 'upload', label: '📤 Upload / Record', desc: 'MP3 or WAV, >10s, clear vocals' },
  { value: 'stem', label: '🎙️ Vocal Stem', desc: 'From Stem Creator' },
  { value: 'track', label: '🎵 Track', desc: 'From your library' },
];

export default function SonicVoiceCloner({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('upload');
  const [selectedIds, setSelectedIds] = useState([]);
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | uploading | cloning
  const fileRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => () => { cancelledRef.current = true; }, []);

  const clone = async () => {
    if (!name.trim()) { toast.error('Give the voice a name'); return; }

    // Resolve source audio URL
    let audioUrl = '';
    let sourceAssetId = '';
    try {
      if (source === 'upload') {
        if (!file) { toast.error('Choose an audio file'); return; }
        setPhase('uploading');
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        audioUrl = file_url;
      } else {
        if (!selectedIds[0]) { toast.error('Pick an asset from your library'); return; }
        setPhase('uploading');
        const asset = await base44.entities.UserAsset.get(selectedIds[0]);
        audioUrl = asset.file_url;
        sourceAssetId = asset.id;
      }

      // Submit clone task
      setPhase('cloning');
      const submitRes = await base44.functions.invoke('createSonicVoice', { audio_url: audioUrl, name });
      const taskId = submitRes.data?.task_id;
      if (!taskId) throw new Error(submitRes.data?.error || 'Could not start voice cloning');

      // Poll until persona_id is ready (up to ~3 min)
      let personaId = null;
      for (let i = 0; i < 18; i++) {
        await new Promise(r => setTimeout(r, 10000));
        if (cancelledRef.current) return;
        const pollRes = await base44.functions.invoke('createSonicVoice', { task_id: taskId, name });
        const d = pollRes.data || {};
        if (d.status === 'completed' && d.persona_id) { personaId = d.persona_id; break; }
        if (d.status === 'failed') throw new Error(d.error || 'Voice cloning failed');
      }
      if (!personaId) throw new Error('Voice cloning timed out — please try again');

      // Save the persona
      const user = await base44.auth.me();
      const persona = await base44.entities.VoicePersona.create({
        user_id: user.id,
        user_email: user.email,
        name: name.trim(),
        description: `Cloned voice (Sonic)${sourceAssetId ? ' from library asset' : ' from uploaded sample'}`,
        voice_type: 'neutral',
        provider: 'sonic',
        provider_voice_id: personaId,
        sample_url: audioUrl,
        source_asset_id: sourceAssetId || undefined,
        tags: ['sonic', 'cloned'],
      });
      toast.success('🎤 Voice cloned! Use it in Music Studio via Voice Persona.');
      onCreated(persona);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Voice cloning failed');
      setPhase('idle');
    }
  };

  const busy = phase !== 'idle';

  return (
    <div className="p-8 space-y-6">
      <div>
        <h3 className="text-2xl font-black text-foreground mb-1">Clone a Voice</h3>
        <p className="text-sm text-muted-foreground">
          Create a reusable Sonic voice from clear vocals — then generate new songs sung by that voice.
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Voice Name *</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., My Signature Voice" className="rounded-xl" disabled={busy} />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Voice Source</label>
        <div className="grid grid-cols-3 gap-2">
          {SOURCES.map(s => (
            <button key={s.value} type="button" disabled={busy}
              onClick={() => { setSource(s.value); setSelectedIds([]); }}
              className={`p-2.5 rounded-xl border text-left transition-all ${source === s.value ? 'border-pink-500 bg-pink-500/10' : 'border-border bg-card hover:border-border/80'}`}>
              <p className="text-xs font-bold text-foreground">{s.label}</p>
              <p className="text-[10px] text-muted-foreground">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {source === 'upload' ? (
        <div>
          <input ref={fileRef} type="file" accept="audio/mpeg,audio/wav,audio/mp3,.mp3,.wav" className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)} />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
            className="w-full p-6 rounded-xl border-2 border-dashed border-border hover:border-pink-500/50 transition-all text-center">
            {file ? (
              <span className="text-sm font-semibold text-foreground flex items-center justify-center gap-2"><Music className="w-4 h-4 text-pink-400" /> {file.name}</span>
            ) : (
              <span className="text-sm text-muted-foreground flex items-center justify-center gap-2"><Upload className="w-4 h-4" /> Choose MP3/WAV — a single clear voice, longer than 10 seconds</span>
            )}
          </button>
        </div>
      ) : (
        <AssetPicker assetType={source} selected={selectedIds} onChange={setSelectedIds} />
      )}

      {source === 'track' && (
        <p className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          💡 Best results come from isolated vocals. For a full track, consider extracting the vocal stem first in the Stem Creator, then use it here.
        </p>
      )}

      {busy && (
        <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center gap-3">
          <Loader className="w-5 h-5 text-pink-400 animate-spin flex-shrink-0" />
          <p className="text-xs text-pink-300">
            {phase === 'uploading' ? 'Preparing audio…' : 'Cloning voice — this takes 1–2 minutes…'}
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-border">
        <Button type="button" onClick={onCancel} variant="outline" className="flex-1 rounded-xl" disabled={busy}>Cancel</Button>
        <Button type="button" onClick={clone} disabled={busy} className="flex-1 bg-pink-600 hover:bg-pink-500 rounded-xl font-bold gap-2">
          <Mic2 className="w-4 h-4" /> {busy ? 'Cloning…' : 'Clone Voice (4 credits)'}
        </Button>
      </div>
    </div>
  );
}