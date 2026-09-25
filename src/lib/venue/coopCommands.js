// Audience co-op chat commands: /generate sfx|loop|midi <prompt>
export const venueChatId = (venueId) => `venue:${venueId}`;

export const COOP_HELP = 'Try /generate sfx explosion, /generate loop bassline or /generate midi funky chord stabs';

const RE = /^\/generate\s+(sfx|loop|midi)\s+(.{2,120})$/i;

/** null = not a command; { error } = malformed; { kind, prompt } = valid. */
export function parseCommand(text) {
  const t = (text || '').trim();
  if (!/^\/generate\b/i.test(t)) return null;
  const m = t.match(RE);
  if (!m) return { error: COOP_HELP };
  return { kind: m[1].toLowerCase(), prompt: m[2].trim() };
}

export function loopCategory(prompt) {
  if (/bass|808|sub/i.test(prompt)) return 'bass_loop';
  if (/drum|beat|break|hat|kick|snare|perc/i.test(prompt)) return 'drum_loop';
  if (/vocal|voice|chop/i.test(prompt)) return 'vocal_chop';
  if (/melod|chord|keys|piano|synth|lead|pad|guitar/i.test(prompt)) return 'melodic_loop';
  return 'loop';
}