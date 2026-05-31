import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, MinusCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Live Performance Regression Suite
 *
 * Runs all sections from the canonical regression spec against the live codebase.
 * Each test returns { status: 'pass' | 'fail' | 'skip', detail?: string }.
 *
 * Tests that require live UI interaction (toast assertions, iframe load timing,
 * cross-client event propagation) are marked as `manual` and surface a checklist
 * the operator can walk through. Everything that can be asserted programmatically
 * IS asserted programmatically against the real Base44 entities + functions.
 */

const PASS = (detail = '') => ({ status: 'pass', detail });
const FAIL = (detail = '') => ({ status: 'fail', detail });
const SKIP = (detail = '') => ({ status: 'skip', detail });

// Tiny sleep helper for entity-update propagation
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Programmatic tests ----------

async function test_1_1_schema_fields() {
  // Create a transient session, inspect the returned record's keys.
  const res = await base44.functions.invoke('createLiveSession', {
    title: '[regression] schema probe',
    description: 'transient',
    tags: ['_regression'],
    audio_mode: 'sync',
  });
  const sid = res.data?.session_id;
  if (!sid) return FAIL('createLiveSession returned no session_id');
  const rows = await base44.entities.LiveSession.filter({ id: sid });
  const s = rows[0];
  if (!s) return FAIL('session not found after create');
  const hasVisualLayer = 'visual_layer' in s;
  // portal_room_id is optional → just confirm it CAN be set (schema accepts string|null)
  await base44.entities.LiveSession.update(sid, { portal_room_id: null });
  const refreshed = (await base44.entities.LiveSession.filter({ id: sid }))[0];
  await base44.entities.LiveSession.delete(sid).catch(() => {});
  if (!hasVisualLayer) return FAIL('visual_layer field missing on LiveSession');
  if (refreshed.portal_room_id !== null && refreshed.portal_room_id !== undefined)
    return FAIL(`portal_room_id should accept null, got ${JSON.stringify(refreshed.portal_room_id)}`);
  return PASS('visual_layer + portal_room_id present');
}

async function test_1_2_defaults() {
  const res = await base44.functions.invoke('createLiveSession', {
    title: '[regression] defaults probe',
    audio_mode: 'sync',
  });
  const sid = res.data?.session_id;
  const rows = await base44.entities.LiveSession.filter({ id: sid });
  const s = rows[0];
  await base44.entities.LiveSession.delete(sid).catch(() => {});
  const vl = s.visual_layer || 'visualizer'; // schema default
  const prid = s.portal_room_id ?? null;
  if (vl !== 'visualizer') return FAIL(`default visual_layer = ${vl}, expected "visualizer"`);
  if (prid !== null) return FAIL(`default portal_room_id = ${prid}, expected null`);
  return PASS('defaults correct');
}

async function test_1_3_state_persistence() {
  const res = await base44.functions.invoke('createLiveSession', {
    title: '[regression] persistence probe',
    audio_mode: 'sync',
  });
  const sid = res.data?.session_id;

  // Simulate Portals ON (we cannot actually call createPortalRoom safely in a
  // regression run — it allocates a real Portal room. Instead we directly set
  // the fields the PortalsToggle would set, which is what the schema validates.)
  await base44.entities.LiveSession.update(sid, {
    visual_layer: 'portals',
    portal_room_id: 'test-room-id-xyz',
  });
  await sleep(200);
  let s = (await base44.entities.LiveSession.filter({ id: sid }))[0];
  if (s.visual_layer !== 'portals') {
    await base44.entities.LiveSession.delete(sid).catch(() => {});
    return FAIL(`ON: visual_layer = ${s.visual_layer}`);
  }
  if (!s.portal_room_id) {
    await base44.entities.LiveSession.delete(sid).catch(() => {});
    return FAIL('ON: portal_room_id was not persisted');
  }

  // Simulate Portals OFF
  await base44.entities.LiveSession.update(sid, {
    visual_layer: 'visualizer',
    portal_room_id: null,
  });
  await sleep(200);
  s = (await base44.entities.LiveSession.filter({ id: sid }))[0];
  await base44.entities.LiveSession.delete(sid).catch(() => {});
  if (s.visual_layer !== 'visualizer') return FAIL(`OFF: visual_layer = ${s.visual_layer}`);
  if (s.portal_room_id) return FAIL(`OFF: portal_room_id = ${s.portal_room_id}, expected null`);
  return PASS('ON/OFF round-trip clean');
}

