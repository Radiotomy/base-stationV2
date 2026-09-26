// "Generate Instrument Chain": prompt → device plan → community preset lookup →
// devices + cables + mixer channel + note track created live in the session.
import { base44 } from '@/api/base44Client';
import { nextTrackOrder, nextStripOrder } from '@/lib/audiotool/nexusOrdering';

export const CHAIN_INSTRUMENTS = ['heisenberg', 'space', 'pulverisateur', 'gakki'];
export const CHAIN_EFFECTS = [
  'stompboxChorus', 'stompboxCompressor', 'stompboxCrusher', 'stompboxDelay', 'stompboxFlanger',
  'stompboxPhaser', 'stompboxReverb', 'stompboxTube', 'stompboxStereoDetune', 'autoFilter',
  'curve', 'quasar', 'pulsar', 'exciter', 'stereoEnhancer', 'gravity',
];

const spec = (devices) => ({
  type: 'object',
  properties: { device: { type: 'string', enum: devices }, search: { type: 'string' } },
  required: ['device', 'search'],
});

export async function planChain(prompt) {
  const plan = await base44.integrations.Core.InvokeLLM({
    prompt: `You design Audiotool device chains. For the sound described below, choose ONE instrument and 1-4 effects in signal order.
Instruments: heisenberg (FM synth: bells, keys, digital pads), space (analog-style poly synth: lush pads, leads), pulverisateur (monster analog synth: basses, aggressive leads), gakki (soundfont sampler: realistic pianos, strings, drums, orchestral).
For each device give a short 1-3 word "search" text to find a matching community preset (e.g. "warm pad", "tape echo", "dub bass").
Sound: "${prompt}"`,
    response_json_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        instrument: spec(CHAIN_INSTRUMENTS),
        effects: { type: 'array', items: spec(CHAIN_EFFECTS) },
      },
      required: ['name', 'instrument', 'effects'],
    },
  });
  return { ...plan, effects: (plan.effects || []).slice(0, 4) };
}

async function findPreset(at, { device, search }) {
  try {
    const list = await at.presets.search(device, search);
    return list?.[0] || null;
  } catch {
    return null;
  }
}

const presetLabel = (p) => p?.displayName || p?.name || null;

/** Builds the planned chain in the open session. Returns what was created. */
export async function buildChain(at, nexus, plan) {
  const specs = [plan.instrument, ...plan.effects];
  const presets = await Promise.all(specs.map((s) => findPreset(at, s)));

  return nexus.modify((t) => {
    const row = t.entities.ofTypes('mixerChannel').get().length;
    const created = specs.map((s, i) => {
      const e = presets[i] ? t.createDeviceFromPreset(presets[i]) : t.create(s.device, {});
      if (e.fields.positionX) t.update(e.fields.positionX, 200 + i * 320);
      if (e.fields.positionY) t.update(e.fields.positionY, 300 + row * 420);
      if (e.fields.displayName && i === 0) t.update(e.fields.displayName, plan.name.slice(0, 40));
      return e;
    });

    // Keep only effects that expose a plain audio in/out pair.
    const [instrument, ...fx] = created;
    const usable = fx.filter((e) => e.fields.audioInput && e.fields.audioOutput);
    fx.filter((e) => !usable.includes(e)).forEach((e) => t.remove(e));

    const channel = t.create('mixerChannel', { displayParameters: { orderAmongStrips: nextStripOrder(t) } });
    const chain = [instrument, ...usable, channel];
    for (let i = 0; i < chain.length - 1; i++) {
      t.create('desktopAudioCable', {
        fromSocket: chain[i].fields.audioOutput.location,
        toSocket: chain[i + 1].fields.audioInput.location,
      });
    }
    t.create('noteTrack', {
      player: instrument.location,
      orderAmongTracks: nextTrackOrder(t),
    });

    const kept = [instrument, ...usable];
    return {
      deviceIds: kept.map((e) => e.id),
      devices: specs
        .map((s, i) => ({ device: s.device, preset: presetLabel(presets[i]), kept: kept.includes(created[i]) }))
        .filter((d) => d.kept),
    };
  });
}