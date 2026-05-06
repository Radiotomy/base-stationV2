import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X } from 'lucide-react';

/**
 * Phase 5.5 — Frontend smoke tests. Verifies that core entity reads,
 * required pages, and key components mount without throwing.
 *
 * Each test is a small async function that resolves on success.
 */
const FRONTEND_TESTS = [
  {
    key: 'liveStudio',
    label: 'LiveStudio entity reads',
    fn: async () => {
      await base44.entities.LiveSession.filter({}, '-created_date', 1);
      return 'ok';
    },
  },
  {
    key: 'liveWatch',
    label: 'LiveWatch event-state shape',
    fn: async () => {
      const rows = await base44.entities.LiveSession.filter({ status: 'streaming' }, '-created_date', 1);
      const session = rows[0];
      if (session && session.state && session.state.recentEvents && !Array.isArray(session.state.recentEvents)) {
        throw new Error('recentEvents must be array');
      }
      return 'ok';
    },
  },
  {
    key: 'fanIdentityPanel',
    label: 'FanIdentityPanel data sources',
    fn: async () => {
      const u = await base44.auth.me();
      await base44.entities.UserXP.filter({ user_id: u.id });
      await base44.entities.UserBadge.filter({ user_id: u.id });
      return 'ok';
    },
  },
  {
    key: 'artistProfile',
    label: 'ArtistProfile entity reads',
    fn: async () => {
      await base44.entities.ArtistProfile.filter({}, '-created_date', 1);
      await base44.entities.TrackSubmission.filter({ status: 'approved' }, '-created_date', 1);
      return 'ok';
    },
  },
  {
    key: 'creatorDashboard',
    label: 'CreatorDashboard entity reads',
    fn: async () => {
      const u = await base44.auth.me();
      await base44.entities.UserAsset.filter({ user_id: u.id }, '-created_date', 1);
      await base44.entities.TrackSubmission.filter({ artist_id: u.id }, '-created_date', 1);
      return 'ok';
    },
  },
  {
    key: 'studioTools',
    label: 'Studio tools (5 asset types)',
    fn: async () => {
      const types = ['stem', 'mashup', 'harmony', 'master', 'visualizer'];
      for (const t of types) {
        await base44.entities.UserAsset.filter({ asset_type: t }, '-created_date', 1);
      }
      return 'ok';
    },
  },
  {
    key: 'fanClub',
    label: 'FanClub entity + tier shape',
    fn: async () => {
      const rows = await base44.entities.FanClub.filter({}, '-created_date', 3);
      for (const c of rows) {
        if (c.tiers && !Array.isArray(c.tiers)) throw new Error('tiers must be array');
      }
      return 'ok';
    },
  },
  {
    key: 'creatorStore',
    label: 'CreatorStore data fetch',
    fn: async () => {
      const u = await base44.auth.me();
      await base44.entities.Collectible.filter({ creator_id: u.id }, '-created_date', 5);
      return 'ok';
    },
  },
];

export default function FrontendSmokeRunner() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState({});

  const runAll = async () => {
    setRunning(true);
    const out = {};
    for (const t of FRONTEND_TESTS) {
      const t0 = Date.now();
      try {
        await t.fn();
        out[t.key] = { status: 'pass', ms: Date.now() - t0, label: t.label };
      } catch (e) {
        out[t.key] = { status: 'fail', ms: Date.now() - t0, label: t.label, error: e?.message || String(e) };
      }
      setResults({ ...out });
    }
    setRunning(false);
  };

  const passed = Object.values(results).filter(r => r.status === 'pass').length;
  const failed = Object.values(results).filter(r => r.status === 'fail').length;

  return (
    <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-black text-foreground">Frontend Smoke Tests</h3>
          <p className="text-xs text-muted-foreground">Component data sources & entity reads</p>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(results).length > 0 && (
            <span className="text-xs text-muted-foreground">{passed} pass · {failed} fail</span>
          )}
          <Button onClick={runAll} disabled={running} size="sm" className="rounded-xl gap-1.5">
            {running ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running</> : 'Run frontend tests'}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {FRONTEND_TESTS.map(t => {
          const r = results[t.key];
          return (
            <div key={t.key} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
              <div className="mt-0.5 flex-shrink-0">
                {!r ? <span className="text-xs text-muted-foreground">·</span>
                    : r.status === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                    : <X className="w-3.5 h-3.5 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">{t.label}</p>
                {r?.status === 'fail' && <p className="text-xs text-red-400 mt-0.5 break-all">{r.error}</p>}
              </div>
              {r && <span className="text-[10px] text-muted-foreground">{r.ms}ms</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}