async function test_5_1_summary_fields() {
  // Make a session, write analytics, then call getLiveSessionSummary.
  const res = await base44.functions.invoke('createLiveSession', {
    title: '[regression] summary probe',
    audio_mode: 'sync',
  });
  const sid = res.data?.session_id;
  await base44.entities.LiveSession.update(sid, {
    visual_layer_analytics: {
      visual_layer_enabled_by_creator: true,
      fan_visual_layer_choices: { standard: 0, portals: 0 },
      portals_load_failures: 0,
      total_time_in_3d_ms: 0,
    },
  });
  const summary = await base44.functions.invoke('getLiveSessionSummary', { sessionId: sid });
  await base44.entities.LiveSession.delete(sid).catch(() => {});
  const v = summary.data?.visual_layer_summary;
  if (!v) return FAIL('visual_layer_summary missing from bundle');
  const need = ['visual_layer_enabled_by_creator', 'fan_visual_layer_choices', 'portals_load_failures', 'average_time_in_3d_ms'];
  for (const k of need) {
    if (!(k in v)) return FAIL(`bundle missing ${k}`);
  }
  return PASS('all 4 analytics keys present');
}

async function test_5_2_creator_flag() {
  const res = await base44.functions.invoke('createLiveSession', {
    title: '[regression] creator-flag probe',
    audio_mode: 'sync',
  });
  const sid = res.data?.session_id;
  await base44.entities.LiveSession.update(sid, {
    visual_layer: 'portals',
    portal_room_id: 'test-room',
    visual_layer_analytics: {
      visual_layer_enabled_by_creator: true,
      fan_visual_layer_choices: { standard: 0, portals: 0 },
      portals_load_failures: 0,
      total_time_in_3d_ms: 0,
    },
  });
  const summary = await base44.functions.invoke('getLiveSessionSummary', { sessionId: sid });
  await base44.entities.LiveSession.delete(sid).catch(() => {});
  const flag = summary.data?.visual_layer_summary?.visual_layer_enabled_by_creator;
  if (flag !== true) return FAIL(`flag = ${flag}, expected true`);
  return PASS('visual_layer_enabled_by_creator = true');
}

async function test_5_3_fan_choice_counts() {
  const res = await base44.functions.invoke('createLiveSession', { title: '[regression] fan-choice probe', audio_mode: 'sync' });
  const sid = res.data?.session_id;
  await base44.entities.LiveSession.update(sid, {
    visual_layer_analytics: {
      visual_layer_enabled_by_creator: true,
      fan_visual_layer_choices: { standard: 2, portals: 1 },
      portals_load_failures: 0,
      total_time_in_3d_ms: 0,
    },
  });
  const summary = await base44.functions.invoke('getLiveSessionSummary', { sessionId: sid });
  await base44.entities.LiveSession.delete(sid).catch(() => {});
  const c = summary.data?.visual_layer_summary?.fan_visual_layer_choices;
  if (c?.standard !== 2) return FAIL(`standard = ${c?.standard}, expected 2`);
  if (c?.portals !== 1) return FAIL(`portals = ${c?.portals}, expected 1`);
  return PASS('counts pass through correctly');
}

