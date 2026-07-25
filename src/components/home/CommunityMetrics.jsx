import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Music, Users, Zap, Loader } from 'lucide-react';
import { useEntityList } from '@/hooks/useHomeEntityLists';

// Data comes from the shared react-query cache (same fetch HomeStatsStrip
// uses) — no duplicate requests and no 30-second polling loop re-downloading
// thousands of records and churning memory.
export default function CommunityMetrics() {
  const tracksQ = useEntityList('TrackSubmission');
  const creatorsQ = useEntityList('UserXP');
  const loading = tracksQ.isLoading || creatorsQ.isLoading;

  const metrics = useMemo(() => {
    if (!tracksQ.data || !creatorsQ.data) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return {
      tracksToday: tracksQ.data.filter(t => new Date(t.created_date) >= today).length,
      newUsersThisWeek: creatorsQ.data.filter(u => new Date(u.created_date) >= weekAgo).length,
      totalCreators: creatorsQ.data.length,
    };
  }, [tracksQ.data, creatorsQ.data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="w-5 h-5 animate-spin text-orange-400" />
      </div>
    );
  }

  if (!metrics) return null;

  const statCards = [
    {
      icon: Music,
      label: 'Tracks Submitted Today',
      value: metrics.tracksToday,
      color: 'text-amber-400',
      bg: 'from-amber-600/10 to-orange-600/10',
    },
    {
      icon: Users,
      label: 'New Creators This Week',
      value: metrics.newUsersThisWeek,
      color: 'text-orange-400',
      bg: 'from-orange-600/10 to-red-600/10',
    },
    {
      icon: Zap,
      label: 'Total Creators',
      value: metrics.totalCreators,
      color: 'text-yellow-400',
      bg: 'from-yellow-600/10 to-orange-600/10',
    },
    // 'Tracks On-Chain' stat hidden for now — restore when blockchain features return:
    // {
    //   icon: Globe,
    //   label: 'Tracks On-Chain',
    //   value: metrics?.registeredOnChain || 0,
    //   color: 'text-amber-300',
    //   bg: 'from-orange-600/10 to-amber-600/10',
    // },
  ];

  return (
    <div className="space-y-3">
      {/* Green LCD readout chips — compact community pulse */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-lg border border-black/80 bg-gradient-to-b from-[#26201A] to-[#14100C] p-2 flex items-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
          >
            <div
              className="flex-1 rounded-md border border-black/60 px-3 py-2 min-w-0"
              style={{
                background: "linear-gradient(180deg, #C8EF92 0%, #A9DC66 100%)",
                boxShadow: "inset 0 2px 10px rgba(30,58,14,0.35)",
              }}
            >
              <p className="text-xl sm:text-2xl font-black text-[#1F3A0E] leading-none">{stat.value.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-[#2E4A16]/80 mt-1 leading-tight truncate">{stat.label}</p>
            </div>
            <span
              className="w-7 h-7 rounded-full flex-shrink-0 border border-black/70 flex items-center justify-center"
              style={{
                background: "radial-gradient(circle at 35% 30%, #FFC98A 0%, #FF9A4D 45%, #B05018 100%)",
                boxShadow: "inset 0 1px 2px rgba(255,255,255,0.5)",
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-black shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]" />
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}