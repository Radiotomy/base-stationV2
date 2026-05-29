import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Looks up a songwriter / recording artist by name and returns their
 * typical lyrical mood, style/genre, rhyme scheme, BPM and ideal song length
 * so the Lyrics Studio form can auto-fill itself in Pro mode.
 *
 * Output strictly matches the chips/values used by pages/LyricsStudio so
 * the frontend can apply them directly without translation.
 */

const MOOD_CHIPS  = ['Happy', 'Sad', 'Energetic', 'Melancholic', 'Romantic', 'Angry', 'Chill', 'Nostalgic', 'Triumphant'];
const STYLE_CHIPS = ['Hip-Hop', 'Pop', 'Rock', 'R&B', 'EDM', 'Indie', 'Country', 'Traditional Country', 'Red Dirt Country', 'Texas Country', 'Soul', 'Drill', 'Afrobeats', 'Lo-Fi', 'Jazz', 'Blues', 'Metal'];
const LENGTHS    = ['Short (8–16 bars)', 'Medium (32 bars)', 'Long (64+ bars)', 'Full Song'];
const RHYMES     = ['Mixed', 'ABAB', 'AABB', 'XAXA', 'ABBA', 'AAAA', 'AAAX'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { writer } = await req.json();
    if (!writer || typeof writer !== 'string' || writer.trim().length < 2) {
      return Response.json({ error: 'Missing writer name' }, { status: 400 });
    }

    const prompt = `You are a music A&R expert. Identify the most likely real songwriter or recording artist matching "${writer.trim()}" and describe their signature songwriting profile.

Return STRICT JSON only — choose values ONLY from these exact lists:
- moods (1–3): ${JSON.stringify(MOOD_CHIPS)}
- styles (1–3, genres they're most known for): ${JSON.stringify(STYLE_CHIPS)}
- length (one): ${JSON.stringify(LENGTHS)}
- rhyme_scheme (one): ${JSON.stringify(RHYMES)}
- bpm: integer 40–220 representing their typical tempo
- matched_name: the canonical artist name you matched
- confidence: 'high' | 'medium' | 'low'

If you cannot reasonably identify the writer, set confidence='low' and still return best-guess defaults.`;

    const data = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          matched_name:  { type: 'string' },
          moods:         { type: 'array', items: { type: 'string' } },
          styles:        { type: 'array', items: { type: 'string' } },
          length:        { type: 'string' },
          rhyme_scheme:  { type: 'string' },
          bpm:           { type: 'number' },
          confidence:    { type: 'string' },
        },
        required: ['matched_name', 'moods', 'styles', 'length', 'rhyme_scheme', 'bpm', 'confidence'],
      },
    });

    // Sanitize against allowed lists (LLM occasionally drifts)
    const moods  = (data.moods  || []).filter(m => MOOD_CHIPS.includes(m)).slice(0, 3);
    const styles = (data.styles || []).filter(s => STYLE_CHIPS.includes(s)).slice(0, 3);
    const length = LENGTHS.includes(data.length) ? data.length : 'Medium (32 bars)';
    const rhyme  = RHYMES.includes(data.rhyme_scheme) ? data.rhyme_scheme : 'Mixed';
    const bpm    = Math.max(40, Math.min(220, Math.round(Number(data.bpm) || 100)));

    return Response.json({
      matched_name:  data.matched_name || writer,
      moods:         moods.length  ? moods  : ['Energetic'],
      styles:        styles.length ? styles : ['Pop'],
      length,
      rhyme_scheme:  rhyme,
      bpm,
      confidence:    data.confidence || 'medium',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});