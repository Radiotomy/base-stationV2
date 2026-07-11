import { audioBufferToWav } from '@/utils/wavEncoder';

/**
 * Client-side AI Cleanup DSP — offline-rendered Web Audio chains per tool.
 * Replaces the non-existent provider "enhance" endpoints with deterministic,
 * instant local processing. Returns a WAV Blob of the processed audio.
 */

// Build the filter chain for a tool inside the given (offline) context.
// Returns { input, output } nodes.
function buildChain(ctx, toolKey) {
  const nodes = [];
  const peak = (freq, gain, q = 1) => {
    const f = ctx.createBiquadFilter();
    f.type = 'peaking'; f.frequency.value = freq; f.Q.value = q; f.gain.value = gain;
    nodes.push(f);
  };
  const pass = (type, freq, q = 0.707) => {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    nodes.push(f);
  };
  const shelf = (type, freq, gain) => {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.gain.value = gain;
    nodes.push(f);
  };
  const comp = (threshold, ratio, attack = 0.01, release = 0.15) => {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = threshold; c.ratio.value = ratio;
    c.attack.value = attack; c.release.value = release; c.knee.value = 6;
    nodes.push(c);
  };
  const makeup = (g) => {
    const n = ctx.createGain(); n.gain.value = g; nodes.push(n);
  };

  switch (toolKey) {
    case 'denoise':
      pass('highpass', 55);                 // rumble
      shelf('highshelf', 9500, -5);         // tame broadband hiss
      peak(12500, -3, 1.2);
      makeup(1.05);
      break;
    case 'dehum':
      pass('highpass', 42);
      [50, 60, 100, 120, 180, 240].forEach(f => peak(f, -24, 28)); // mains hum + harmonics notches
      break;
    case 'declick':
      pass('lowpass', 15500);
      comp(-22, 6, 0.0008, 0.04);           // ultra-fast transient tamer
      makeup(1.12);
      break;
    case 'desibilance':
      peak(6500, -7, 3);                    // primary sibilance band
      peak(8200, -5, 3);
      break;
    case 'vocal_enhance':
      pass('highpass', 80);
      peak(320, -3, 1.4);                   // clear mud
      peak(3200, 4, 1.1);                   // presence
      shelf('highshelf', 11000, 3);         // air
      comp(-24, 2.5, 0.008, 0.18);
      makeup(1.15);
      break;
    case 'auto_enhance':
    default:
      pass('highpass', 40);
      [50, 60].forEach(f => peak(f, -18, 28));
      peak(350, -2, 1.3);
      peak(3000, 2.5, 1);
      shelf('highshelf', 11500, 2);
      comp(-18, 2, 0.01, 0.2);
      makeup(1.1);
      break;
  }

  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return { input: nodes[0], output: nodes[nodes.length - 1] };
}

/**
 * Fetch + decode + process an audio URL through the tool's chain.
 * @returns {Promise<Blob>} processed WAV blob
 */
export async function cleanupAudio(audioUrl, toolKey) {
  const resp = await fetch(audioUrl);
  if (!resp.ok) throw new Error('Could not load the audio file');
  const arrayBuf = await resp.arrayBuffer();

  const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = await decodeCtx.decodeAudioData(arrayBuf);
  decodeCtx.close();

  const ctx = new OfflineAudioContext(
    Math.min(2, source.numberOfChannels),
    source.length,
    source.sampleRate
  );
  const src = ctx.createBufferSource();
  src.buffer = source;
  const { input, output } = buildChain(ctx, toolKey);
  src.connect(input);
  output.connect(ctx.destination);
  src.start(0);

  const rendered = await ctx.startRendering();
  return audioBufferToWav(rendered, { bitDepth: 16 });
}