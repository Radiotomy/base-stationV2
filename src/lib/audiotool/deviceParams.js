// Foundry ↔ Audiotool parameter translation. Nexus exposes device fields at
// runtime but not their ranges, so each mapping carries an editable Audiotool
// range that the Foundry parameter range is scaled onto.
import { CHAIN_INSTRUMENTS, CHAIN_EFFECTS } from '@/lib/audiotool/instrumentChain';
import { MANUAL_DEVICE_TYPES, manualFor } from '@/lib/audiotool/audiotoolManual';

// Every device in Audiotool's manual, not just the ones our tools create.
const DEVICE_TYPES = [...new Set([...CHAIN_INSTRUMENTS, 'beatbox8', 'bassline', 'tonematrix', ...CHAIN_EFFECTS, ...MANUAL_DEVICE_TYPES])];
const SKIP = /^(positionX|positionY)$/;

// A type name this SDK version doesn't know must not break the whole list.
const query = (nexus, type) => {
  try { return nexus.queryEntities.ofTypes(type).get(); } catch { return []; }
};

export function listDevices(nexus) {
  return DEVICE_TYPES.flatMap((type) =>
    query(nexus, type).map((entity) => ({
      id: entity.id, type, entity, name: entity.fields.displayName?.value || manualFor(type)?.name || type,
    })));
}

/** Every mutable number/boolean field on a device, as dotted paths. */
export function listFields(entity) {
  const out = [];
  const walk = (obj, prefix, depth) => {
    for (const [k, f] of Object.entries(obj?.fields || {})) {
      if (!f || typeof f !== 'object' || SKIP.test(k)) continue;
      const path = prefix ? `${prefix}.${k}` : k;
      if (f.fields) { if (depth < 3) walk(f, path, depth + 1); continue; }
      if (!f.mutable || !('value' in f)) continue;
      if (typeof f.value === 'number') out.push({ path, kind: 'number', value: f.value });
      else if (typeof f.value === 'boolean') out.push({ path, kind: 'bool', value: f.value });
    }
  };
  walk(entity, '', 0);
  return out;
}

export const getField = (entity, path) => path.split('.').reduce((o, k) => o?.fields?.[k], entity);

const HINTS = {
  cutoff: /cutoff|freq/i, resonance: /reson|peak|^q$/i, frequency: /freq|tune|pitch/i, detune: /detune/i,
  wave: /wave|shape/i, rate: /rate|speed|freq/i, depth: /depth|amount|intensity/i, mix: /mix|wet/i,
  feedback: /feedback/i, time: /time|delay|step/i, level: /gain|level|volume/i, output: /gain|level|output/i,
  drive: /drive|dist/i, attack: /attack/i, decay: /decay/i, sustain: /sustain/i, release: /release/i,
  size: /size|room|decay/i, damping: /damp/i, tone: /tone|color/i, low: /low/i, mid: /mid/i, high: /high/i,
  spread: /spread|stereo/i, sync: /sync/i, loop: /loop/i,
};

export function suggestField(nodeType, param, def, fields) {
  const re = HINTS[param];
  if (!re) return null;
  const kind = def.type === 'bool' ? 'bool' : 'number';
  const hits = fields.filter((f) => f.kind === kind && re.test(f.path.split('.').pop()));
  return (hits.find((f) => f.path.toLowerCase().includes(nodeType)) || hits[0]) || null;
}

export function defaultRange(field) {
  const name = field.path.split('.').pop();
  if (field.kind === 'bool') return [0, 1];
  if (/Index$/.test(name)) return [0, 3];
  if (Math.abs(field.value) <= 1) return [0, 1];
  return [0, Math.max(1, Math.round(Math.abs(field.value) * 2))];
}

const norm = (def, v) => (def.max === def.min ? 0 : (Number(v) - def.min) / (def.max - def.min));

/** Foundry parameter value → Audiotool field value for one mapping. */
export function translate(def, value, m) {
  if (m.kind === 'bool') {
    if (def.type === 'bool') return !!value;
    if (def.type === 'enum') return def.options.indexOf(value) > 0;
    return norm(def, value) >= 0.5;
  }
  let out;
  if (def.type === 'enum') out = m.min + Math.max(0, def.options.indexOf(value));
  else if (def.type === 'bool') out = value ? m.max : m.min;
  else out = m.min + norm(def, value) * (m.max - m.min);
  out = Math.min(Math.max(out, Math.min(m.min, m.max)), Math.max(m.min, m.max));
  return /Index$|Count$/.test(m.field) ? Math.round(out) : out;
}