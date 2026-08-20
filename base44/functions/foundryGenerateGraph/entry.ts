import { createClientFromRequest } from 'npm:@base44/sdk@0.8.43';

// BASE Foundry — conversational DSP architect.
//
// Turns a natural-language sound description into a Foundry node graph. It only
// ever RETURNS JSON: it does not touch audio, does not write an asset, and has no
// path to the BASE Mark or COS pipelines. The frontend decides whether to accept
// the graph, which is also what makes the participation score meaningful.

const NODE_TYPES = [
  'oscillator', 'noise', 'sampler',
  'filter', 'delay', 'reverb', 'saturation', 'eq3', 'gain',
  'lfo', 'adsr',
  'input', 'output',
];

// Modulatable parameters per type, mirroring nodeTypes.js. Kept here so the
// function can REPAIR a graph rather than hand the engine wires it will silently
// drop — a dropped wire reads to the creator as a broken audio engine.
const MOD_PARAMS: Record<string, string[]> = {
  oscillator: ['frequency', 'detune', 'level'],
  noise: ['level'],
  sampler: ['rate', 'level'],
  filter: ['cutoff', 'resonance'],
  delay: ['time', 'feedback', 'mix'],
  reverb: ['mix'],
  saturation: ['drive', 'tone', 'output'],
  eq3: ['low', 'mid', 'mid_freq', 'high'],
  gain: ['level'],
  output: [],
  lfo: [],
  adsr: [],
  input: [],
};

const MODULATORS = new Set(['lfo', 'adsr']);

const GRAPH_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string', description: 'One or two sentences describing the signal chain in plain language' },
    category: { type: 'string', enum: ['effect', 'instrument', 'utility', 'modulator'] },
    tags: { type: 'array', items: { type: 'string' } },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Short unique id, e.g. osc1, flt1' },
          type: { type: 'string', enum: NODE_TYPES },
          params: { type: 'object', description: 'Parameter values by name; omit to use defaults' },
        },
        required: ['id', 'type'],
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          toParam: { type: 'string', description: 'Only for lfo/adsr sources: the parameter being modulated' },
        },
        required: ['from', 'to'],
      },
    },
  },
  required: ['title', 'summary', 'nodes', 'edges'],
};

const GUIDE = `
Available module types and their parameters:
- oscillator: wave(sine|square|sawtooth|triangle), frequency(20-4000), detune(-1200..1200), level(0-1)
- noise: color(white|pink), level(0-1)
- sampler: url(string), loop(bool), rate(0.25-4), level(0-1)
- filter: mode(lowpass|highpass|bandpass), cutoff(30-18000), resonance(0.1-20)
- delay: time(0.01-2), spread(0-0.5), feedback(0-0.95), mix(0-1)
- reverb: size(0.2-6), damping(0.5-8), mix(0-1)
- saturation: drive(1-40), tone(500-16000), output(0-1.5)
- eq3: low(-18..18), mid(-18..18), mid_freq(200-6000), high(-18..18)
- gain: level(0-2)
- lfo: wave, sync(bool), division(4|2|1|1/2|1/4|1/8|1/16), rate(0.05-20), depth(0-4000)
- adsr: attack, decay, sustain(0-1), release, depth(0-4000)
- input: the audio being processed (use for EFFECT plugins)
- output: required, exactly one, the end of the chain

Rules:
- Always include exactly one "output" node.
- An EFFECT or UTILITY graph must start from an "input" node.
- An INSTRUMENT graph must start from oscillator/noise/sampler, not "input".
- lfo and adsr are modulators: their edges MUST set toParam to a continuous
  parameter of the destination (e.g. cutoff, frequency, level, mix). Never wire a
  modulator into an audio input, and never modulate a discrete choice like
  filter mode or wave.
- Keep it to 3-7 nodes. A clear chain beats an elaborate one.
- ALWAYS fill in the params that define the character. An empty params object
  falls back to generic defaults, so "bandpass sweep" with no mode set arrives as
  a plain lowpass and does not match what was asked for.
- Choose parameter values that actually produce the described character.
`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, existing_graph, category } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'A prompt is required' }, { status: 400 });
    }

    const contextBlock = existing_graph?.nodes?.length
      ? `The creator already has this graph. MODIFY it to satisfy the request, preserving node ids where the module survives:\n${JSON.stringify(existing_graph)}`
      : 'The creator is starting from scratch.';

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a DSP architect for BASE Foundry, a modular audio plugin builder.
Design a Web Audio signal graph for this request:

"${prompt}"

${category ? `Intended category: ${category}` : ''}
${contextBlock}

${GUIDE}

Return ONLY the graph. The summary should explain, in a sentence or two, why this
chain produces the requested sound.`,
      response_json_schema: GRAPH_SCHEMA,
    });

    // Validate before it reaches the audio engine: an unknown module type or a
    // dangling wire would build a silent graph and look like a bug in the engine.
    const nodes = (result.nodes || []).filter((n) => n?.id && NODE_TYPES.includes(n.type));
    const ids = new Set(nodes.map((n) => n.id));
    const typeOf = new Map(nodes.map((n) => [n.id, n.type]));

    // Normalise routing. The model reliably gets topology right and `toParam`
    // wrong: it labels ordinary audio edges `toParam: "audio"` and occasionally
    // aims a modulator at a parameter the destination does not expose. Both are
    // repaired here, and only a genuine modulator keeps a param target.
    const edges = (result.edges || [])
      .filter((e) => ids.has(e?.from) && ids.has(e?.to) && e.from !== e.to)
      .map((e) => {
        const fromType = typeOf.get(e.from);
        const allowed = MOD_PARAMS[typeOf.get(e.to)] || [];
        if (!MODULATORS.has(fromType)) return { from: e.from, to: e.to };
        const target = e.toParam && allowed.includes(e.toParam) ? e.toParam : allowed[0];
        // A modulator with no valid destination parameter is a dead wire, not audio.
        return target ? { from: e.from, to: e.to, toParam: target } : null;
      })
      .filter(Boolean);

    if (!nodes.some((n) => n.type === 'output')) {
      return Response.json({ error: 'The generated graph had no output stage. Try rephrasing.' }, { status: 422 });
    }

    return Response.json({
      ok: true,
      title: result.title,
      summary: result.summary,
      category: result.category || category || 'effect',
      tags: result.tags || [],
      nodes,
      edges,
      dropped: {
        nodes: (result.nodes || []).length - nodes.length,
        edges: (result.edges || []).length - edges.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});