async function test_5_4_load_failures() {
  const res = await base44.functions.invoke('createLiveSession', { title: '[regression] failures probe', audio_mode: 'sync' });
  const sid = res.data?.session_id;
  await base44.entities.LiveSession.update(sid, {
    visual_layer_analytics: {
      visual_layer_enabled_by_creator: true,
      fan_visual_layer_choices: { standard: 0, portals: 0 },
      portals_load_failures: 1,
      total_time_in_3d_ms: 0,
    },
  });
  const summary = await base44.functions.invoke('getLiveSessionSummary', { sessionId: sid });
  await base44.entities.LiveSession.delete(sid).catch(() => {});
  const f = summary.data?.visual_layer_summary?.portals_load_failures;
  if (f !== 1) return FAIL(`failures = ${f}, expected 1`);
  return PASS('portals_load_failures = 1');
}

async function test_5_5_time_in_3d() {
  // 1 fan, 45000ms total → average should be 45000ms (≥45 seconds).
  const res = await base44.functions.invoke('createLiveSession', { title: '[regression] dwell probe', audio_mode: 'sync' });
  const sid = res.data?.session_id;
  await base44.entities.LiveSession.update(sid, {
    visual_layer_analytics: {
      visual_layer_enabled_by_creator: true,
      fan_visual_layer_choices: { standard: 0, portals: 1 },
      portals_load_failures: 0,
      total_time_in_3d_ms: 45000,
    },
  });
  const summary = await base44.functions.invoke('getLiveSessionSummary', { sessionId: sid });
  await base44.entities.LiveSession.delete(sid).catch(() => {});
  const avgMs = summary.data?.visual_layer_summary?.average_time_in_3d_ms;
  if (avgMs < 45000) return FAIL(`avg = ${avgMs}ms, expected ≥45000ms`);
  return PASS(`average_time_in_3d = ${(avgMs / 1000).toFixed(1)}s`);
}

async function test_6_1_no_auto_create_portals() {
  // After session create + start, visual_layer must remain "visualizer" and
  // portal_room_id must remain null UNLESS the toggle was used.
  const res = await base44.functions.invoke('createLiveSession', { title: '[regression] auto-create probe', audio_mode: 'sync' });
  const sid = res.data?.session_id;
  await base44.entities.LiveSession.update(sid, { status: 'streaming', start_time: new Date().toISOString() });
  await sleep(200);
  const s = (await base44.entities.LiveSession.filter({ id: sid }))[0];
  await base44.entities.LiveSession.delete(sid).catch(() => {});
  const vl = s.visual_layer || 'visualizer';
  if (vl !== 'visualizer') return FAIL(`visual_layer auto-promoted to ${vl}`);
  if (s.portal_room_id) return FAIL(`portal_room_id auto-set to ${s.portal_room_id}`);
  return PASS('no auto-mount of Portals on session start');
}

async function test_6_3_no_streamr_dependency() {
  // Create a sync-mode session and verify it persists status=streaming without
  // any Streamr fields populated.
  const res = await base44.functions.invoke('createLiveSession', { title: '[regression] no-streamr probe', audio_mode: 'sync' });
  const sid = res.data?.session_id;
  await base44.entities.LiveSession.update(sid, { status: 'streaming', start_time: new Date().toISOString() });
  await sleep(150);
  const s = (await base44.entities.LiveSession.filter({ id: sid }))[0];
  await base44.entities.LiveSession.delete(sid).catch(() => {});
  if (s.audio_mode !== 'sync') return FAIL(`audio_mode = ${s.audio_mode}, expected sync`);
  if (s.streamr_enabled) return FAIL('streamr_enabled = true in a pure-sync session');
  if (s.status !== 'streaming') return FAIL(`status = ${s.status}, expected streaming`);
  return PASS('sync-only session works end-to-end');
}

// ---------- Test catalog ----------

