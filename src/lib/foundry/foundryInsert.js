// Foundry patch → insert processor.
//
// Lets a saved FoundryPlugin act as one stage inside another signal chain,
// in either a live AudioContext (mastering preview) or an OfflineAudioContext
// (the rendered master). Both paths build from the SAME engine units, so what
// the creator auditions is what gets rendered — a preview that disagreed with
// the render would be worse than no preview at all.

import FoundryEngine from './audioEngine';

/**
 * A patch is only usable as an insert if audio can actually pass THROUGH it:
 * it needs an Insert Input to receive the track and an Output to hand it back.
 * An instrument patch (oscillator → output) has no input, so inserting it would
 * silently replace the master with a synth tone.
 */
export function isInsertable(graph) {
  const nodes = graph?.nodes || [];
  return nodes.some((n) => n.type === 'input') && nodes.some((n) => n.type === 'output');
}

export function insertRejectReason(graph) {
  const nodes = graph?.nodes || [];
  if (!nodes.length) return 'This patch is empty.';
  if (!nodes.some((n) => n.type === 'input')) return 'This patch has no Insert Input, so the track has no way in.';
  if (!nodes.some((n) => n.type === 'output')) return 'This patch has no Output, so nothing comes back out.';
  return null;
}

/**
 * Build the patch into `ctx` and return its terminals.
 * Caller wires: previousStage → insert.input, insert.output → nextStage.
 */
export async function buildFoundryInsert(ctx, graph, { bpm = 120 } = {}) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const engine = new FoundryEngine();
  await engine.adopt(ctx, graph, { input, output, bpm });
  return {
    input,
    output,
    dispose: () => {
      engine.releaseUnits();
      try { input.disconnect(); } catch {}
      try { output.disconnect(); } catch {}
    },
  };
}