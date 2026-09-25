// COS telemetry for the Audiotool Bridge. Every AI invocation made through the
// bridge is logged per project, recording exactly which entities the AI wrote —
// so human vs machine contribution is MEASURED from the live document rather
// than inferred from prompts.
import { CHAIN_INSTRUMENTS, CHAIN_EFFECTS } from '@/lib/audiotool/instrumentChain';

export const TELEMETRY_EVENT = 'nexus-telemetry';
const key = (project) => `nexus_cos_${project}`;

export function readLog(project) {
  try {
    return JSON.parse(localStorage.getItem(key(project)) || '[]');
  } catch {
    return [];
  }
}

export function logInvocation(project, entry) {
  const log = [...readLog(project), { ...entry, prompt: (entry.prompt || '').slice(0, 500), at: new Date().toISOString() }];
  localStorage.setItem(key(project), JSON.stringify(log.slice(-200)));
  window.dispatchEvent(new Event(TELEMETRY_EVENT));
}

const ofTypes = (nexus, types) => types.flatMap((t) => nexus.queryEntities.ofTypes(t).get());

export function computeContribution(nexus, log) {
  const aiCollections = new Set(log.flatMap((e) => e.collectionIds || []));
  const aiDeviceIds = new Set(log.flatMap((e) => e.deviceIds || []));

  const notes = nexus.queryEntities.ofTypes('note').get();
  const aiNotes = notes.filter((n) => aiCollections.has(n.fields.collection.value.entityId)).length;
  const devices = ofTypes(nexus, [...CHAIN_INSTRUMENTS, ...CHAIN_EFFECTS]);
  const aiDevices = devices.filter((d) => aiDeviceIds.has(d.id)).length;

  const humanNotes = notes.length - aiNotes;
  const humanDevices = devices.length - aiDevices;
  const total = notes.length + devices.length;
  return {
    humanNotes, aiNotes, humanDevices, aiDevices,
    invocations: log.length,
    humanShare: total ? Math.round(((humanNotes + humanDevices) / total) * 100) : null,
  };
}