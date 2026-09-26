// Push a WAV into the open Audiotool session as a new audio region, via the
// Nexus Samples API (upload → wait for transcoding → insertSample).
import { logInvocation } from '@/lib/audiotool/nexusTelemetry';
import { unwrap as withReason } from '@/lib/audiotool/nexusErrors';

const TICKS_PER_BAR = 3840 * 4;

// Drop new material after the last audio region so nothing is overwritten.
const endOfAudioTimeline = (nexus) =>
  nexus.queryEntities.ofTypes('audioRegion').get().reduce((end, r) => {
    const f = r.fields.region.fields;
    return Math.max(end, f.positionTicks.value + f.durationTicks.value);
  }, 0);

const audioDeviceIds = (nexus) => new Set(nexus.queryEntities.ofTypes('audioDevice').get().map((d) => d.id));

/**
 * @param aiTool telemetry tool name when the asset is AI-generated — logged so
 *   the Creative Ownership meter counts the new audio device as machine-made.
 */

export async function sendToAudiotool({ at, nexus, projectUrl, file, name, bpm, aiTool, prompt }) {
  // Audiotool rejects a sample without a positive tempo (bpm is a REQUIRED field),
  // so one-shots with no known tempo get a neutral 120.
  const tempo = Number(bpm) > 0 ? Number(bpm) : 120;
  const upload = withReason(await at.samples.upload({
    file,
    displayName: name.slice(0, 60),
    bpm: tempo,
    kind: Number(bpm) > 0 ? 'loop' : 'one-shot',
  }));
  const sample = withReason(await upload.ready);

  const before = audioDeviceIds(nexus);
  const positionTicks = endOfAudioTimeline(nexus);
  await nexus.modify((t) => {
    t.insertSample(sample, {
      displayName: name.slice(0, 40),
      region: { positionTicks },
      // A known tempo locks the loop to the project grid.
      ...(bpm ? { sample: { bpm: Number(bpm) } } : {}),
    });
  });
  const deviceIds = [...audioDeviceIds(nexus)].filter((id) => !before.has(id));

  if (aiTool) await logInvocation(projectUrl, { tool: aiTool, prompt: prompt || name, deviceIds });
  return { bar: Math.floor(positionTicks / TICKS_PER_BAR) + 1 };
}