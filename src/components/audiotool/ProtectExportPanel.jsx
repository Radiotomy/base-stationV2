import { useCallback, useState } from 'react';
import AudiotoolAudioPicker from '@/components/audiotool/AudiotoolAudioPicker';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck } from 'lucide-react';
import { protectExport } from '@/lib/audiotool/protectExport';
import AutoAnchorToggle from '@/components/blockchain/AutoAnchorToggle';

export default function ProtectExportPanel({ at, nexus, projectUrl, telemetry }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [state, setState] = useState({ loading: false, error: '', asset: null });

  const onPicked = useCallback((picked, name) => {
    setFile(picked);
    setTitle((t) => t || name);
  }, []);

  const run = async () => {
    setState({ loading: true, error: '', asset: null });
    try {
      const res = await protectExport({ file, title, projectUrl, contribution: telemetry.contribution });
      setState({ loading: false, error: '', asset: res.asset, anchoring: res.anchoring });
    } catch (e) {
      setState({ loading: false, error: e?.response?.data?.error || e.message, asset: null });
    }
  };

  return (
    <section className="rounded-2xl border border-border p-5 space-y-3">
      <div>
        <h3 className="font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Protect & Register Export</h3>
        <p className="text-sm text-muted-foreground">
          Export your mix from Audiotool (WAV is best), then drop it here. We score it with this session's ownership data,
          add the BASE Mark watermark, and anchor it on Base if you've turned on auto-anchoring.
        </p>
      </div>
      {user && <AutoAnchorToggle user={user} />}
      <AudiotoolAudioPicker at={at} nexus={nexus} onPicked={onPicked} />
      {file && <p className="text-xs text-emerald-300">Ready: {file.name}</p>}
      <Input placeholder="Track title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <p className="text-xs text-muted-foreground">Or upload a file from your computer:</p>
      <Input type="file" accept="audio/wav,audio/x-wav,audio/mpeg,audio/flac" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <Button className="merc-button" onClick={run} disabled={!file || !title.trim() || !telemetry || state.loading}>
        {state.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
        Protect & register
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.asset && (
        <div className="text-sm space-y-1">
          <p className="text-emerald-300">
            "{state.asset.title}" saved with an ownership score of {state.asset.human_participation_score}. BASE Mark watermarking has started.
          </p>
          <p className="text-xs text-muted-foreground break-all">Content Credentials hash: {state.asset.c2pa_provenance_hash}</p>
          <p className="text-xs text-muted-foreground">
            {state.anchoring ? 'Registering on Base mainnet now.' : 'Not registered on Base — turn on automatic registration above to anchor future exports.'}
          </p>
          <p className="text-muted-foreground">
            Download the protected file from your <Link to="/asset-gallery" className="underline">library</Link> once it's marked,
            and see its chain record in <Link to="/creator-dashboard?tab=proof" className="underline">Proof of Ownership</Link>.
          </p>
        </div>
      )}
    </section>
  );
}