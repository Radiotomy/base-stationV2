// Read-only snapshot of the open Nexus session for the Session Explorer:
// every track in DAW order with its regions, plus the devices on the desktop.
import { listDevices } from '@/lib/audiotool/deviceParams';

const TICKS_PER_BAR = 3840 * 4;
const TRACKS = {
  noteTrack: ['noteRegion', 'MIDI'],
  audioTrack: ['audioRegion', 'Audio'],
  automationTrack: ['automationRegion', 'Automation'],
  patternTrack: ['patternRegion', 'Pattern'],
};

// An unknown type name must not blank the whole explorer.
const query = (nexus, type) => {
  try { return nexus.queryEntities.ofTypes(type).get(); } catch { return []; }
};

const regionInfo = (r) => {
  const f = r.fields.region?.fields;
  if (!f) return null;
  return {
    id: r.id,
    trackId: r.fields.track?.value?.entityId,
    name: f.displayName?.value || 'Untitled region',
    bar: Math.floor(f.positionTicks.value / TICKS_PER_BAR) + 1,
    bars: Math.max(1, Math.round(f.durationTicks.value / TICKS_PER_BAR)),
  };
};

export function readSession(nexus) {
  const devices = listDevices(nexus);
  const names = new Map(devices.map((d) => [d.id, d.name]));
  query(nexus, 'audioDevice').forEach((d) => names.set(d.id, d.fields.displayName?.value || 'Audio device'));

  const tracks = Object.entries(TRACKS).flatMap(([type, [regionType, kind]]) => {
    const regions = query(nexus, regionType).map(regionInfo).filter(Boolean);
    return query(nexus, type).map((tr) => ({
      id: tr.id,
      kind,
      entity: tr,
      order: tr.fields.orderAmongTracks?.value ?? 0,
      playerId: tr.fields.player?.value?.entityId,
      name: names.get(tr.fields.player?.value?.entityId) || `${kind} track`,
      regions: regions.filter((r) => r.trackId === tr.id).sort((a, b) => a.bar - b.bar),
    }));
  }).sort((a, b) => a.order - b.order);

  return { tracks, devices };
}

export const setField = (nexus, field, value) => nexus.modify((t) => t.update(field, value));