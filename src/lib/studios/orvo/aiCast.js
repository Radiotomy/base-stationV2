// Starting roster for an AI-cast show. Mirrors DEFAULT_CAST in
// base44/shared/orvoAiShow.ts so a new show opens with a working two-hander the
// creator can edit, rather than an empty form.

export const DEFAULT_CAST = [
  {
    persona_id: 'host',
    name: 'Ash',
    role: 'host',
    voice_id: 'Ashley',
    provider: 'inworld',
    persona: 'Warm, curious lead host. Opens the show, sets up each topic and hands off to the others.',
  },
  {
    persona_id: 'guest_1',
    name: 'Miles',
    role: 'guest',
    voice_id: 'Mark',
    provider: 'inworld',
    persona: 'Direct, well-informed guest who answers with concrete examples rather than generalities.',
  },
];

export const AUTOPILOT_LABELS = {
  idle: 'Not scripted yet',
  scripted: 'Script ready — needs voicing',
  rendering: 'Voicing the cast…',
  ready: 'Ready to go on air',
  running: 'On air',
  finalizing: 'Archiving the episode…',
  done: 'Published',
  failed: 'Failed',
};