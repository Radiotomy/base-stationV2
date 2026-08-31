import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, Sliders, Mic2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendAssetToSubStation } from '@/lib/substation/handoff';

/** The finished vocal, plus the two things a creator does next with it. */
export default function VocalResultPanel({ asset }) {
  const navigate = useNavigate();

  const toSubStation = () => {
    sendAssetToSubStation(asset);
    navigate('/sub-station');
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-black">Vocal Rendered</h3>
      </div>

      <audio src={asset.file_url} controls className="w-full" />

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="p-2 rounded-lg bg-muted/40">
          <p className="text-muted-foreground">Voice</p>
          <p className="font-bold truncate">{asset.metadata?.voicebank || '—'}</p>
        </div>
        <div className="p-2 rounded-lg bg-muted/40">
          <p className="text-muted-foreground">Ownership score</p>
          <p className="font-bold">{asset.human_participation_score ?? '—'}</p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
        <Mic2 className="w-3 h-3 shrink-0 mt-px" />
        Labelled AI-assisted: you composed the melody and lyrics, a synthetic voice
        performed them.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild className="rounded-xl gap-2 text-xs font-bold">
          <a href={asset.file_url} download>
            <Download className="w-3.5 h-3.5" /> Download WAV
          </a>
        </Button>
        <Button variant="outline" onClick={toSubStation} className="rounded-xl gap-2 text-xs font-bold">
          <Sliders className="w-3.5 h-3.5" /> Send to SUB-Station
        </Button>
      </div>
    </div>
  );
}