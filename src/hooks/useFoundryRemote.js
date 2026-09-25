import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { NODE_DEFS } from '@/lib/foundry/nodeTypes';
import { listDevices, listFields, getField, suggestField, defaultRange, translate } from '@/lib/audiotool/deviceParams';
import { effectiveEdges, syncCables } from '@/lib/audiotool/cableSync';
import useFoundryDeviceMap from '@/hooks/useFoundryDeviceMap';
import useDevicePush from '@/hooks/useDevicePush';

/** Foundry patch as a live remote control for devices in the open Audiotool session. */
export default function useFoundryRemote({ nexus, projectUrl, plugin, version }) {
  const [graph, setGraph] = useState(null);
  const [tick, setTick] = useState(0);
  const [cableStatus, setCableStatus] = useState('');
  const { map, update } = useFoundryDeviceMap(projectUrl, plugin?.id);
  const { push, error } = useDevicePush(nexus);

  useEffect(() => { setGraph(plugin?.graph_state || null); }, [plugin]);

  const devices = useMemo(() => listDevices(nexus), [nexus, version, tick]);
  const deviceById = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const links = map?.links || [];
  const linkFor = (nodeId) => links.find((l) => l.node_id === nodeId) || null;

  const pushMapping = useCallback((link, node, m, value) => {
    const entity = deviceById.get(link.device_id)?.entity;
    const field = entity && getField(entity, m.field);
    const def = NODE_DEFS[node.type]?.params[m.param];
    if (!field || !def) return;
    push(`${link.device_id}:${m.field}`, field, translate(def, value, m), m.field);
  }, [deviceById, push]);

  const setParam = (nodeId, key, value) => {
    const node = graph.nodes.find((n) => n.id === nodeId);
    setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, [key]: value } } : n)) }));
    const link = linkFor(nodeId);
    const m = link?.params.find((p) => p.param === key);
    if (m) pushMapping(link, node, m, value);
  };

  const linkNode = (node, deviceId) => {
    const rest = links.filter((l) => l.node_id !== node.id);
    const dev = deviceById.get(deviceId);
    if (!dev) return update({ links: rest });
    const fields = listFields(dev.entity);
    const params = Object.entries(NODE_DEFS[node.type]?.params || {}).filter(([, p]) => p.type !== 'text').map(([k, p]) => {
      const f = suggestField(node.type, k, p, fields);
      if (!f) return null;
      const [min, max] = defaultRange(f);
      return { param: k, field: f.path, kind: f.kind, min, max };
    }).filter(Boolean);
    update({ links: [...rest, { node_id: node.id, device_id: dev.id, device_type: dev.type, params }] });
  };

  const setLinkParams = (nodeId, params) => update({ links: links.map((l) => (l.node_id === nodeId ? { ...l, params } : l)) });

  const setBypass = (nodeId, on) => {
    update({ bypassed: on ? [...map.bypassed, nodeId] : map.bypassed.filter((id) => id !== nodeId) });
    const active = deviceById.get(linkFor(nodeId)?.device_id)?.entity?.fields.isActive;
    if (active) push(`${nodeId}:isActive`, active, !on, 'isActive');
  };

  const sendAll = () => links.forEach((l) => {
    const node = graph?.nodes.find((n) => n.id === l.node_id);
    if (node) l.params.forEach((m) => pushMapping(l, node, m, node.params?.[m.param] ?? NODE_DEFS[node.type].params[m.param].default));
  });

  const edgesKey = JSON.stringify(graph?.edges || []);
  useEffect(() => {
    if (!map?.mirror_cables || !graph) return;
    const pairs = effectiveEdges(graph, links, map.bypassed);
    syncCables(nexus, pairs, links, deviceById)
      .then(({ added, removed }) => setCableStatus(`Cables synced — ${added} added, ${removed} removed.`))
      .catch((e) => setCableStatus(`Cable sync failed: ${e.message}`));
  }, [map?.mirror_cables, JSON.stringify(links.map((l) => [l.node_id, l.device_id])), JSON.stringify(map?.bypassed), edgesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveGraph = () => base44.entities.FoundryPlugin.update(plugin.id, { graph_state: graph });

  return {
    graph, map, devices, error, cableStatus, linkFor, setParam, linkNode, setLinkParams, setBypass, sendAll, saveGraph,
    setMirror: (on) => update({ mirror_cables: on }),
    fieldsFor: (link) => (link ? listFields(deviceById.get(link.device_id)?.entity) : []),
    refreshDevices: () => setTick((t) => t + 1),
  };
}