import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

const STATUS_COLOR = {
  success: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
  pending: 'bg-amber-500/15 text-amber-400',
};

const explorerFor = (tx) => {
  if (!tx?.transaction_hash) return null;
  if (tx.blockchain === 'base') return `https://basescan.org/tx/${tx.transaction_hash}`;
  if (tx.blockchain === 'solana') return `https://solscan.io/tx/${tx.transaction_hash}`;
  if (tx.blockchain === 'polygon') return `https://polygonscan.com/tx/${tx.transaction_hash}`;
  return null;
};

export default function RecentTransactionsList({ transactions = [] }) {
  if (!transactions.length) {
    return (
      <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
        No transactions in this window.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border divide-y divide-border">
      {transactions.map((tx) => {
        const url = explorerFor(tx);
        return (
          <div key={tx.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
            <Badge className={STATUS_COLOR[tx.status] || 'bg-muted text-muted-foreground'}>{tx.status}</Badge>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">{tx.blockchain}</span>
            <span className="text-sm font-semibold text-foreground">{tx.action}</span>
            {tx.related_entity_id && (
              <span className="text-xs text-muted-foreground font-mono">{tx.related_entity}:{String(tx.related_entity_id).slice(0, 8)}…</span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {tx.created_date ? new Date(tx.created_date).toLocaleString() : '—'}
            </span>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            {tx.gas_cost_usd ? (
              <span className="text-xs font-mono text-amber-400">${Number(tx.gas_cost_usd).toFixed(4)}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}