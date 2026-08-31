import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Indexing runs in batches, so this keeps calling until nothing is left and
// reports progress as it goes — a single click should not leave the user
// guessing whether a long library finished.
export default function IndexLoopsBanner({ needsIndexing, onIndexed }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [left, setLeft] = useState(null);

  if (!needsIndexing && !running) return null;

  const runIndex = async () => {
    setRunning(true);
    setDone(0);
    let indexed = 0;
    let failed = 0;
    try {
      for (let pass = 0; pass < 80; pass++) {
        const res = await base44.functions.invoke('backfillLoopEmbeddings', {});
        const d = res.data || {};
        indexed += d.indexed || 0;
        failed += (d.failures || []).length;
        setDone(indexed);
        setLeft(d.remaining || 0);
        if (!d.remaining) break;
      }
      toast.success(
        `Indexed ${indexed} loop${indexed === 1 ? '' : 's'}${failed ? ` · ${failed} could not be read` : ''}`
      );
      onIndexed?.();
    } catch (e) {
      toast.error('Indexing failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setRunning(false);
      setLeft(null);
    }
  };

  return (
    <div className="merc-card rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
      <p className="text-xs text-muted-foreground">
        {running
          ? `Indexing… ${done} done${left ? `, ${left} to go` : ''}`
          : `${needsIndexing} of your loops aren't indexed yet and won't appear in results.`}
      </p>
      <Button size="sm" onClick={runIndex} disabled={running}>
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        <span className="ml-1.5">{running ? 'Indexing' : 'Index my loops'}</span>
      </Button>
    </div>
  );
}