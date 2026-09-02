import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { pollJob } from '@/lib/polling/pollJob';

/**
 * Bring your own DiffSinger voicebank (OpenUtau format, zipped).
 *
 * The engine validates the bank — binds its ONNX inputs and sings a short test
 * phrase — before it becomes pickable, so a broken bank comes back as a clear
 * error rather than as a voice that produces garbage. Admins can install a bank
 * as a platform default visible to everyone.
 */
export default function VoicebankUploadPanel({ isAdmin, onInstalled }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [asPlatform, setAsPlatform] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const watchRef = useRef(null);
  useEffect(() => () => watchRef.current?.cancel(), []);

  const submit = async () => {
    if (!name.trim()) { toast.error('Name the voicebank'); return; }
    if (!file && !url.trim()) { toast.error('Choose a .zip or paste a download link'); return; }
    setBusy(true);
    try {
      let zipUrl = url.trim();
      if (file) {
        setStage('Uploading archive…');
        const up = await base44.integrations.Core.UploadFile({ file });
        zipUrl = up.file_url;
      }
      setStage('Handing to the engine…');
      const r = await base44.functions.invoke('ingestDiffSingerVoicebank', {
        zip_url: zipUrl, name: name.trim(), is_platform: isAdmin && asPlatform,
      });
      const id = r.data?.voicebank_id;
      watchRef.current = pollJob(async () => {
        const s = (await base44.functions.invoke('pollVoicebankInstall', { voicebank_id: id })).data || {};
        setStage(s.stage ? `Engine: ${s.stage}` : 'Validating…');
        return { ...s, status: s.status === 'installed' ? 'completed' : s.status };
      }, 'engine');
      const { outcome, data, error } = await watchRef.current.promise;
      if (outcome === 'completed') {
        toast.success(`"${data.voicebank?.name || name}" is ready to sing`, { icon: '🎤' });
        setName(''); setUrl(''); setFile(null);
        onInstalled?.();
      } else if (outcome === 'failed') {
        toast.error(error || 'The engine rejected this voicebank');
      } else {
        toast.error('Install is still running — refresh the voice list in a few minutes.');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Could not start the install');
    } finally {
      setBusy(false); setStage('');
    }
  };

  return (
    <div className="space-y-2 pt-3 border-t border-border">
      <p className="text-[11px] font-bold text-muted-foreground">Add your own voice</p>
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Voicebank name" className="rounded-lg h-8 text-xs" />
      <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://… direct link to the .zip" className="rounded-lg h-8 text-xs" />
      <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
        <Link2 className="w-3 h-3" /> or
        <input type="file" accept=".zip" onChange={e => setFile(e.target.files?.[0] || null)} className="text-[11px]" />
      </label>
      {isAdmin && (
        <label className="flex items-center gap-2 text-[11px] cursor-pointer">
          <input type="checkbox" checked={asPlatform} onChange={e => setAsPlatform(e.target.checked)} />
          Install as a platform default (visible to everyone)
        </label>
      )}
      <Button size="sm" onClick={submit} disabled={busy} variant="outline" className="w-full rounded-lg gap-1.5 text-xs">
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
        {busy ? (stage || 'Installing…') : 'Install voicebank'}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        OpenUtau DiffSinger format: dsconfig.yaml, acoustic.onnx, phonemes, dictionary and a LICENSE. The engine test-sings it before it appears here.
      </p>
    </div>
  );
}