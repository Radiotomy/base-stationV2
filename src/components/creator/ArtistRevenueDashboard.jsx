import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { DollarSign, Heart, Crown, Gem, Info } from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="p-5 rounded-2xl bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted-foreground font-semibold uppercase">{label}</span>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function ArtistRevenueDashboard({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    base44.functions.invoke("getCreatorRevenue", {})
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="text-center py-12 border border-dashed border-border rounded-2xl text-muted-foreground text-sm">
      Couldn't load revenue data — try refreshing.
    </div>
  );

  const { totals, tips, membership, collectibles } = data;

  return (
    <div className="space-y-6">
      {!data.payments_live && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/90 leading-relaxed">
            Payment intake isn't live yet, so figures below are <strong className="text-amber-100">tracked, not paid out</strong>.
            Once BASE Station's payment system goes live, this will reflect real settled earnings.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Total Tracked" value={`$${totals.total_tracked_usd.toFixed(2)}`} color="text-emerald-400" sub="Tips + memberships + sales" />
        <StatCard icon={Heart} label="Tips Received" value={`$${totals.tips_usd.toFixed(2)}`} color="text-pink-400" sub={`${tips.count} tip${tips.count === 1 ? '' : 's'}`} />
        <StatCard icon={Crown} label="Fan Club / mo" value={`$${totals.membership_monthly_usd.toFixed(2)}`} color="text-yellow-400" sub={`${membership.active_count} active member${membership.active_count === 1 ? '' : 's'}`} />
        <StatCard icon={Gem} label="Collectible Sales" value={`$${totals.collectible_sales_usd.toFixed(2)}`} color="text-purple-400" sub={`${collectibles.sales_count} sold`} />
      </div>

      {Object.keys(membership.by_tier).length > 0 && (
        <div>
          <h3 className="text-sm font-black text-foreground mb-3 uppercase tracking-wide">Members by Tier</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(membership.by_tier).map(([tier, count]) => (
              <span key={tier} className="px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/25 text-xs font-bold text-yellow-300">
                {tier} · {count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-black text-foreground mb-3 uppercase tracking-wide">Recent Tips</h3>
          {tips.recent.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-xl text-muted-foreground text-xs">No tips yet</div>
          ) : (
            <div className="space-y-2">
              {tips.recent.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{t.from_user_name || "A fan"}</p>
                    {t.message && <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{t.message}</p>}
                  </div>
                  <span className="text-sm font-black text-pink-400 flex-shrink-0">${(t.amount_cents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-black text-foreground mb-3 uppercase tracking-wide">Recent Collectible Sales</h3>
          {collectibles.recent.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-xl text-muted-foreground text-xs">No sales yet</div>
          ) : (
            <div className="space-y-2">
              {collectibles.recent.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{c.collectible_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">to {c.user_name || "a fan"}</p>
                  </div>
                  <span className="text-sm font-black text-purple-400 flex-shrink-0">${c.price_usd.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}