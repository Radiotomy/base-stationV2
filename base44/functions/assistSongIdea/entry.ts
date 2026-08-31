// assistSongIdea — the FREE, light songwriting assistant.
//
// A creator types one plain description ("a breakup song about leaving Tulsa at
// 3am") and gets back a complete, usable starting point: title, genre, mood, BPM,
// key, a production brief and real singable lyrics.
//
// DELIBERATELY NEUTRAL OUTPUT. This function does NOT format for any particular
// engine. It returns one canonical brief, and the FRONTEND translates it into
// whichever dialect the target model speaks (Coda wants dense comma tokens,
// Siren Song wants tag tokens, Skye wants prose). Formatting here would mean
// three near-identical prompts drifting apart, and would put model-specific
// knowledge in two places at once.
//
// FREE TO THE CREATOR — no credit deduction, unlike generate243Masters (the
// heavyweight craft engine). That is the whole point: nobody should have to spend
// credits to find out what they want to make. The cost is carried by the platform,
// so the call is rate-limited rather than metered.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeRateLimit, rateLimitResponse } from '../../shared/rateLimit.ts';

// Canonical section vocabulary. Every dialect converter in the app maps FROM
// these, so emitting anything else just gets coerced downstream — better to
// constrain the model than to normalize its improvisation.
const SECTIONS = '[Intro], [Verse], [Pre-Chorus], [Chorus], [Bridge], [Breakdown], [Instrumental], [Outro]';

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short evocative song title, no quotes' },
    genre: { type: 'string', description: 'One lowercase primary genre, e.g. country, r&b, hip-hop, pop, rock, edm, lo-fi, soul, folk, afrobeats' },
    mood: { type: 'string', description: 'One or two lowercase mood words, e.g. "melancholy", "defiant"' },
    bpm: { type: 'number', description: 'Tempo in BPM appropriate to the genre and mood' },
    key: { type: 'string', description: 'Musical key, e.g. "A minor", "Eb major"' },
    production_brief: { type: 'string', description: 'One or two sentences naming instrumentation, rhythm section and production character. No section-by-section breakdown.' },
    vocal_description: { type: 'string', description: 'Short description of the intended lead vocal — range, grit, delivery. Empty string for an instrumental.' },
    lyrics: { type: 'string', description: 'Complete lyrics using ONLY the allowed bracketed section headers. Empty string for an instrumental.' },
  },
  required: ['title', 'genre', 'mood', 'bpm', 'key', 'production_brief', 'lyrics'],
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const description = String(body?.description || '').trim();
    const instrumental = body?.instrumental === true;
    // Length only shapes how much lyric to write — it is never sent to a model
    // from here, so an odd value cannot break a downstream generation.
    const seconds = Math.min(Math.max(Number(body?.duration) || 120, 20), 360);

    if (!description) {
      return Response.json({ error: 'Describe the song you want in a sentence or two.' }, { status: 400 });
    }
    if (description.length > 1500) {
      return Response.json({ error: 'Description is too long — keep it under 1500 characters.' }, { status: 400 });
    }

    const gate = await consumeRateLimit(base44, 'song_assist', user);
    if (!gate.allowed) return rateLimitResponse(gate, 'song_assist');

    // Roughly how much lyric actually fits. Over-writing is the most common way
    // an assisted song gets truncated mid-verse by the generator downstream.
    const sectionBudget = seconds < 60 ? '2 short sections' : seconds < 150 ? '3 to 4 sections' : '5 to 6 sections';

    const prompt = [
      'You are a professional songwriter and record producer helping a creator turn a rough idea into a song they can generate immediately.',
      '',
      `THE CREATOR'S IDEA: ${description}`,
      '',
      `TARGET LENGTH: about ${seconds} seconds, so write ${sectionBudget}.`,
      instrumental
        ? 'This is an INSTRUMENTAL. Return an empty string for both lyrics and vocal_description, and make the production brief carry the whole idea.'
        : 'This is a VOCAL SONG. Write real, singable, specific lyrics — concrete images and plain human language, never generic filler like "feel the fire in my soul".',
      '',
      'HARD RULES:',
      `1. Section headers must be EXACTLY one of: ${SECTIONS}. Nothing else.`,
      '2. A header sits alone on its own line, with a blank line before it.',
      '3. NEVER put performance notes, annotations or parentheticals in a header or on a lyric line. Every AI music model sings those out loud, word for word. Put that guidance in production_brief instead.',
      '4. Choose a BPM and key that genuinely suit the genre and mood — these get sent to the model as hard conditioning, so a wrong tempo fights the vocal phrasing.',
      '5. production_brief must name the RHYTHM SECTION explicitly (what the drums and bass are doing). Leaving it unnamed is what makes these models improvise a different band every section.',
      '6. Repeat the chorus lyric verbatim wherever the chorus recurs — do not write a variation each time unless the idea calls for it.',
    ].join('\n');

    const brief = await base44.integrations.Core.InvokeLLM({
      prompt,
      // Deliberately the cheap fast model: this is a free, high-frequency
      // starting-point generator, not the heavyweight craft engine. Quality here
      // is bounded by the schema and rules above far more than by model size.
      model: 'gpt_5_mini',
      response_json_schema: SCHEMA,
    });

    if (!brief || typeof brief !== 'object') {
      return Response.json({ error: 'The assistant could not draft this idea — try rephrasing it.' }, { status: 502 });
    }

    return Response.json({
      brief: {
        title: String(brief.title || '').slice(0, 80),
        genre: String(brief.genre || '').toLowerCase().trim(),
        mood: String(brief.mood || '').toLowerCase().trim(),
        bpm: Number(brief.bpm) || null,
        key: String(brief.key || '').trim(),
        production_brief: String(brief.production_brief || '').trim(),
        vocal_description: String(brief.vocal_description || '').trim(),
        lyrics: instrumental ? '' : String(brief.lyrics || '').trim(),
      },
      free: true,
      remaining: gate.remaining,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}