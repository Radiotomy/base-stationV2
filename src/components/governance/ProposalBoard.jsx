import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ProposalCard from '@/components/governance/ProposalCard';
import NewProposalDialog from '@/components/governance/NewProposalDialog';

export default function ProposalBoard({ user }) {
  const [proposals, setProposals] = useState([]);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [p, v] = await Promise.all([
      base44.entities.CosProposal.list('-created_date', 100),
      base44.entities.CosProposalVote.list(null, 500),
    ]);
    setProposals(p || []);
    setVotes(v || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleVote = async (proposal, dir) => {
    const mine = votes.find((v) => v.proposal_id === proposal.id && v.user_id === user.id);
    if (mine && mine.vote === dir) {
      await base44.entities.CosProposalVote.delete(mine.id);
    } else if (mine) {
      await base44.entities.CosProposalVote.update(mine.id, { vote: dir });
    } else {
      await base44.entities.CosProposalVote.create({ proposal_id: proposal.id, user_id: user.id, vote: dir });
    }
    load();
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Loading the community ledger…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
          When a new tool launches or an AI company adopts an ethically licensed training model,
          the community decides its baseline value. Adopted proposals become the public consensus
          ledger behind every COS weight.
        </p>
        <NewProposalDialog user={user} onCreated={load} />
      </div>

      {proposals.length === 0 ? (
        <div className="p-8 rounded-2xl bg-card border border-dashed border-border text-center">
          <p className="text-sm font-bold text-foreground mb-1">No proposals yet</p>
          <p className="text-xs text-muted-foreground">Be the first to propose how a new tool or workflow should be weighted.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {proposals.map((p) => {
            const pv = votes.filter((v) => v.proposal_id === p.id);
            return (
              <ProposalCard
                key={p.id}
                proposal={p}
                upCount={pv.filter((v) => v.vote === 'up').length}
                downCount={pv.filter((v) => v.vote === 'down').length}
                myVote={pv.find((v) => v.user_id === user.id)?.vote}
                onVote={handleVote}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}