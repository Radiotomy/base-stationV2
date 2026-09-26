// Shared wiring for Audiotool's pattern instruments (Beatbox 8, Bassline,
// Tonematrix): create the device on the desktop, cable it into a fresh mixer
// channel, and attach a pattern to its first slot. Runs inside nexus.modify.
import { nextStripOrder } from '@/lib/audiotool/nexusOrdering';

export function createPatternDevice(t, { type, patternType, name, pattern = {} }) {
  const row = t.entities.ofTypes('mixerChannel').get().length;
  const device = t.create(type, {});
  t.update(device.fields.positionX, 200);
  t.update(device.fields.positionY, 300 + row * 420);
  t.update(device.fields.displayName, name.slice(0, 40));

  const channel = t.create('mixerChannel', { displayParameters: { orderAmongStrips: nextStripOrder(t) } });
  t.create('desktopAudioCable', { fromSocket: device.fields.audioOutput.location, toSocket: channel.fields.audioInput.location });

  const pat = t.create(patternType, { slot: device.fields.patternSlots.array[0].location, ...pattern });
  return { device, steps: pat.fields.steps.array };
}