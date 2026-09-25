// Executes one audience command inside the host's live Audiotool session.
// Inserts land after the current end of the timeline, so playback is never interrupted.
import { runForgeLoop, runSfx } from '@/lib/audiotool/songstarterGen';
import { loadAsWavFile } from '@/lib/audiotool/localAudio';
import { sendToAudiotool } from '@/lib/audiotool/sendToAudiotool';
import { generatePattern, writePattern } from '@/lib/audiotool/midiPattern';
import { logInvocation } from '@/lib/audiotool/nexusTelemetry';
import { loopCategory } from '@/lib/venue/coopCommands';

export async function runCoopCommand({ at, nexus, projectUrl, bpm }, cmd) {
  const name = `${cmd.user}: ${cmd.prompt}`.slice(0, 40);
  const prompt = `[audience: ${cmd.user}] ${cmd.prompt}`;

  if (cmd.kind === 'midi') {
    const pattern = await generatePattern(cmd.prompt, 4);
    const { bar, collectionId } = await writePattern(nexus, pattern, name);
    await logInvocation(projectUrl, { tool: 'midi_coproducer', prompt, collectionIds: [collectionId] });
    return { bar };
  }

  const out = cmd.kind === 'sfx'
    ? { ...(await runSfx({ text: cmd.prompt, duration: 4 })), bpm: undefined }
    : await runForgeLoop({ prompt: cmd.prompt, category: loopCategory(cmd.prompt), bpm, duration: 8 });
  const file = await loadAsWavFile(out.audioUrl, name);
  return sendToAudiotool({
    at, nexus, projectUrl, file, name, bpm: out.bpm, prompt,
    aiTool: cmd.kind === 'sfx' ? 'songstarter_sfx' : 'songstarter_loop',
  });
}