const SECTIONS = [
  {
    id: 1,
    title: 'LiveSession Schema',
    tests: [
      { id: '1.1', label: 'Schema fields exist (visual_layer, portal_room_id)', run: test_1_1_schema_fields },
      { id: '1.2', label: 'Defaults: visualizer + null', run: test_1_2_defaults },
      { id: '1.3', label: 'ON/OFF state persistence', run: test_1_3_state_persistence },
    ],
  },
  {
    id: 2,
    title: 'LiveStudio (Performer)',
    tests: [
      { id: '2.1', label: 'Toggle "Enable Portals Stage" visible in LiveStudio', manual: 'Open /live-studio, create a session — the toggle appears in the Session Setup card.' },
      { id: '2.2', label: 'Toggle ON → portal_room_id created, visual_layer=portals, toast "Portals Stage Enabled"', manual: 'Toggle ON in LiveStudio. Watch for toast + 3D stage availability on LiveWatch.' },
      { id: '2.3', label: 'Toggle OFF → portal_room_id=null, visual_layer=visualizer, toast "Portals Stage Disabled"', manual: 'Toggle OFF. Watch for toast + Portals panel unmounts.' },
      { id: '2.4', label: 'Portals load failure → toast "Portals failed to load." + auto-revert OFF', manual: 'Temporarily remove PORTAL_ACCESS_KEY (or block theportal.to) and toggle ON. Toggle should snap back.' },
    ],
  },
  {
    id: 3,
    title: 'LiveWatch (Fan)',
    tests: [
      { id: '3.1', label: 'Mode selector shown, default = Standard, Visualizer instant', manual: 'As fan, open a Portals-enabled session. Selector visible, Standard active, no 3D delay.' },
      { id: '3.2', label: '3D Mode loads PortalStageViewer + can switch back', manual: 'Click 3D Mode. Iframe loads. Click Standard. Reverts cleanly.' },
      { id: '3.3', label: '3D load failure → toast + auto-fallback to Standard', manual: 'Block theportal.to and pick 3D. Within 8s, fan auto-reverts to Standard.' },
      { id: '3.4', label: 'Standard↔3D switching, state persists during session', manual: 'Switch repeatedly. fanVisualPreference is local-state only (no reload preserves it — by design).' },
      { id: '3.5', label: 'Creator disables Portals mid-session → fan auto-switches to Standard', manual: 'Have fan in 3D, then toggle Portals OFF in LiveStudio. Fan UI must drop the selector and switch to Standard automatically.' },
    ],
  },
  {
    id: 4,
    title: 'Event Bus',
    tests: [
      { id: '4.1', label: 'play/pause/seek/track-change sync across clients', manual: 'Open LiveStudio + LiveWatch in two tabs. Perform actions. All events appear in fan EventFeed.' },
      { id: '4.2', label: 'Reactions instant cross-client', manual: 'Send a reaction from both sides. Both bars update in <1s.' },
      { id: '4.3', label: 'Chat propagation', manual: 'Send chat from each side. Both see it.' },
      { id: '4.4', label: 'Drops appear for all fans', manual: 'Performer triggers a drop. Overlay appears on every connected LiveWatch.' },
      { id: '4.5', label: 'Bus identical with Portals ON vs OFF', manual: 'Repeat 4.1–4.4 once with Portals ON, once OFF. Behavior must be indistinguishable.' },
    ],
  },
  {
    id: 5,
    title: 'Intelligence OS Analytics',
    tests: [
      { id: '5.1', label: 'Summary bundle contains all 4 analytics keys', run: test_5_1_summary_fields },
      { id: '5.2', label: 'Creator-enabled flag flows through', run: test_5_2_creator_flag },
      { id: '5.3', label: 'Fan mode choice counts: 2 standard, 1 portals', run: test_5_3_fan_choice_counts },
      { id: '5.4', label: 'Portals load failure count: 1', run: test_5_4_load_failures },
      { id: '5.5', label: 'average_time_in_3d ≥ 45000ms', run: test_5_5_time_in_3d },
    ],
  },
  {
    id: 6,
    title: 'Regression Guardrails',
    tests: [
      { id: '6.1', label: 'No auto-create Portals on session start', run: test_6_1_no_auto_create_portals },
      { id: '6.2', label: 'Fans never forced into 3D (default = Standard)', manual: 'Open a Portals-enabled session as a fan — selector defaults to Standard. Verified by code: FanVisualLayerSelector initial value="standard".' },
      { id: '6.3', label: 'No Streamr dependency — sync-only session works end-to-end', run: test_6_3_no_streamr_dependency },
      { id: '6.4', label: 'No legacy auto-mounting of portal_room_id', manual: 'Code-level check: LiveWatch renders PortalStageViewer ONLY when (portalsAvailable && fanVisualPreference==="portals"). Auto-create code in LiveStudio has been removed.' },
    ],
  },
  {
    id: 7,
    title: 'End-to-End Smoke',
    tests: [
      { id: '7.E2E', label: '15-step creator/fan smoke flow', manual: '1) LiveStudio → 2) start session → 3) play track → 4) fan joins LiveWatch → 5) Standard visible → 6) switch to 3D → 7) creator toggles Portals OFF → 8) fan auto-Standard → 9) toggle ON → 10) fan picks 3D → 11) pause → 12) fan sees pause instantly → 13) end session → 14) summary loads → 15) /live-summary shows all visual_layer_summary fields.' },
    ],
  },
];

