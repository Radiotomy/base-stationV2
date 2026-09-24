// Turns a creator's prompt into the kind of caption InspireMusic was trained on.
// The model was trained on long, descriptive English captions ("A soothing
// instrumental piece blending light music and pop, featuring a gentle guitar
// rendition…"), so a short phrase like "rock and blues with horns" leaves most of
// the text encoder with nothing to read. Genre and mood are folded in here — they
// were previously saved on the job but never reached the engine.

const INSTRUMENTAL = 'purely instrumental with no vocals';
const EXPAND_BELOW_WORDS = 25;

function plain({ prompt, genre, mood }: { prompt: string; genre?: string; mood?: string }) {
  const style = [mood, genre].filter(Boolean).join(' ');
  const body = prompt.replace(/[.,;\s]+$/, '');
  return style ? `A ${style} instrumental piece: ${body}` : body;
}

function finish(text: string) {
  const t = text.replace(/\s+/g, ' ').trim().replace(/[.,;\s]+$/, '');
  return /no vocals/i.test(t) ? `${t}.` : `${t}, ${INSTRUMENTAL}.`;
}

export async function buildInspireCaption(
  base44,
  { prompt, genre, mood }: { prompt: string; genre?: string; mood?: string },
): Promise<{ caption: string; source: 'as_written' | 'expanded' }> {
  const fallback = finish(plain({ prompt, genre, mood }));
  if (prompt.split(/\s+/).length >= EXPAND_BELOW_WORDS) return { caption: fallback, source: 'as_written' };

  // Expansion is a quality aid, never a gate: if it fails the render still goes
  // out with the deterministic caption rather than refusing a paid job.
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Rewrite this music request as ONE descriptive English caption (35-60 words) in the style used to train the InspireMusic model, e.g. "A captivating classical piano performance, this piece exudes a dynamic and intense atmosphere, showcasing intricate and expressive instrumental artistry."

Rules: keep every instrument, genre and feel the creator named; do not add vocals, lyrics, artist names or song titles; describe instrumentation, groove, energy and atmosphere; the piece is instrumental.

Creator request: "${prompt}"
${genre ? `Genre: ${genre}\n` : ''}${mood ? `Mood: ${mood}\n` : ''}`,
      response_json_schema: { type: 'object', properties: { caption: { type: 'string' } } },
    });
    const caption = String(res?.caption || '').trim();
    if (caption.length < 20) return { caption: fallback, source: 'as_written' };
    return { caption: finish(caption.slice(0, 500)), source: 'expanded' };
  } catch {
    return { caption: fallback, source: 'as_written' };
  }
}