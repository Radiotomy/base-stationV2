// Pulls the generation-ready pieces out of a Maestro chat reply.
// Maestro writes prose around its craft output, so the draft is extracted
// rather than assumed — nothing generates unless a lyric was actually found.

import { resolveModelId } from '@/config/musicModelCatalog';

const STYLE_LABEL = /(?:\*\*)?(?:Style Brief|Sound Prompt|Style Prompt|Production Brief)(?:\*\*)?\s*[:\-—]?\s*/i;

export function parseMaestroDraft(text = '') {
  if (!text) return null;

  const title = text.match(/(?:^|\n)\s*(?:\*\*)?(?:Song\s+)?Title(?:\*\*)?\s*[:\-—]\s*"?([^"\n*]+)"?/i)?.[1]?.trim() || '';
  const combination = text.match(/(?:Master Synthesis Combination|Synthesis Combination|Combination)(?:\*\*)?\s*[:\-—]\s*"?([^"\n*]+)"?/i)?.[1]?.trim() || '';

  const styleMatch = text.match(new RegExp(STYLE_LABEL.source + '([\\s\\S]*?)(?:\\n\\s*\\n|$)', 'i'));
  const soundPrompt = styleMatch?.[1]?.replace(/\*/g, '').trim() || '';

  // Lyrics start at the first section tag and run to the style brief (or the end)
  const start = text.search(/\[(?:intro|verse|pre[- ]?chorus|chorus|hook)/i);
  let lyrics = '';
  if (start !== -1) {
    const tail = text.slice(start);
    const styleIdx = tail.search(STYLE_LABEL);
    lyrics = (styleIdx > 0 ? tail.slice(0, styleIdx) : tail).replace(/\*\*/g, '').trim();
  }

  if (!lyrics) return null;
  return { title, combination, sound_prompt: soundPrompt, lyrics };
}

// Maestro may argue for a different model than the platform default. It is only
// ever a SUGGESTION: the id is resolved against our own catalog and offered to
// the creator, never applied on its own.
export function parseMaestroModelRecommendation(text = '') {
  const line = text.match(
    /(?:Recommended Model|Suggested Model|Model Recommendation|Best Model)\s*[:\-—]\s*([^\n*]+)/i
  )?.[1];
  if (!line) return null;
  const [namePart, ...rest] = line.split(/[—–|(]/);
  const hit = resolveModelId(namePart.replace(/\*/g, '').trim());
  if (!hit) return null;
  return {
    ...hit,
    reason: rest.join(' ').replace(/[)\*]/g, '').trim(),
  };
}