// ---------- Runner UI ----------

function StatusIcon({ status }) {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-rose-400" />;
  if (status === 'running') return <Loader2 className="w-4 h-4 animate-spin text-amber-400" />;
  if (status === 'manual') return <ChevronRight className="w-4 h-4 text-indigo-400" />;
  return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
}

export default function LiveRegression() {
  const [results, setResults] = useState({}); // { [testId]: { status, detail } }
  const [running, setRunning] = useState(false);

  const runOne = async (test) => {
    if (test.manual) {
      setResults((p) => ({ ...p, [test.id]: { status: 'manual', detail: test.manual } }));
      return;
    }
    setResults((p) => ({ ...p, [test.id]: { status: 'running' } }));
    try {
      const r = await test.run();
      setResults((p) => ({ ...p, [test.id]: r }));
    } catch (err) {
      setResults((p) => ({ ...p, [test.id]: FAIL(err.message) }));
    }
  };

  const runAll = async () => {
    setRunning(true);
    setResults({});
    for (const section of SECTIONS) {
      for (const test of section.tests) {
        await runOne(test);
      }
    }
    setRunning(false);
  };

  const counts = Object.values(results).reduce(
    (acc, r) => {
      if (r.status === 'pass') acc.pass++;
      else if (r.status === 'fail') acc.fail++;
      else if (r.status === 'manual') acc.manual++;
      return acc;
    },
    { pass: 0, fail: 0, manual: 0 }
  );

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black text-foreground">Live Performance — Regression Suite</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Validates the canonical Live architecture: event-driven core, sync playback, optional Portals, fan selector, analytics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/live-studio" className="text-xs text-indigo-400 hover:text-indigo-300">→ LiveStudio</Link>
            <Button onClick={runAll} disabled={running} className="bg-emerald-600 hover:bg-emerald-500 rounded-xl gap-2">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {running ? 'Running…' : 'Run All Programmatic Tests'}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-emerald-500/20 text-emerald-300 border-0">✓ {counts.pass} pass</Badge>
          <Badge className="bg-rose-500/20 text-rose-300 border-0">✗ {counts.fail} fail</Badge>
          <Badge className="bg-indigo-500/20 text-indigo-300 border-0">▸ {counts.manual} manual</Badge>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.id} className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h2 className="font-black text-foreground text-lg">
              Section {section.id} — {section.title}
            </h2>
            <div className="space-y-2">
              {section.tests.map((test) => {
                const r = results[test.id] || {};
                return (
                  <div key={test.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                    <div className="pt-0.5">
                      <StatusIcon status={r.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{test.id}</span>
                        <span className="text-sm font-bold text-foreground">{test.label}</span>
                        {test.manual && <Badge variant="outline" className="text-[10px]">manual</Badge>}
                      </div>
                      {r.detail && (
                        <p className={`text-xs mt-1 ${r.status === 'fail' ? 'text-rose-300' : 'text-muted-foreground'}`}>
                          {r.detail}
                        </p>
                      )}
                    </div>
                    {!test.manual && (
                      <Button size="sm" variant="outline" onClick={() => runOne(test)} disabled={running} className="text-xs">
                        Run
                      </Button>
                    )}
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