import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Dedicated LLM Lyrics Generation (Claude Sonnet) ──────────────────────────
async function generateWithLLM(base44, { topic, mood, style, length, rhyme_scheme, structure }) {

  const rhymeGuide = {
    'ABAB': 'Alternate rhyme (ABAB): lines 1 & 3 rhyme, lines 2 & 4 rhyme with a different sound. Most popular rap/pop scheme.',
    'AABB': 'Couplet (AABB): first two lines rhyme together, next two lines rhyme together with a different sound.',
    'XAXA': 'Conversational (XAXA): only lines 2 & 4 rhyme. Lines 1 & 3 are free. Sounds natural, modern, less predictable.',
    'ABBA': 'Envelope (ABBA): lines 1 & 4 rhyme, lines 2 & 3 rhyme. Creates a satisfying wrap-around feel.',
    'AAAA': 'Monorhyme (AAAA): all four lines rhyme — powerful for building tension or a hook.',
    'AAAX': 'Tension release (AAAX): first three lines rhyme, final line breaks with fewer syllables for impact (e.g. Coldplay "Fix You").',
    'Mixed': 'Mix schemes freely per section: use AABB in verses for storytelling, AAAA or ABAB in the chorus for impact, and XAXA in pre-chorus for conversational tension.',
  };

  const structureGuide = structure || (
    style === 'Hip-Hop' || style === 'Drill' || style === 'Trap'
      ? '[Intro]\n[Verse 1]\n[Hook]\n[Verse 2]\n[Hook]\n[Verse 3]\n[Outro]'
      : '[Intro]\n[Verse 1]\n[Pre-Chorus]\n[Chorus]\n[Verse 2]\n[Pre-Chorus]\n[Chorus]\n[Bridge]\n[Chorus]\n[Outro]'
  );

  const selectedRhyme = rhyme_scheme || 'Mixed';
  const rhymeInstruction = rhymeGuide[selectedRhyme] || rhymeGuide['Mixed'];

  const lengthMap = {
    'Short (8–16 bars)': '2 short sections (intro + chorus), ~16 lines total',
    'Medium (32 bars)': '~32 bars — verse, pre-chorus, chorus, verse, chorus, bridge, outro',
    'Long (64+ bars)': 'Full song — 2 verses, pre-chorus, chorus x3, bridge, outro',
    'Full Song': 'Complete radio-ready song — intro, 2 verses, pre-chorus, 3 choruses, bridge, outro, ~60-80 lines',
  };

  const prompt = `You are a Grammy-winning ${style} songwriter with deep expertise in rhyme craft, cadence, and emotional storytelling. Write a complete, original hit song about: "${topic}".

STYLE: ${style} | MOOD: ${mood} | LENGTH: ${lengthMap[length] || length}

RHYME SCHEME: ${rhymeInstruction}

PROFESSIONAL SONGWRITING RULES — FOLLOW ALL OF THESE:
1. **Hook first mindset**: The chorus/hook must be the most memorable, singable, emotionally powerful part. It should be repeatable and instantly catchy.
2. **Syllabic consistency**: Each line within a section must have a consistent syllable count and rhythmic stress pattern so it flows naturally over a beat.
3. **Internal rhymes**: Don't just rhyme at line ends — use internal rhymes within lines to add texture and flow (e.g. "I ride with my pride, can't hide what's inside").
4. **Near rhymes are fine**: Use slant/near rhymes (e.g. "time" / "mine", "love" / "enough") — they sound more natural than forced perfect rhymes.
5. **Multisyllabic rhymes**: For ${style === 'Hip-Hop' || style === 'Drill' ? 'Hip-Hop/Rap' : style}, use multisyllabic rhymes where the rhyme spans 2+ syllables (e.g. "recognize" / "enterprise").
6. **Verse = storytelling**: Verses move the narrative forward — specific imagery, character, situation. Show don't tell.
7. **Chorus = universal emotion**: The chorus is the emotional peak everyone relates to — broad, powerful, repeatable. Use the title/theme word here.
8. **Bridge = perspective shift**: The bridge breaks the pattern, introduces a new angle, emotional turn, or resolution.
9. **Genre authenticity**: Write with authentic ${style} vocabulary, cadence, cultural references, and flow patterns.
10. **No filler lines**: Every line must earn its place — no generic padding like "yeah yeah" or "uh uh" unless it serves the rhythm.

STRUCTURE TO FOLLOW:
${structureGuide}

Label each section clearly with [Section Name] tags.
Output ONLY the song lyrics — no explanations, no commentary, no titles outside the lyrics.`;

  const result = await base44.integrations.Core.InvokeLLM({ prompt, model: 'claude_sonnet_4_6' });
  return { lyrics: result, provider: 'llm_fallback', credits_used: 2 };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, mood = 'Happy', style = 'Hip-Hop', length = 'Medium (32 bars)', rhyme_scheme, structure } = await req.json();
    if (!topic) return Response.json({ error: 'Missing topic' }, { status: 400 });

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'lyrics', provider: 'core',
      status: 'processing',
      input_data: { topic, mood, style, length },
      started_at: new Date().toISOString(),
    });

    // Dedicated Claude Sonnet lyrics generation
    const result = await generateWithLLM(base44, { topic, mood, style, length, rhyme_scheme, structure });

    if (!result?.lyrics) {
      await base44.entities.GenerationJob.update(job.id, { status: 'failed', error_message: 'All providers failed' });
      return Response.json({ error: 'Failed to generate lyrics' }, { status: 502 });
    }

    await base44.entities.GenerationJob.update(job.id, {
      status: 'completed',
      credits_used: result.credits_used || 1,
      completed_at: new Date().toISOString(),
    });

    // Content hash for legal provenance
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(`${user.id}|${result.provider}|${topic}|${mood}|${style}|${result.lyrics.slice(0, 100)}`));
    const contentHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    await base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: result.provider, task: 'generate_lyrics',
      credits_used: result.credits_used || 1,
      status: 'success', timestamp: new Date().toISOString(), job_id: job.id,
      metadata: {
        model_version: 'claude_sonnet_4_6',
        input_parameters: { topic: topic.slice(0, 100), mood, style, length, rhyme_scheme: rhyme_scheme || 'Mixed' },
        output_details: { lyrics_length: result.lyrics.length, has_title: !!result.title },
        generated_timestamp: new Date().toISOString(),
        content_hash: contentHash,
      },
    }).catch(() => {});

    return Response.json({
      job_id: job.id, status: 'completed',
      lyrics: result.lyrics,
      title: result.title,
      provider: result.provider,
      credits_used: result.credits_used,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});