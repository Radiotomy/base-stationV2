import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, RefreshCw } from 'lucide-react';
import AbcScoreView from '@/components/score/AbcScoreView';
import ScoreFootprintChips from '@/components/score/ScoreFootprintChips';
import downloadBase64Midi from '@/lib/music/downloadBase64Midi';

const EMPTY = { loading: false, error: '', abc: '', midi: null, composition: null };

export default function ScoreExtractDialog({ asset, onClose }) {
  const [s, setS] = useState(EMPTY);

  const run = async () => {
    setS((p) => ({ ...p, loading: true, error: '' }));
    try {
      const { data } = await base44.functions.invoke('transcribeScore', { asset_id: asset.id });
      setS({ loading: false, error: data.abc_error || '', abc: data.abc, midi: data.midi, composition: data.composition });
    } catch (e) {
      setS((p) => ({ ...p, loading: false, error: e?.response?.data?.error || e.message }));
    }
  };

  useEffect(() => {
    if (!asset) return;
    const saved = asset.metadata?.composition;
    if (saved?.abc) setS({ ...EMPTY, abc: saved.abc, composition: saved });
    else { setS(EMPTY); run(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id]);

  return (
    <Dialog open={!!asset} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Score — {asset?.title}</DialogTitle></DialogHeader>
        {s.loading && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            Transcribing melody, chords and structure… this usually takes a minute or two.
          </div>
        )}
        {s.error && <p className="text-sm text-destructive">{s.error}</p>}
        {!s.loading && (
          <div className="space-y-4">
            <ScoreFootprintChips composition={s.composition} />
            <AbcScoreView abc={s.abc} />
            <div className="flex flex-wrap gap-2">
              <Button disabled={!s.midi} onClick={() => downloadBase64Midi(s.midi, asset?.title)}>
                <Download className="w-4 h-4 mr-2" /> Download MIDI
              </Button>
              <Button variant="outline" onClick={run}><RefreshCw className="w-4 h-4 mr-2" /> Re-extract</Button>
            </div>
            {s.abc && !s.midi && <p className="text-xs text-muted-foreground">Showing your saved score. Re-extract to download the MIDI.</p>}
            <p className="text-[11px] text-muted-foreground">
              Transcribed by Scribe, a BASE Engine. Section letters (A, B, C…) mark repeated material. The melody is most accurate on a vocal or lead stem.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}