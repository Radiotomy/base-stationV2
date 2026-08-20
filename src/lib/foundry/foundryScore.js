// BASE Foundry — plugin participation score.
//
// DELIBERATELY SEPARATE from the audio Creative Ownership Score. A Foundry
// plugin is a tool, not a sound recording: scoring it with the audio COS would
// put a DSP graph into the same number that describes authorship of music, and
// nothing here may be written to a UserAsset or read by the audio COS engine.
//
// What it measures is narrow and honest: how much of THIS graph the human
// shaped, versus how much arrived from a prompt.

export const FOUNDRY_SCORE_VERSION = 1;

const POINTS = {
  manual_node: 6,      // adding or deleting a module by hand
  manual_wire: 5,      // re-routing signal flow by hand — the strongest design signal
  param_tweak: 2,      // dialing a value
  authored_from_blank: 25, // built without ever prompting
  fork_baseline: 10,   // forking is a real starting contribution, but a small one
};

/**
 * @param {object} signals
 * @param {number} signals.ai_prompt_count      accepted AI graph generations
 * @param {number} signals.manual_node_edits    nodes added/removed by hand
 * @param {number} signals.manual_wire_edits    wires connected/cut by hand
 * @param {number} signals.param_customizations distinct params moved by hand
 * @param {boolean} signals.was_forked
 */
export function scoreFoundryPlugin(signals = {}) {
  const s = {
    ai_prompt_count: 0,
    manual_node_edits: 0,
    manual_wire_edits: 0,
    param_customizations: 0,
    was_forked: false,
    ...signals,
  };

  let score = 0;
  const breakdown = [];

  const add = (label, pts) => {
    if (pts <= 0) return;
    score += pts;
    breakdown.push({ label, points: pts });
  };

  if (s.was_forked) add('Forked an existing design', POINTS.fork_baseline);
  if (s.ai_prompt_count === 0 && (s.manual_node_edits > 0 || s.manual_wire_edits > 0)) {
    add('Built from a blank canvas, no AI prompt', POINTS.authored_from_blank);
  }

  // Each signal is capped so one repeated action cannot inflate the score —
  // dragging the same knob 200 times is not 200 creative decisions.
  add(`Wired signal paths by hand (${s.manual_wire_edits})`, Math.min(s.manual_wire_edits, 8) * POINTS.manual_wire);
  add(`Added or removed modules (${s.manual_node_edits})`, Math.min(s.manual_node_edits, 8) * POINTS.manual_node);
  add(`Customized parameters (${s.param_customizations})`, Math.min(s.param_customizations, 12) * POINTS.param_tweak);

  // AI generations don't subtract — they just don't earn. A prompted graph the
  // creator then reworked heavily still scores well, which is the honest result.
  if (s.ai_prompt_count > 0) {
    breakdown.push({ label: `AI-generated graphs accepted (${s.ai_prompt_count})`, points: 0 });
  }

  const final = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: final,
    label: final >= 70 ? 'human_designed' : final >= 35 ? 'ai_assisted' : 'ai_generated',
    breakdown,
    signals: s,
    version: FOUNDRY_SCORE_VERSION,
  };
}

export function scoreLabelCopy(label) {
  return {
    human_designed: 'Human-designed — the graph was authored and rewired by hand',
    ai_assisted: 'AI-assisted — prompted, then reworked by the creator',
    ai_generated: 'AI-generated — prompted with little manual reworking',
  }[label] || 'Unrated';
}