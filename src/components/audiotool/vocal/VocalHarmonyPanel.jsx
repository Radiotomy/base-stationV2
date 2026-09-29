import { useEffect, useState } from 'react';
import useKitsJob from '@/hooks/useKitsJob';
import KitsVoicePicker from '@/components/kits/KitsVoicePicker';
import KitsQueueStatus from '@/components/kits/KitsQueueStatus';
import { Loader2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';
import SendToAudiotoolButton from '@/components/audiotool/songstarter/SendToAudiotoolButton';

const HARMONIES = [['3rd', 'Third above'], ['5th', 'Fifth above'], ['octave', 'Octave'], ['unison', 'Unison double']];
const lbl = 'flex flex-col gap-1 text-[10px] uppercase tracking-widest text-muted-foreground';
const sel = 'h-9 rounded-md border border-input bg-popover px-2 text-sm normal-case tracking-normal text-foreground';
const isVocal = (a) => a.file_url && (a.asset_type === 'harmony' || a.asset_type === 'track' || (a.asset_type === 'stem' && a.stem_type === 'vocals'));

export default function VocalHarmonyPanel() {
  const { user } = useAuth();
  const [assets, setAssets] = useState(null);
  const [sourceId, setSourceId] = useState('');
  const [type, setType] = useState('3rd');
  const [voice, setVoice] = useState(null);
  const job = useKitsJob();
  const busy = job.busy;
  const result = job.status === 'completed' ? job.asset : null;
  const setResult = () => job.reset();

  useEffect(() => {
    if (!user) return;
    base44.entities.UserAsset.filter({ user_id: user.id }, '-created_date', 100).then((list) => setAssets(list.filter(isVocal)));
  }, [user]);
  const source = assets?.find((a) => a.id === sourceId);

  const generate = () => job.start('generateHarmonies', { assetId: sourceId, harmonyType: type, voiceModelId: voice?.model_id });

  return (
    <section className="rack-unit !pt-8 space-y-4">
      <div>
        <h3 className="font-bold flex items-center gap-2"><Layers className="w-4 h-4 text-accent" /> Harmony Layers <InfoTip text={TIPS.harmonyLayers} /></h3>
        <p className="text-sm text-muted-foreground">Pick a vocal from your library, stack an AI harmony, and place either on the timeline.</p>
      </div>
      {!assets ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : !assets.length ? (
        <p className="text-sm text-muted-foreground">No vocals in your library yet — split a track in Stem Creator or record a take above.</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className={lbl}>Vocal source
              <select value={sourceId} onChange={(e) => { setSourceId(e.target.value); setResult(null); }} className={sel}>
                <option value="">Choose a vocal…</option>
                {assets.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </label>
            <label className={lbl}>Harmony
              <select value={type} onChange={(e) => setType(e.target.value)} className={sel}>
                {HARMONIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          <div className={lbl}>Harmony voice (Kits.ai)
            <KitsVoicePicker value={voice} onChange={setVoice} />
          </div>
          <KitsQueueStatus job={job} />
          <div className="flex flex-wrap gap-2">
            {source && <SendToAudiotoolButton url={source.file_url} name={source.title} aiTool={source.ai_label === 'ai_generated' ? 'library_ai_sample' : undefined} label="Place original" />}
            <Button size="sm" variant="outline" disabled={!source || busy} onClick={generate}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />} Generate harmony
            </Button>
          </div>
        </>
      )}
      {result && (
        <div className="rounded-2xl bg-secondary/50 p-3 space-y-2">
          <p className="text-sm font-semibold truncate">{result.title}</p>
          <audio src={result.file_url} controls className="w-full h-9" />
          <SendToAudiotoolButton url={result.file_url} name={result.title} aiTool="vocal_harmony" prompt={`${type} harmony`} label="Place harmony on timeline" />
        </div>
      )}
    </section>
  );
}