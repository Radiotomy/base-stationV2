import { useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, XCircle, MinusCircle, Play, Users, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  createPerformerClient,
  createFanClient,
  awaitEventOnAllClients,
  assertEqual,
  assertDeepEqual,
  cleanupSession,
  FAN_PREF_KEY,
} from '@/lib/liveMulticlientHarness';

/**
 * Live Performance — Automated Multi-Client Regression Harness
 *
 * Spawns 1 performer + N fan simulators per test. Each simulator drives real
 * Base44 entity reads/writes through the same code paths LiveStudio/LiveWatch use
 * (createLiveSession, LiveSession.update for state, getLiveSessionSummary, etc.).
 * The harness records assertions and per-test timing.
 */

// ---------- Test definitions ----------

const TESTS = [
  // GROUP 1 — EVENT BUS SYNC
  {
    group: 'Event Bus Sync',
    id: '1.1',
    name: 'play event syncs to all fans',
    run: async ({ fanCount, log }) => {
      const perf = await createPerformerClient({ title: '[mc] 1.1 play' });
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      log(`perf=${perf.sessionId.slice(0, 8)} fans=${fans.length}`);
      await perf.start();
      await perf.selectTrack({ id: 't1', title: 'Test Track', file_url: '' });
      const playTs = Date.now();
      await perf.play(0);
      await awaitEventOnAllClients(fans, 'play', 1500);
      const positions = fans.map((f) => f.state.nowPlaying?.isPlaying);
      assertEqual(positions.every(Boolean), true, `all fans isPlaying=true (got ${JSON.stringify(positions)})`);
      const lag = Date.now() - playTs;
      log(`play propagation: ${lag}ms across ${fans.length} fans`);
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Event Bus Sync',
    id: '1.2',
    name: 'pause event syncs within 1500ms',
    run: async ({ fanCount, log }) => {
      const perf = await createPerformerClient({ title: '[mc] 1.2 pause' });
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      await perf.start();
      await perf.selectTrack({ id: 't1', title: 'T', file_url: '' });
      await perf.play(0);
      await awaitEventOnAllClients(fans, 'play', 1500);
      const t0 = Date.now();
      await perf.pause(5000);
      await awaitEventOnAllClients(fans, 'pause', 1500);
      log(`pause propagation: ${Date.now() - t0}ms`);
      assertEqual(
        fans.every((f) => f.state.nowPlaying?.isPlaying === false),
        true,
        'all fans isPlaying=false'
      );
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Event Bus Sync',
    id: '1.3',
    name: 'seek event updates fan position',
    run: async ({ fanCount, log }) => {
      const perf = await createPerformerClient({ title: '[mc] 1.3 seek' });
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      await perf.start();
      await perf.selectTrack({ id: 't1', title: 'T', file_url: '' });
      await perf.seek(42000);
      await awaitEventOnAllClients(fans, 'seek', 1500);
      const positions = fans.map((f) => f.state.nowPlaying?.position_ms);
      log(`positions: ${JSON.stringify(positions)}`);
      assertEqual(
        positions.every((p) => p === 42000),
        true,
        'all fans at 42000ms'
      );
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Event Bus Sync',
    id: '1.4',
    name: 'track-change syncs nowPlaying',
    run: async ({ fanCount, log }) => {
      const perf = await createPerformerClient({ title: '[mc] 1.4 track-change' });
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      await perf.start();
      await perf.selectTrack({ id: 'first', title: 'First', file_url: '' });
      await awaitEventOnAllClients(fans, 'track-change', 1500);
      await perf.selectTrack({ id: 'second', title: 'Second Track', file_url: '' });
      await awaitEventOnAllClients(fans, 'track-change', 1500);
      const titles = fans.map((f) => f.state.nowPlaying?.title);
      log(`fan titles: ${JSON.stringify(titles)}`);
      assertEqual(
        titles.every((t) => t === 'Second Track'),
        true,
        'all fans see "Second Track"'
      );
      await cleanupSession(perf.sessionId);
    },
  },

  // GROUP 2 — VISUAL LAYER SYNC
  {
    group: 'Visual Layer Sync',
    id: '2.1',
    name: 'creator enables Portals → fans see selector, default Standard',
    run: async ({ fanCount, log }) => {
      const perf = await createPerformerClient({ title: '[mc] 2.1' });
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      await perf.enablePortals('mock-room-21');
      await Promise.all(fans.map((f) => f.refresh()));
      assertEqual(
        fans.every((f) => f.derived.portalsAvailable === true),
        true,
        'all fans see portalsAvailable=true'
      );
      assertEqual(
        fans.every((f) => f.derived.fanVisualPreference === 'standard'),
        true,
        'all fans default to Standard'
      );
      log(`portalsAvailable on ${fans.length} fans, all default Standard`);
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Visual Layer Sync',
    id: '2.2',
    name: 'creator disables Portals → fans auto-revert',
    run: async ({ fanCount, log }) => {
      const perf = await createPerformerClient({ title: '[mc] 2.2' });
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      await perf.enablePortals('mock-room-22');
      await Promise.all(fans.map((f) => f.refresh()));
      fans.forEach((f) => f.setFanVisualPreference('portals'));
      await perf.disablePortals();
      await Promise.all(fans.map((f) => f.refresh()));
      const prefs = fans.map((f) => f.derived.fanVisualPreference);
      log(`prefs after disable: ${JSON.stringify(prefs)}`);
      assertEqual(prefs.every((p) => p === 'standard'), true, 'all fans reverted to Standard');
      assertEqual(
        fans.every((f) => f.derived.portalsAvailable === false),
        true,
        'portalsAvailable=false everywhere'
      );
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Visual Layer Sync',
    id: '2.3',
    name: 'fan switches to 3D',
    run: async ({ fanCount, log }) => {
      const perf = await createPerformerClient({ title: '[mc] 2.3' });
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      await perf.enablePortals('mock-room-23');
      await Promise.all(fans.map((f) => f.refresh()));
      fans.forEach((f) => f.setFanVisualPreference('portals'));
      assertEqual(
        fans.every((f) => f.derived.fanVisualPreference === 'portals'),
        true,
        'all fans now in 3D'
      );
      assertEqual(
        fans.every((f) => f.derived.shouldRenderPortalStage === true),
        true,
        'PortalStageViewer should mount on all fans'
      );
      log(`${fans.length} fans switched to 3D successfully`);
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Visual Layer Sync',
    id: '2.4',
    name: 'fan switches back to Standard',
    run: async ({ fanCount, log }) => {
      const perf = await createPerformerClient({ title: '[mc] 2.4' });
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      await perf.enablePortals('mock-room-24');
      await Promise.all(fans.map((f) => f.refresh()));
      fans.forEach((f) => f.setFanVisualPreference('portals'));
      fans.forEach((f) => f.setFanVisualPreference('standard'));
      assertEqual(
        fans.every((f) => f.derived.shouldRenderPortalStage === false),
        true,
        'PortalStageViewer unmounted'
      );
      assertEqual(
        fans.every((f) => f.derived.shouldRenderVisualizer === true),
        true,
        'Visualizer should render'
      );
      log('all fans back to Standard');
      await cleanupSession(perf.sessionId);
    },
  },

  // GROUP 3 — PORTALS LOAD FAILURE
  {
    group: 'Portals Load Failure',
    id: '3.1',
    name: 'fan Portals load failure → auto-fallback + counter',
    run: async ({ fanCount, log }) => {
      const perf = await createPerformerClient({ title: '[mc] 3.1' });
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      await perf.enablePortals('mock-room-31');
      await Promise.all(fans.map((f) => f.refresh()));
      fans.forEach((f) => f.setFanVisualPreference('portals'));
      // Simulate iframe load failure on every fan
      await Promise.all(fans.map((f) => f.simulatePortalsLoadFailure()));
      assertEqual(
        fans.every((f) => f.derived.fanVisualPreference === 'standard'),
        true,
        'all fans auto-reverted'
      );
      assertEqual(
        fans.every((f) => f.fallbackToastShown === true),
        true,
        'fallback toast fired on all fans'
      );
      const refreshed = (await base44.entities.LiveSession.filter({ id: perf.sessionId }))[0];
      const failures = refreshed.visual_layer_analytics?.portals_load_failures || 0;
      log(`failures recorded: ${failures} (expected ≥ ${fanCount})`);
      assertEqual(failures >= fanCount, true, `analytics counter = ${failures}`);
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Portals Load Failure',
    id: '3.2',
    name: 'creator enable failure → visual_layer resets to visualizer',
    run: async ({ log }) => {
      const perf = await createPerformerClient({ title: '[mc] 3.2' });
      await perf.enablePortalsWithFailure();
      const s = (await base44.entities.LiveSession.filter({ id: perf.sessionId }))[0];
      log(`after failed enable: visual_layer=${s.visual_layer}, portal_room_id=${s.portal_room_id ?? 'null'}`);
      assertEqual(s.visual_layer, 'visualizer', 'visual_layer reset');
      assertEqual(s.portal_room_id ?? null, null, 'portal_room_id null');
      assertEqual(perf.lastToast?.includes('failed') || perf.lastToast?.includes('Reverting'), true, 'creator saw fallback toast');
      await cleanupSession(perf.sessionId);
    },
  },

  // GROUP 4 — FAN MODE PERSISTENCE
  {
    group: 'Fan Mode Persistence',
    id: '4.1',
    name: 'fan preference persists across client reload (same session)',
    run: async ({ log }) => {
      const perf = await createPerformerClient({ title: '[mc] 4.1' });
      await perf.enablePortals('mock-room-41');
      const fanA = await createFanClient(0, perf.sessionId);
      fanA.setFanVisualPreference('portals');
      log(`stored pref: ${localStorage.getItem(FAN_PREF_KEY(perf.sessionId))}`);
      // simulate full reload by creating a fresh fan client for same sessionId
      const fanReloaded = await createFanClient(0, perf.sessionId);
      assertEqual(fanReloaded.derived.fanVisualPreference, 'portals', 'reload still 3D');
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Fan Mode Persistence',
    id: '4.2',
    name: 'preference resets between sessions',
    run: async ({ log }) => {
      const perfA = await createPerformerClient({ title: '[mc] 4.2a' });
      await perfA.enablePortals('mock-room-42a');
      const fanA = await createFanClient(0, perfA.sessionId);
      fanA.setFanVisualPreference('portals');
      await cleanupSession(perfA.sessionId);

      const perfB = await createPerformerClient({ title: '[mc] 4.2b' });
      await perfB.enablePortals('mock-room-42b');
      const fanB = await createFanClient(0, perfB.sessionId);
      log(`new session default: ${fanB.derived.fanVisualPreference}`);
      assertEqual(fanB.derived.fanVisualPreference, 'standard', 'new session = Standard');
      await cleanupSession(perfB.sessionId);
    },
  },

  // GROUP 5 — ANALYTICS VALIDATION
  {
    group: 'Analytics Validation',
    id: '5.1',
    name: 'summary.visual_layer_enabled_by_creator = true',
    run: async ({ log }) => {
      const perf = await createPerformerClient({ title: '[mc] 5.1' });
      await perf.enablePortals('mock-room-51');
      const r = await base44.functions.invoke('getLiveSessionSummary', { sessionId: perf.sessionId });
      log(JSON.stringify(r.data?.visual_layer_summary));
      assertEqual(r.data?.visual_layer_summary?.visual_layer_enabled_by_creator, true, 'flag is true');
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Analytics Validation',
    id: '5.2',
    name: 'fan_visual_layer_choices = {standard:2, portals:1}',
    run: async ({ log }) => {
      const perf = await createPerformerClient({ title: '[mc] 5.2' });
      await perf.enablePortals('mock-room-52');
      const fans = await Promise.all([0, 1, 2].map((i) => createFanClient(i, perf.sessionId)));
      fans[0].setFanVisualPreference('standard');
      fans[1].setFanVisualPreference('portals');
      fans[2].setFanVisualPreference('standard');
      // Each setFanVisualPreference records its choice via writeAnalytics
      const r = await base44.functions.invoke('getLiveSessionSummary', { sessionId: perf.sessionId });
      const c = r.data?.visual_layer_summary?.fan_visual_layer_choices;
      log(`choices: ${JSON.stringify(c)}`);
      assertDeepEqual(c, { standard: 2, portals: 1 }, 'choices match');
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Analytics Validation',
    id: '5.3',
    name: 'portals_load_failures = 2',
    run: async ({ log }) => {
      const perf = await createPerformerClient({ title: '[mc] 5.3' });
      await perf.enablePortals('mock-room-53');
      const fans = await Promise.all([0, 1].map((i) => createFanClient(i, perf.sessionId)));
      await fans[0].simulatePortalsLoadFailure();
      await fans[1].simulatePortalsLoadFailure();
      const r = await base44.functions.invoke('getLiveSessionSummary', { sessionId: perf.sessionId });
      log(`failures: ${r.data?.visual_layer_summary?.portals_load_failures}`);
      assertEqual(r.data?.visual_layer_summary?.portals_load_failures, 2, 'count = 2');
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Analytics Validation',
    id: '5.4',
    name: 'average_time_in_3d ≥ 30s',
    run: async ({ log }) => {
      const perf = await createPerformerClient({ title: '[mc] 5.4' });
      await perf.enablePortals('mock-room-54');
      const fan = await createFanClient(0, perf.sessionId);
      fan.setFanVisualPreference('portals');
      await fan.simulateDwellMs(30000); // writes total_time_in_3d_ms
      const r = await base44.functions.invoke('getLiveSessionSummary', { sessionId: perf.sessionId });
      const avgMs = r.data?.visual_layer_summary?.average_time_in_3d_ms;
      log(`avg: ${avgMs}ms`);
      assertEqual(avgMs >= 30000, true, `avg = ${avgMs}ms ≥ 30000`);
      await cleanupSession(perf.sessionId);
    },
  },

  // GROUP 6 — SESSION LIFECYCLE
  {
    group: 'Session Lifecycle',
    id: '6.1',
    name: 'session start → all fans join',
    run: async ({ fanCount, log }) => {
      const perf = await createPerformerClient({ title: '[mc] 6.1' });
      await perf.start();
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      await Promise.all(fans.map((f) => f.join()));
      const refreshed = (await base44.entities.LiveSession.filter({ id: perf.sessionId }))[0];
      const participants = refreshed.state?.participants || [];
      log(`participants: ${participants.length}`);
      assertEqual(participants.length >= fanCount, true, `≥${fanCount} participants joined`);
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Session Lifecycle',
    id: '6.2',
    name: 'session end → fans receive session-end',
    run: async ({ fanCount, log }) => {
      const perf = await createPerformerClient({ title: '[mc] 6.2' });
      await perf.start();
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      await perf.end();
      await awaitEventOnAllClients(fans, 'session-end', 2000);
      log(`${fans.length} fans saw session-end`);
      fans.forEach((f) => f.unmount());
      assertEqual(fans.every((f) => f.unmounted === true), true, 'all fans unmounted cleanly');
      // session is already 'completed' — skip extra cleanup
      await base44.entities.LiveSession.delete(perf.sessionId).catch(() => {});
    },
  },

  // GROUP 7 — GUARDRAILS
  {
    group: 'Guardrails',
    id: '7.1',
    name: 'no auto-create Portals on session start',
    run: async ({ log }) => {
      const perf = await createPerformerClient({ title: '[mc] 7.1' });
      await perf.start();
      const s = (await base44.entities.LiveSession.filter({ id: perf.sessionId }))[0];
      log(`visual_layer=${s.visual_layer}, portal_room_id=${s.portal_room_id ?? 'null'}`);
      assertEqual(s.visual_layer || 'visualizer', 'visualizer', 'visual_layer=visualizer');
      assertEqual(s.portal_room_id ?? null, null, 'portal_room_id=null');
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Guardrails',
    id: '7.2',
    name: 'fans never forced into 3D',
    run: async ({ fanCount }) => {
      const perf = await createPerformerClient({ title: '[mc] 7.2' });
      await perf.enablePortals('mock-room-72');
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      assertEqual(
        fans.every((f) => f.derived.fanVisualPreference === 'standard'),
        true,
        'all fans start on Standard'
      );
      await cleanupSession(perf.sessionId);
    },
  },
  {
    group: 'Guardrails',
    id: '7.3',
    name: 'works with Streamr disabled',
    run: async ({ fanCount, log }) => {
      const perf = await createPerformerClient({ title: '[mc] 7.3', audio_mode: 'sync' });
      await perf.start();
      const fans = await Promise.all(
        Array.from({ length: fanCount }, (_, i) => createFanClient(i, perf.sessionId))
      );
      await perf.selectTrack({ id: 't1', title: 'NoStreamr', file_url: '' });
      await perf.play(0);
      await awaitEventOnAllClients(fans, 'play', 1500);
      const s = (await base44.entities.LiveSession.filter({ id: perf.sessionId }))[0];
      log(`audio_mode=${s.audio_mode}, streamr_enabled=${s.streamr_enabled}`);
      assertEqual(s.audio_mode, 'sync', 'sync mode');
      assertEqual(!!s.streamr_enabled, false, 'streamr off');
      await cleanupSession(perf.sessionId);
    },
  },
];

// ---------- UI ----------

function StatusIcon({ status }) {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-rose-400" />;
  if (status === 'running') return <Loader2 className="w-4 h-4 animate-spin text-amber-400" />;
  return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
}

export default function LiveMulticlient() {
  const [fanCount, setFanCount] = useState(3);
  const [results, setResults] = useState({}); // id → { status, detail, ms, logs }
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(false);

  const groups = useMemo(() => {
    const map = {};
    TESTS.forEach((t) => {
      (map[t.group] ||= []).push(t);
    });
    return map;
  }, []);

  const updateResult = (id, patch) =>
    setResults((p) => ({ ...p, [id]: { ...(p[id] || {}), ...patch } }));

  const runOne = async (test) => {
    const logs = [];
    const log = (m) => logs.push(m);
    updateResult(test.id, { status: 'running', detail: '', logs: [], ms: 0 });
    const t0 = Date.now();
    try {
      await test.run({ fanCount: Math.max(1, Math.min(10, fanCount)), log });
      updateResult(test.id, { status: 'pass', detail: 'OK', ms: Date.now() - t0, logs });
    } catch (err) {
      updateResult(test.id, { status: 'fail', detail: err.message, ms: Date.now() - t0, logs });
    }
  };

  const runGroup = async (groupName) => {
    setBusy(true);
    cancelRef.current = false;
    for (const test of groups[groupName]) {
      if (cancelRef.current) break;
      await runOne(test);
    }
    setBusy(false);
  };

  const runAll = async () => {
    setBusy(true);
    cancelRef.current = false;
    setResults({});
    for (const test of TESTS) {
      if (cancelRef.current) break;
      await runOne(test);
    }
    setBusy(false);
  };

  const counts = Object.values(results).reduce(
    (acc, r) => {
      if (r.status === 'pass') acc.pass++;
      else if (r.status === 'fail') acc.fail++;
      return acc;
    },
    { pass: 0, fail: 0 }
  );

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
              <Users className="w-7 h-7" /> Multi-Client Regression Harness
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              1 performer + N fan simulators driving real Base44 entities. Validates the canonical
              Live Performance OS: event-driven core, sync playback, optional Portals, fan OS, analytics.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/dev/live-regression" className="text-xs text-indigo-400 hover:text-indigo-300">
              → schema suite
            </Link>
            <Link to="/live-studio" className="text-xs text-indigo-400 hover:text-indigo-300">
              → LiveStudio
            </Link>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Fans:</span>
            <Input
              type="number"
              min={1}
              max={10}
              value={fanCount}
              onChange={(e) => setFanCount(Number(e.target.value) || 1)}
              className="w-16 text-center"
              disabled={busy}
            />
          </label>
          <Button onClick={runAll} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 rounded-xl gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {busy ? 'Running…' : 'Run All Tests'}
          </Button>
          {busy && (
            <Button variant="outline" onClick={() => (cancelRef.current = true)} className="rounded-xl">
              Cancel
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-0">✓ {counts.pass}</Badge>
            <Badge className="bg-rose-500/20 text-rose-300 border-0">✗ {counts.fail}</Badge>
            <Badge variant="outline">{TESTS.length} total</Badge>
          </div>
        </div>

        {/* Groups */}
        {Object.entries(groups).map(([groupName, tests]) => (
          <div key={groupName} className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-foreground text-lg flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400" /> {groupName}
              </h2>
              <Button size="sm" variant="outline" onClick={() => runGroup(groupName)} disabled={busy} className="text-xs">
                Run Group
              </Button>
            </div>
            <div className="space-y-2">
              {tests.map((test) => {
                const r = results[test.id] || {};
                return (
                  <div key={test.id} className="p-3 rounded-xl bg-muted/30 space-y-1">
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <StatusIcon status={r.status} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{test.id}</span>
                          <span className="text-sm font-bold text-foreground">{test.name}</span>
                          {r.ms > 0 && (
                            <Badge variant="outline" className="text-[10px]">{r.ms}ms</Badge>
                          )}
                        </div>
                        {r.detail && r.status === 'fail' && (
                          <p className="text-xs mt-1 text-rose-300 font-mono">{r.detail}</p>
                        )}
                        {r.logs?.length > 0 && (
                          <details className="mt-1">
                            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                              logs ({r.logs.length})
                            </summary>
                            <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap bg-background/40 rounded p-2">
                              {r.logs.join('\n')}
                            </pre>
                          </details>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => runOne(test)} disabled={busy} className="text-xs">
                        Run
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}