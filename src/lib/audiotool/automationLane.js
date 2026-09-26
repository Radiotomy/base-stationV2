// Automation lanes: draw a parameter curve (preset shape or AI-described) onto
// an Audiotool automation track. Event values are normalized 0–1 by Nexus, so a
// curve maps onto any automatable parameter's full range.
import { base44 } from '@/api/base44Client';
import { nextTrackOrder } from '@/lib/audiotool/nexusOrdering';
import { getField } from '@/lib/audiotool/deviceParams';

const BAR = 3840 * 4;
const PER_BAR = 16;

export const SHAPES = [
  ['rise', 'Rise'], ['fall', 'Fall'], ['swell', 'Swell'], ['wobble', 'Wobble (LFO)'], ['pulse', 'Pulse'], ['ai', 'Describe it (AI)'],
];

const shapeFn = {
  rise: (x) => x,
  fall: (x) => 1 - x,
  swell: (x) => Math.sin(Math.PI * x),
  wobble: (x, bars) => 0.5 + 0.5 * Math.sin(2 * Math.PI * x * bars * 2),
  pulse: (x, bars) => (Math.floor(x * bars * 4) % 2 ? 0.2 : 0.9),
};

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

/** Returns an array of normalized values, one per 16th across the lane. */
export async function planCurve(shape, bars, prompt) {
  const n = bars * PER_BAR;
  if (shape !== 'ai') return Array.from({ length: n + 1 }, (_, i) => clamp01(shapeFn[shape](i / n, bars)));
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You draw DAW automation curves. Describe a parameter movement over ${bars} bar(s) as exactly ${n + 1} values between 0 and 1, one per 16th note (the last value is the end point). Movement: "${prompt}".`,
    response_json_schema: { type: 'object', properties: { values: { type: 'array', items: { type: 'number' } } }, required: ['values'] },
  });
  const v = res.values || [];
  if (v.length < 2) throw new Error('The AI returned no curve — try rephrasing.');
  return Array.from({ length: n + 1 }, (_, i) => clamp01(v[Math.round((i / n) * (v.length - 1))]));
}

// Drop points that sit on a straight line between their neighbours — keeps lanes light.
// Takes [value, index] pairs.
const simplify = (pts) => pts.filter(([v], i) => i === 0 || i === pts.length - 1 || Math.abs(v - (pts[i - 1][0] + pts[i + 1][0]) / 2) > 0.002);
const sameLoc = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Writes the curve as a new automation region. Returns the automation collection id. */
export function writeAutomation(nexus, { device, fieldPath, startBar, bars, values, label }) {
  return nexus.modify((t) => {
    const field = getField(device.entity, fieldPath);
    if (!field?.location) throw new Error('That parameter cannot be automated.');
    const track = t.entities.ofTypes('automationTrack').get().find((tr) => sameLoc(tr.fields.automatedParameter.value, field.location))
      || t.create('automationTrack', { automatedParameter: field.location, orderAmongTracks: nextTrackOrder(t) });
    const collection = t.create('automationCollection', {});
    const duration = bars * BAR;
    t.create('automationRegion', {
      track: track.location,
      collection: collection.location,
      region: {
        positionTicks: (startBar - 1) * BAR, durationTicks: duration, loopDurationTicks: duration,
        loopOffsetTicks: 0, collectionOffsetTicks: 0, displayName: label.slice(0, 40), colorIndex: 4,
      },
    });
    const step = duration / (values.length - 1);
    simplify(values.map((v, i) => [v, i])).forEach(([v, i]) => {
      t.create('automationEvent', { collection: collection.location, positionTicks: Math.round(i * step), value: v, interpolation: 2, slope: 0 });
    });
    return collection.id;
  });
}