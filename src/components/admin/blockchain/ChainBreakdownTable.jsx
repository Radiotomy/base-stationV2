const CHAIN_LABEL = {
  base: 'Base',
  solana: 'Solana',
  streamr: 'Streamr',
  polygon: 'Polygon',
};

export default function ChainBreakdownTable({ perChain = {}, registry = {} }) {
  const rows = Object.entries(perChain);

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3">Chain</th>
            <th className="text-right px-4 py-3">Txs</th>
            <th className="text-right px-4 py-3">Success</th>
            <th className="text-right px-4 py-3">Failed</th>
            <th className="text-right px-4 py-3">Pending</th>
            <th className="text-right px-4 py-3">Gas (native)</th>
            <th className="text-right px-4 py-3">Gas (USD)</th>
            <th className="text-right px-4 py-3">Registered Tracks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([chain, stats]) => (
            <tr key={chain} className="border-t border-border">
              <td className="px-4 py-3 font-semibold text-foreground">{CHAIN_LABEL[chain] || chain}</td>
              <td className="px-4 py-3 text-right">{stats.total}</td>
              <td className="px-4 py-3 text-right text-green-400">{stats.success}</td>
              <td className="px-4 py-3 text-right text-red-400">{stats.failed}</td>
              <td className="px-4 py-3 text-right text-amber-400">{stats.pending}</td>
              <td className="px-4 py-3 text-right font-mono text-xs">{(stats.gas_native || 0).toFixed(6)}</td>
              <td className="px-4 py-3 text-right font-mono text-xs">${(stats.gas_usd || 0).toFixed(4)}</td>
              <td className="px-4 py-3 text-right">
                {chain === 'base' && registry.base
                  ? `${registry.base.registered}/${registry.base.total}`
                  : chain === 'solana' && registry.solana
                  ? `${registry.solana.registered}/${registry.solana.total}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}