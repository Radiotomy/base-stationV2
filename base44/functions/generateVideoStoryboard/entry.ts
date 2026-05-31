// generateVideoStoryboard — turn a single creative prompt into a complete
// scene-by-scene storyboard for the music-video composer.
//
// Uses InvokeLLM to break the user's vibe into 6-8 vivid Pexels-friendly
// search queries, weights their durations to roughly match audio length,
// and suggests transitions between cuts.
//
// Payload:
//   { vibe: string, audioDuration?: number, aspectRatio?: '16:9'|'9:16'|'1:1' }
//
// Returns:
//   { scenes: [{ query, durationSeconds, transitionOut }] }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { vibe, audioDuration = 30, aspectRatio = '16:9' } = await req.json();
    if (!vibe?.trim()) {
      return Response.json({ error: 'vibe is required' }, { status: 400 });
    }

    const targetSceneCount = Math.max(4, Math.min(10, Math.round(audioDuration / 4)));

    const prompt = `You are a music video director. Break the following creative vibe into a ${targetSceneCount}-scene storyboard for a ${audioDuration}-second ${aspectRatio} music video.

VIBE: "${vibe}"

For each scene produce a SHORT (2-5 word) Pexels stock-footage search query that will return cinematic b-roll. Vary subjects and locations to keep the cuts visually interesting. Distribute durations so they sum to approximately ${audioDuration} seconds (each scene 2-8 seconds).

Suggest a transition out of each scene from: "cut", "crossfade", "wipe_left", "wipe_right", "slide_up", "slide_down". The last scene must be "cut". Crossfades suit emotional/dreamy moments, cuts suit energetic beats, wipes suit narrative shifts.

Return JSON ONLY.`;

    const llm = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          scenes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                durationSeconds: { type: 'number' },
                transitionOut: {
                  type: 'string',
                  enum: ['cut', 'crossfade', 'wipe_left', 'wipe_right', 'slide_up', 'slide_down'],
                },
              },
              required: ['query', 'durationSeconds', 'transitionOut'],
            },
          },
        },
        required: ['scenes'],
      },
    });

    const VALID = ['cut', 'crossfade', 'wipe_left', 'wipe_right', 'slide_up', 'slide_down'];
    const scenes = (llm?.scenes || []).map((s, i, arr) => {
      const t = s.transitionOut;
      const safe = VALID.includes(t) ? t : 'cut';
      return {
        query: String(s.query || '').trim(),
        durationSeconds: Math.max(1, Math.min(15, Math.round(s.durationSeconds || 4))),
        transitionOut: i === arr.length - 1 ? 'cut' : safe,
      };
    }).filter(s => s.query);

    if (scenes.length === 0) {
      return Response.json({ error: 'LLM returned no scenes' }, { status: 500 });
    }

    return Response.json({ scenes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});