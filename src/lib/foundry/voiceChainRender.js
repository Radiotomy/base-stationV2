// Voice chain render — a Foundry utility patch applied to spoken-word audio.
//
// Deliberately the SAME build path as the mastering insert (buildFoundryInsert),
// so a chain that was auditioned in the Foundry sounds identical here. This is
// processing only: it shapes an existing recording and never originates speech,
// which is why nothing in this file touches an episode's declared origin.

import { buildFoundryInsert } from './foundryInsert';
import { decodeAudioFromUrl } from '@/utils/offlineMastering';
import { audioBufferToWav } from '@/utils/wavEncoder';

/**
 * Decode `sourceUrl`, pass it through `graph`, and return a 16-bit WAV File.
 * 16-bit is the right target for voice delivery — a podcast segment gains
 * nothing from 24-bit and pays for it in upload size.
 */
export async function renderVoiceChain(sourceUrl, graph, { filename = 'voice_chain.wav' } = {}) {
  const source = await decodeAudioFromUrl(sourceUrl);

  const ctx = new OfflineAudioContext(
    source.numberOfChannels,
    source.length,
    source.sampleRate,
  );

  const player = ctx.createBufferSource();
  player.buffer = source;

  const insert = await buildFoundryInsert(ctx, graph, { bpm: 120 });
  player.connect(insert.input);
  insert.output.connect(ctx.destination);

  player.start(0);
  const rendered = await ctx.startRendering();
  insert.dispose();

  const blob = audioBufferToWav(rendered, { bitDepth: 16 });
  return {
    file: new File([blob], filename, { type: 'audio/wav' }),
    duration: rendered.duration,
    sampleRate: rendered.sampleRate,
  };
}