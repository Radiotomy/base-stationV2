import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

const STATUS_META = {
  pending:     { label: 'Queued',    cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  in_progress: { label: 'Training',  cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  completed:   { label: 'Ready',     cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  failed:      { label: 'Failed',    cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  blocked:     { label: 'Blocked',   cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

export default function FinetuneCard({ finetune, isSelected, onSelect, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const meta = STATUS_META[finetune.status] || STATUS_META.pending;
  const training = finetune.status === 'pending' || finetune.status === 'in_progress';

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete sound profile "${finetune.name}"?`)) return;
    setDeleting(true);
    try {
      await base44.functions.invoke('deleteMusicFinetune', { record_id: finetune.id });
      toast.success('Sound profile deleted');
      onDeleted();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
      setDeleting(false);
    }
  };

  return (
    <button onClick={onSelect}
      className={`text-left p-4 rounded-2xl border transition-all ${
        isSelected ? 'bg-secondary border-ring shadow-lg' :
        finetune.status === 'completed' ? 'bg-card border-border hover:border-ring/50 cursor-pointer' :
        'bg-card border-border opacity-90 cursor-default'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-bold text-foreground text-sm leading-tight truncate">{finetune.name}</h4>
        <Badge className={`text-[10px] border flex-shrink-0 ${meta.cls}`}>
          {training && <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />}
          {finetune.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5 mr-1" />}
          {(finetune.status === 'failed' || finetune.status === 'blocked') && <XCircle className="w-2.5 h-2.5 mr-1" />}
          {meta.label}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground capitalize mb-1">{finetune.primary_genre} · {(finetune.source_track_titles || []).length} training tracks</p>
      {training && (
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden my-2">
          <div className="h-full bg-accent transition-all" style={{ width: `${Math.round((finetune.training_progress || 0) * 100)}%` }} />
        </div>
      )}
      {finetune.failure_reason && (
        <p className="text-xs text-red-400 mt-1">
          {finetune.failure_reason === 'copyright_violation' ? 'Rejected: copyright screening flagged a training track.' : finetune.failure_reason.replace(/_/g, ' ')}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        {finetune.status === 'completed' ? (
          <span className="text-xs font-semibold text-accent inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> {isSelected ? 'Selected' : 'Generate with this sound'}
          </span>
        ) : <span />}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={handleDelete} disabled={deleting}>
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </button>
  );
}