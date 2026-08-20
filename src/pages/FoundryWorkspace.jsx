import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Loader2, Save, Globe, Lock, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import AssistantPane from '@/components/foundry/AssistantPane';
import PreviewControls from '@/components/foundry/PreviewControls';
import ParameterPanel from '@/components/foundry/ParameterPanel';
import NodeCanvas from '@/components/foundry/NodeCanvas';
import NodePalette from '@/components/foundry/NodePalette';
import PresetBar from '@/components/foundry/PresetBar';
import FoundryScoreBadge from '@/components/foundry/FoundryScoreBadge';
import InsertPreviewDialog from '@/components/foundry/InsertPreviewDialog';
import ReferenceProfilePanel from '@/components/foundry/ReferenceProfilePanel';
import useFoundryEngine from '@/hooks/useFoundryEngine';
import { compileGraph } from '@/lib/foundry/audioEngine';
import { defaultParams, newId } from '@/lib/foundry/nodeTypes';
import { scoreFoundryPlugin } from '@/lib/foundry/foundryScore';

export default function FoundryWorkspace() {
  const { pluginId } = useParams();
  const { toast } = useToast();
  const audio = useFoundryEngine();

  const [plugin, setPlugin] = useState(null);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [reference, setReference] = useState(null);
  const [signals, setSignals] = useState({
    ai_prompt_count: 0, manual_node_edits: 0, manual_wire_edits: 0,
    param_customizations: 0, was_forked: false,
  });
  const [touchedParams, setTouchedParams] = useState(new Set());

  useEffect(() => {
    base44.entities.FoundryPlugin.get(pluginId).then((p) => {
      setPlugin(p);
      setGraph(p.graph_state?.nodes ? p.graph_state : { nodes: [], edges: [] });
      setSignals((s) => ({ ...s, ...(p.participation_signals || {}), was_forked: !!p.fork_parent_id }));
    }).catch(() => setPlugin(false));
  }, [pluginId]);

  const score = useMemo(() => scoreFoundryPlugin(signals), [signals]);
  const selectedNode = graph.nodes?.find((n) => n.id === selected) || null;
  const hasInputNode = !!graph.nodes?.some((n) => n.type === 'input');

  const noteManualEdit = useCallback((kind) => {
    setSignals((s) => ({
      ...s,
      manual_node_edits: s.manual_node_edits + (kind === 'node' ? 1 : 0),
      manual_wire_edits: s.manual_wire_edits + (kind === 'wire' ? 1 : 0),
    }));
  }, []);

  // Topology change → rebuild the live graph. Parameter changes take the cheaper
  // in-place path in onParamChange instead.
  const applyGraph = useCallback((next) => {
    setGraph(next);
    audio.rebuild(next);
  }, [audio]);

  const onParamChange = useCallback((nodeId, key, value) => {
    setGraph((g) => {
      const next = { ...g, nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, [key]: value } } : n)) };
      audio.setParam(next, nodeId, key, value);
      return next;
    });
    const token = `${nodeId}.${key}`;
    setTouchedParams((prev) => {
      if (prev.has(token)) return prev;
      const next = new Set(prev).add(token);
      setSignals((s) => ({ ...s, param_customizations: next.size }));
      return next;
    });
  }, [audio]);

  const addNode = (type) => {
    const node = {
      id: newId('n'),
      type,
      x: 120 + Math.round(Math.random() * 320),
      y: 80 + Math.round(Math.random() * 280),
      params: defaultParams(type),
    };
    applyGraph({ ...graph, nodes: [...(graph.nodes || []), node] });
    setSelected(node.id);
    noteManualEdit('node');
  };

  const generate = async (prompt) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('foundryGenerateGraph', {
        prompt,
        existing_graph: graph.nodes?.length ? graph : null,
        category: plugin?.category,
        reference_profile: reference?.profile || null,
      });
      const data = res.data;
      if (data?.error) throw new Error(data.error);

      // Lay the returned chain out left-to-right: the generator returns topology,
      // not coordinates, and an unpositioned graph lands in a single pile.
      const nodes = data.nodes.map((n, i) => ({
        id: n.id,
        type: n.type,
        x: 60 + (i % 4) * 250,
        y: 70 + Math.floor(i / 4) * 190,
        params: { ...defaultParams(n.type), ...(n.params || {}) },
      }));
      const edges = data.edges.map((e) => ({ id: newId('e'), from: e.from, to: e.to, ...(e.toParam ? { toParam: e.toParam } : {}) }));

      applyGraph({ nodes, edges });
      setSelected(null);
      setHistory((h) => [...h, { prompt, summary: data.summary, node_count: nodes.length, edge_count: edges.length }]);
      setSignals((s) => ({ ...s, ai_prompt_count: s.ai_prompt_count + 1 }));
      if (plugin && plugin.title === 'Untitled Patch' && data.title) {
        setPlugin((p) => ({ ...p, title: data.title, description: data.summary, category: data.category, tags: data.tags }));
      }
    } catch (e) {
      setHistory((h) => [...h, { prompt, error: e.message }]);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.FoundryPlugin.update(pluginId, {
        title: plugin.title,
        description: plugin.description,
        category: plugin.category,
        tags: plugin.tags || [],
        graph_state: graph,
        dsp_definition: compileGraph(graph),
        is_public: !!plugin.is_public,
        human_score: score.score,
        participation_signals: { ...score.signals, label: score.label, breakdown: score.breakdown },
      });
      toast({ title: 'Patch saved' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (plugin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF9A4D]" />
      </div>
    );
  }
  if (plugin === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-white/60">That patch isn't available.</p>
        <Button asChild variant="outline" className="h-8 text-xs border-white/12">
          <Link to="/foundry">Back to Foundry</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-4 pb-8">
      <div className="max-w-[1800px] mx-auto px-3 sm:px-5">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-white/50">
            <Link to="/foundry"><ArrowLeft className="w-3.5 h-3.5" /></Link>
          </Button>
          <Input
            value={plugin.title || ''}
            onChange={(e) => setPlugin((p) => ({ ...p, title: e.target.value }))}
            className="h-8 w-56 text-sm bg-white/5 border-white/10 font-semibold"
          />
          <PresetBar pluginId={pluginId} graph={graph} onApply={applyGraph} />
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setInsertOpen(true)}
            className="h-8 px-3 text-xs border-white/12 text-white/70"
          >
            <SlidersHorizontal className="w-3 h-3 mr-1.5" />
            Load in Studio
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPlugin((p) => ({ ...p, is_public: !p.is_public }))}
            className="h-8 px-3 text-xs border-white/12 text-white/70"
          >
            {plugin.is_public ? <Globe className="w-3 h-3 mr-1.5 text-[#C7F5E0]" /> : <Lock className="w-3 h-3 mr-1.5" />}
            {plugin.is_public ? 'Public' : 'Private'}
          </Button>
          <Button size="sm" onClick={save} disabled={saving} className="h-8 px-3 text-xs merc-button">
            {saving ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Save className="w-3 h-3 mr-1.5" />}
            Save
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          {/* Left pane — 40%: architect, transport, parameters, provenance */}
          <div
            className="w-full lg:w-2/5 rounded-2xl p-3 flex flex-col gap-3 lg:h-[calc(100vh-140px)]"
            style={{
              background: 'linear-gradient(145deg, rgba(36,28,20,0.85) 0%, rgba(20,16,12,0.95) 100%)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
            }}
          >
            <ReferenceProfilePanel reference={reference} onChange={setReference} disabled={busy} />
            <AssistantPane history={history} busy={busy} onSubmit={generate} reference={reference} />
            <PreviewControls
              engine={audio.engine}
              running={audio.running}
              bypassed={audio.bypassed}
              micOn={audio.micOn}
              bpm={audio.bpm}
              onToggleRun={() => (audio.running ? audio.stop() : audio.start(graph))}
              onToggleMic={audio.toggleMic}
              onToggleBypass={audio.toggleBypass}
              onTrigger={audio.trigger}
              onBpmChange={audio.changeBpm}
            />
            <div className="max-h-64 overflow-y-auto">
              <ParameterPanel node={selectedNode} onParamChange={onParamChange} />
            </div>
            <FoundryScoreBadge score={score.score} label={score.label} />
          </div>

          {/* Right pane — 60%: node canvas */}
          <div
            className="w-full lg:w-3/5 rounded-2xl overflow-hidden flex flex-col h-[560px] lg:h-[calc(100vh-140px)]"
            style={{
              background: 'linear-gradient(145deg, rgba(30,23,17,0.85) 0%, rgba(18,14,10,0.96) 100%)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
            }}
          >
            <div className="px-3 py-2 border-b border-white/8">
              <NodePalette onAdd={addNode} />
            </div>
            <NodeCanvas
              graph={graph}
              selected={selected}
              onSelect={setSelected}
              onChange={applyGraph}
              onManualEdit={noteManualEdit}
            />
            <div className="px-3 py-1.5 border-t border-white/8 text-[9px] text-white/30">
              Drag a module to move · drag an output port to an input port to patch · click a cable to cut it
            </div>
          </div>
        </div>
      </div>

      <InsertPreviewDialog
        open={insertOpen}
        onOpenChange={setInsertOpen}
        engine={audio.engine}
        hasInputNode={hasInputNode}
      />
    </div>
  );
}