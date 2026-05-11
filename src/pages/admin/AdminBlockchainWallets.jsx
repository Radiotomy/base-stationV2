import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Wallet, Activity, CheckCircle, AlertCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import WalletStatCard from '@/components/admin/blockchain/WalletStatCard';
import ChainBreakdownTable from '@/components/admin/blockchain/ChainBreakdownTable';
import RecentTransactionsList from '@/components/admin/blockchain/RecentTransactionsList';

export default function AdminBlockchainWallets() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [error, setError] = useState(null);

  const load = async (windowDays = days) => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getBlockchainWalletStats', null, {
        method: 'GET',
        params: { days: windowDays },
      });
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(days); /* eslint-disable-next-line */ }, [days]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
          <div>
            <Badge className="mb-2 bg-blue-500/15 text-blue-300 border-blue-500/30 text-xs tracking-widest uppercase">
              Admin · Phase 2
            </Badge>
            <h1 className="text-3xl md:text-4xl font-black text-foreground">Blockchain Wallets</h1>
            <p className="text-sm text-muted-foreground mt-1">Cross-chain wallet balances, gas spend, and on-chain activity.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32 rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => load()} variant="outline" className="rounded-lg gap-2" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {loading && !data ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : data ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <WalletStatCard icon={Activity} label="Total Transactions" value={data.totals.transactions} accent="text-blue-400" />
              <WalletStatCard icon={CheckCircle} label="Successful" value={data.totals.success} accent="text-green-400" />
              <WalletStatCard icon={AlertCircle} label="Failed" value={data.totals.failed} accent="text-red-400" />
              <WalletStatCard icon={Clock} label="Total Gas (USD)" value={`$${(data.totals.gas_usd || 0).toFixed(4)}`} accent="text-amber-400" />
            </div>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-400" /> Platform Wallets
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(data.wallets).map(([chain, addr]) => (
                  <div key={chain} className="p-4 rounded-xl bg-card border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">{chain}</span>
                      <Badge className={addr ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'}>
                        {addr ? 'configured' : 'not set'}
                      </Badge>
                    </div>
                    <p className="text-sm font-mono text-foreground break-all">{addr || '— set env var to display —'}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Set <code>BASE_PLATFORM_WALLET_ADDRESS</code>, <code>SOLANA_PLATFORM_WALLET_ADDRESS</code>, <code>POLYGON_PLATFORM_WALLET_ADDRESS</code>, <code>STREAMR_PLATFORM_WALLET_ADDRESS</code> in secrets. Private keys are never displayed.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Per-Chain Breakdown</h2>
              <ChainBreakdownTable perChain={data.perChain} registry={data.registry} />
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">Recent Transactions</h2>
              <RecentTransactionsList transactions={data.recent} />
            </section>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}