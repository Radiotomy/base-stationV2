import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, AudioLines } from 'lucide-react';
import FinetuneCreateForm from './FinetuneCreateForm';
import FinetuneCard from './FinetuneCard';
import FinetuneGeneratePanel from './FinetuneGeneratePanel';
import ElevenMusicPanel from './ElevenMusicPanel';

export default function MySoundTab() {
  const [finetunes, setFinetunes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    const res = await base44.functions.invoke('getMusicFinetunes', {});
    const list = res.data?.finetunes || [];
    setFinetunes(list);
    setLoading(false);
    return list;
  }, []);

  useEffect(() => {
    load();
    return () => clearInterval(pollRef.current);
  }, [load]);

  // Poll while any finetune is still training
  useEffect(() => {
    const training = finetunes.some(f => f.status === 'pending' || f.status === 'in_progress');
    clearInterval(pollRef.current);
    if (training) pollRef.current = setInterval(load, 15000);
    return () => clearInterval(pollRef.current);
  }, [finetunes, load]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <AudioLines className="w-5 h-5" /> Eleven Music &amp; My Sound
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Generate with the Eleven Music base model, or train it on your own original tracks so new music carries your sonic identity.
          </p>
        </div>
        <Button onClick={() => setShowCreate(p => !p)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Train New Sound
        </Button>
      </div>

      <ElevenMusicPanel />

      <div className="pt-2">
        <p className="text-xs font-black text-muted-foreground uppercase">Your Trained Sounds</p>
      </div>

      {showCreate && (
        <FinetuneCreateForm
          onCreated={() => { setShowCreate(false); load(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {finetunes.length === 0 && !showCreate ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <AudioLines className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-bold mb-1">No sound profiles yet</p>
          <p className="text-sm text-muted-foreground">Train your first finetune from tracks you own to unlock style-consistent generation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {finetunes.map(ft => (
            <FinetuneCard
              key={ft.id}
              finetune={ft}
              isSelected={selected?.id === ft.id}
              onSelect={() => setSelected(ft.status === 'completed' ? ft : null)}
              onDeleted={() => { if (selected?.id === ft.id) setSelected(null); load(); }}
            />
          ))}
        </div>
      )}

      {selected && <FinetuneGeneratePanel finetune={selected} />}
    </div>
  );
}