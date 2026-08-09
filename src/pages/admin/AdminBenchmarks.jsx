import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { FlaskConical } from 'lucide-react';
import BenchmarkStatStrip from '@/components/admin/benchmarks/BenchmarkStatStrip';
import NullCorpusPanel from '@/components/admin/benchmarks/NullCorpusPanel';
import RobustnessPanel from '@/components/admin/benchmarks/RobustnessPanel';
import RunsTable from '@/components/admin/benchmarks/RunsTable';
import NullScanForm from '@/components/admin/benchmarks/NullScanForm';
import AttackGridForm from '@/components/admin/benchmarks/AttackGridForm';
import JobMonitor from '@/components/admin/benchmarks/JobMonitor';
import BackfillPanel from '@/components/admin/benchmarks/BackfillPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const LAYERS = ['speed', 'spectral', 'neural', 'drift'];

export default function AdminBenchmarks() {
  const [rows, setRows] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    base44.entities.BaseMarkBenchmark.list('-created_date', 2000).then(setRows);
  }, [refreshKey]);

  if (!rows) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin" />
      </div>
    );
  }

  const nullRows = rows.filter((r) => r.attack === 'null_unmarked');
  const marked = rows.filter((r) => r.attack !== 'null_unmarked');
  const trials = marked.reduce((s, r) => s + (r.trials || 1), 0);
  const survived = marked.reduce((s, r) => s + (r.survived || 0), 0);

  const stats = {
    total: rows.length,
    nullScans: nullRows.length,
    falsePositives: rows.filter((r) => r.false_positive).length,
    recoveryPct: trials ? Math.round((survived / trials) * 100) : 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-[#FF9A4D]" /> BASE Mark Benchmarks
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live view of every measurement recorded by the benchmark harnesses. Read straight off the stored
          rows — nothing here is hand-entered, so it moves the moment a run lands.
        </p>
      </div>

      <BenchmarkStatStrip stats={stats} />

      <Tabs defaultValue="null">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="run">Run tests</TabsTrigger>
          <TabsTrigger value="null">False positives</TabsTrigger>
          <TabsTrigger value="robustness">Robustness</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="run" className="mt-4 space-y-4">
          <div className="grid lg:grid-cols-2 gap-3">
            <NullScanForm onStarted={() => setRefreshKey((k) => k + 1)} />
            <AttackGridForm onStarted={() => setRefreshKey((k) => k + 1)} />
          </div>
          <BackfillPanel />
          <div>
            <p className="font-bold text-foreground text-sm mb-2">In-flight runs</p>
            <JobMonitor refreshKey={refreshKey} onRecorded={() => setRefreshKey((k) => k + 1)} />
          </div>
        </TabsContent>

        <TabsContent value="null" className="mt-4">
          <NullCorpusPanel rows={rows} />
        </TabsContent>

        <TabsContent value="robustness" className="mt-4 space-y-3">
          {LAYERS.map((l) => (
            <RobustnessPanel key={l} rows={rows} layer={l} />
          ))}
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <RunsTable rows={rows} />
        </TabsContent>
      </Tabs>
    </div>
  );
}