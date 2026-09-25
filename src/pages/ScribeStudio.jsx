import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import MyScoresList from '@/components/score/MyScoresList';
import ScoreExtractSection from '@/components/score/ScoreExtractSection';
import ScoreExtractDialog from '@/components/score/ScoreExtractDialog';

export default function ScribeStudio() {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState(null);

  const load = async () => {
    const me = await base44.auth.me();
    const rows = await base44.entities.UserAsset.filter({ user_id: me.id }, '-updated_date', 500);
    setScores(rows.filter((a) => a.metadata?.composition?.abc));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden pt-10 pb-10 px-6 bg-gradient-to-br from-blue-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-2 tracking-tight">📝 Scribe Studio</h1>
          <p className="text-white/60 text-lg">Turn any track into sheet music and MIDI. Every score is saved to your library.</p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <MyScoresList scores={scores} loading={loading} onOpen={setAsset} />
        <ScoreExtractSection onOpen={setAsset} />
      </div>
      <ScoreExtractDialog asset={asset} onClose={() => setAsset(null)} onSaved={load} />
    </div>
  );
}