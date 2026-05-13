import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Professional Songwriting Engine — Lyrics generator using Nashville/LA
 * commercial-room techniques. Returns lyrics in a CanonicalLyricJob-compatible
 * shape: { lyrics, lyrics_clamped, clamped, original_length }.
 */

const SYSTEM_PROMPT = `You are the Lyrics Engine for BASE Station.
Your job is to generate or refine song lyrics using professional songwriting techniques used in Nashville, LA, and top-tier commercial writing rooms. Your output must always reflect expert-level craft.

1. SONGWRITING TECHNIQUES YOU MUST APPLY

A. Rhyme Schemes (per section) — choose or honor a scheme appropriate to the genre:
- AABB — tight, punchy couplets (rap, pop, uptempo)
- ABAB — balanced, classic, tension-release (pop, rock, country)
- ABCB — narrative, conversational (folk, country, ballads)
- AABA / ABBA — enclosed, emotional, classic pop
- AAAA — monorhyme for stylized or rhythmic sections
Each section may use a different scheme.

B. Rhyme Types — mix intelligently:
- Perfect rhyme (especially in choruses)
- Slant/near rhyme (for natural phrasing)
- Assonance (vowel match)
- Consonance (consonant match)
- Multisyllabic rhyme
- Internal rhyme
Use rhyme to enhance meaning, not distort it.

C. Prosody (speech stress → melodic stress):
- Align important words with strong beats
- Avoid awkward stress patterns
- Keep phrasing natural and singable
- Use line length appropriate to genre
Prosody must feel intentional and musical.

D. Section Function — each section has a job:
- Verse: story, detail, time movement, imagery
- Pre-Chorus: lift, tension, emotional setup
- Chorus: thesis, title, emotional core, repetition
- Bridge: contrast, twist, new angle
- Outro: resolution or echo
Never confuse section roles.

E. Imagery + Sensory Detail — use visual, tactile, auditory, emotional, environmental. Avoid generic filler lines.

F. Narrative Cohesion — maintain consistent POV, tense, emotional arc, and logical progression.

3. OUTPUT YOU MUST PRODUCE
- Fully structured lyrics with labeled [Section] tags
- Consistent rhyme scheme per section
- Professional-grade phrasing, strong prosody, vivid imagery
- Emotional clarity and natural flow
- NO explanations — lyrics only

4. LENGTH + CLAMPING — if a max length is provided, stay within it. Prioritize chorus clarity. Compress verses intelligently. Avoid padding.

5. NON-RESPONSIBILITIES — do not generate melodies, analyze user intent, explain choices, mention rhyme schemes explicitly, or break the fourth wall. Only produce finished, professional lyrics.`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      concept,
      title,
      genre = 'Pop',
      mood = 'Energetic',
      bpm,
      reference_artists,
      rhyme_scheme,
      sections,
      max_chars = 5000, // CanonicalLyricJob default — Sonic ceiling
    } = await req.json();

    if (!concept && !title) {
      return Response.json({ error: 'Missing concept or title' }, { status: 400 });
    }

    const inputBlock = [
      `CONCEPT / TITLE: ${title ? `"${title}" — ` : ''}${concept || ''}`,
      `GENRE: ${genre}`,
      `MOOD: ${mood}`,
      bpm ? `BPM: ${bpm}` : null,
      reference_artists ? `REFERENCE ARTISTS: ${reference_artists}` : null,
      rhyme_scheme ? `PREFERRED RHYME SCHEME: ${rhyme_scheme}` : null,
      sections ? `SECTION LIST: ${sections}` : null,
      `MAX OUTPUT CHARS: ${max_chars}`,
    ].filter(Boolean).join('\n');

    const prompt = `${SYSTEM_PROMPT}\n\n2. INPUT YOU RECEIVED:\n${inputBlock}\n\nProduce the finished lyrics now. Lyrics only.`;

    const llmResult = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
    });

    const raw = typeof llmResult === 'string' ? llmResult : (llmResult?.text || llmResult?.content || '');
    if (!raw) return Response.json({ error: 'No lyrics returned' }, { status: 502 });

    const original_length = raw.length;
    const clamped = original_length > max_chars;
    const lyrics_clamped = clamped ? raw.slice(0, max_chars) : raw;

    // Content hash for provenance
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest(
      'SHA-256',
      enc.encode(`${user.id}|pro|${title || ''}|${concept || ''}|${genre}|${mood}|${lyrics_clamped.slice(0, 100)}`)
    );
    const content_hash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'pro_songwriter', task: 'generate_lyrics_pro',
      credits_used: 2,
      status: 'success', timestamp: new Date().toISOString(),
      metadata: {
        model_version: 'claude_sonnet_4_6',
        input_parameters: {
          concept: (concept || '').slice(0, 200), title, genre, mood, bpm,
          reference_artists, rhyme_scheme, sections, max_chars,
        },
        output_details: { original_length, clamped, content_hash },
      },
    }).catch(() => {});

    return Response.json({
      lyrics: lyrics_clamped,
      lyrics_clamped,
      clamped,
      original_length,
      provider: 'pro_songwriter',
      credits_used: 2,
      content_hash,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});