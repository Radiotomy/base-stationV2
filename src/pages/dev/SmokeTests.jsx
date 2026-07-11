import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ArrowLeft, Play, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import SmokeTestResultCard from '@/components/dev/SmokeTestResultCard';
import FrontendSmokeRunner from '@/components/dev/FrontendSmokeRunner';
import MasteringPipelineSmoke from '@/components/dev/MasteringPipelineSmoke';

/**
 * Phase 5.5 — Admin-only dev page for running smoke tests.
 */
export default function SmokeTests() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setLoading(true);
    try {
      const r = await base44.functions.invoke('runSmokeTests', {});
      setResult(r.data);
      if (r.data?.ok) toast.success(`All ${r.data.summary.total} backend tests passed`);
      else toast.error(`${r.data?.summary?.failed || 0} backend tests failed`);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to run smoke tests');
      setResult({ ok: false, error: e?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 inset-x-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <Badge variant="outline" className="ml-auto">Dev / Phase 5.5</Badge>
      </div>

      <div className="pt-20 pb-12 px-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">🧪 Smoke Tests</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Stabilization suite for Phases 1–5. Read-only, non-destructive.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dev/error-log">
              <Button variant="outline" className="rounded-xl">View Error Log</Button>
            </Link>
            <Button onClick={run} disabled={loading} className="rounded-xl bg-purple-600 hover:bg-purple-500 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run backend tests
            </Button>
          </div>
        </div>

        {result && (
          <div className="rounded-2xl bg-card border border-border p-5 mb-6 flex items-center gap-4 flex-wrap">
            {result.ok
              ? <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              : <XCircle className="w-8 h-8 text-red-400" />}
            <div className="flex-1 min-w-0">
              <p className="font-black text-foreground">
                {result.ok ? 'All backend tests passed' : 'Some backend tests failed'}
              </p>
              <p className="text-xs text-muted-foreground">
                {result.summary?.passed || 0} pass · {result.summary?.failed || 0} fail · {result.summary?.total || 0} total · ran {result.ranAt && new Date(result.ranAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        )}

        {result?.groups && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {Object.entries(result.groups).map(([groupName, tests]) => (
              <SmokeTestResultCard key={groupName} groupName={groupName} tests={tests} />
            ))}
          </div>
        )}

        {!result && !loading && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground mb-8">
            Click <span className="font-semibold text-foreground">Run backend tests</span> to start.
          </div>
        )}

        <FrontendSmokeRunner />
        <div className="mt-6">
          <MasteringPipelineSmoke />
        </div>
      </div>
    </div>
  );
}