import { ThumbsUp, ThumbsDown, ArrowRight } from 'lucide-react';
import { signalLabel, PROPOSAL_STATUS } from '@/components/governance/governanceSignals';

export default function ProposalCard({ proposal, upCount, downCount, myVote, onVote }) {
  const status = PROPOSAL_STATUS[proposal.status] || PROPOSAL_STATUS.open;
  const votingClosed = proposal.status !== 'open';

  return (
    <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-foreground">{proposal.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {signalLabel(proposal.signal_key)} · proposed by {proposal.user_name || 'a creator'}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${status.cls}`}>
          {status.label}
        </span>
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border font-mono text-xs">
        <span className="text-muted-foreground">+{proposal.current_weight ?? 0} pts</span>
        <ArrowRight className="w-3 h-3 text-amber-400" />
        <span className="text-emerald-300 font-bold">+{proposal.proposed_weight} pts</span>
      </div>

      {proposal.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{proposal.description}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          disabled={votingClosed}
          onClick={() => onVote(proposal, 'up')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors disabled:opacity-40 ${
            myVote === 'up'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'border-border text-muted-foreground hover:text-emerald-300'
          }`}
        >
          <ThumbsUp className="w-3.5 h-3.5" /> {upCount}
        </button>
        <button
          disabled={votingClosed}
          onClick={() => onVote(proposal, 'down')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors disabled:opacity-40 ${
            myVote === 'down'
              ? 'bg-red-500/20 border-red-500/40 text-red-300'
              : 'border-border text-muted-foreground hover:text-red-300'
          }`}
        >
          <ThumbsDown className="w-3.5 h-3.5" /> {downCount}
        </button>
      </div>
    </div>
  );
}