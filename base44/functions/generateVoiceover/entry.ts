import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

/**
 * ORVO Studio voiceover generation.
 *
 * Payload: {
 *   text: string,
 *   voice_id: string,
 *   provider: 'elevenlabs' | 'inworld',
 *   inworld_mode?: 'tts' | 'llm_plus_tts' | 'realtime',   // Phase 3
 *   model_id?: string,
 *   emotion_tags?: string[],                               // Inworld emotion steering (Phase 3)
 *   podcast_id?: string,
 *   title?: string
 * }
 *
 * ElevenLabs path: fully wired (ELEVENLABS_API).
 * Inworld path: fully wired (INWORLD_API_KEY) — tts and llm_plus_tts.
 * Realtime mode belongs to Phase 4 (OrvoLiveEvent) and is rejected here.
 */

const HOURLY_LIMIT = 30;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      text, voice_id, provider = 'elevenlabs',
      inworld_mode, model_id, emotion_tags, podcast_id, title,
    } = await req.json();

    if (!text || typeof text !== 'string') {
      return Response.json({ error: 'text is required' }, { status: 400 });
    }
    if (text.length > 5000) {
      return Response.json({ error: 'text exceeds 5000 character limit' }, { status: 400 });
    }

    // ── Simple per-user rate limit via entity counter ──
    const recent = await base44.asServiceRole.entities.OrvoPodcastAsset.filter(
      { user_id: user.id, asset_type: 'voiceover' }, '-created_date', HOURLY_LIMIT
    );
    const oneHourAgo = Date.now() - 3600_000;
    const inWindow = recent.filter((r) => new Date(r.created_date).getTime() > oneHourAgo);
    if (inWindow.length >= HOURLY_LIMIT) {
      return Response.json({ error: 'Voiceover rate limit reached — try again in an hour.' }, { status: 429 });
    }

    // ── Inworld path — Phase 3 ──
    if (provider === 'inworld') {
      const mode = inworld_mode || 'tts';
      if (mode === 'realtime') {
        return Response.json({
          error: 'Realtime live host is a Phase 4 capability (OrvoLiveEvent) — use tts or llm_plus_tts here.',
        }, { status: 400 });
      }

      const iwKey = secrets.get('INWORLD_API_KEY');
      if (!iwKey) return Response.json({ error: 'INWORLD_API_KEY not configured' }, { status: 500 });

      let speechText = text;

      // llm_plus_tts: generate the spoken script first, then voice it.
      if (mode === 'llm_plus_tts') {
        const script = await base44.integrations.Core.InvokeLLM({
          prompt: `You are scripting a podcast segment for spoken delivery. Write ONLY the words to be spoken — no headings, no stage directions, no speaker labels.
Keep it natural, conversational, and under 900 characters.
${emotion_tags?.length ? `Where it feels natural, insert these emotion steering tags inline: ${emotion_tags.join(', ')}.` : ''}

Brief: ${text}`,
        });
        speechText = typeof script === 'string' ? script.trim() : text;
      } else if (emotion_tags?.length && !/\[[a-z]+\]/i.test(speechText)) {
        // Plain TTS: prefix requested emotion steering so the tag applies from the start.
        speechText = `${emotion_tags.join(' ')} ${speechText}`;
      }

      const iwRes = await fetch('https://api.inworld.ai/tts/v1/voice', {
        method: 'POST',
        headers: { Authorization: `Basic ${iwKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: speechText,
          voiceId: voice_id || 'Ashley',
          modelId: model_id || 'inworld-tts-1',
        }),
      });
      if (!iwRes.ok) {
        const err = await iwRes.text();
        return Response.json({ error: `Inworld TTS failed (${iwRes.status}): ${err.slice(0, 300)}` }, { status: 502 });
      }

      const iwJson = await iwRes.json();
      const b64 = iwJson.audioContent || iwJson.result?.audioContent;
      if (!b64) return Response.json({ error: 'Inworld returned no audio content' }, { status: 502 });

      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const iwFile = new File([bin], 'orvo-voiceover.mp3', { type: 'audio/mpeg' });
      const { file_url: iwUrl } = await base44.integrations.Core.UploadFile({ file: iwFile });

      const iwAsset = await base44.entities.OrvoPodcastAsset.create({
        user_id: user.id,
        podcast_id: podcast_id || '',
        asset_type: 'voiceover',
        title: title || `Voiceover — ${speechText.slice(0, 40)}`,
        file_url: iwUrl,
        metadata: {
          provider: 'inworld',
          inworld_mode: mode,
          voice_id: voice_id || 'Ashley',
          model_id: model_id || 'inworld-tts-1',
          emotion_tags: emotion_tags || [],
          script: mode === 'llm_plus_tts' ? speechText : undefined,
        },
      });

      return Response.json({
        file_url: iwUrl,
        asset_id: iwAsset.id,
        provider: 'inworld',
        mode,
        script: mode === 'llm_plus_tts' ? speechText : undefined,
      });
    }

    // ── ElevenLabs path — fully wired ──
    if (!voice_id) return Response.json({ error: 'voice_id is required for ElevenLabs' }, { status: 400 });
    const elKey = secrets.get('ELEVENLABS_API');
    if (!elKey) return Response.json({ error: 'ELEVENLABS_API not configured' }, { status: 500 });

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': elKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: model_id || 'eleven_multilingual_v2',
        }),
      }
    );
    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      return Response.json({ error: `ElevenLabs TTS failed (${ttsRes.status}): ${err.slice(0, 300)}` }, { status: 502 });
    }
    const audioBytes = await ttsRes.arrayBuffer();

    // Persist to storage and record the asset
    const file = new File([audioBytes], 'orvo-voiceover.mp3', { type: 'audio/mpeg' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    const asset = await base44.entities.OrvoPodcastAsset.create({
      user_id: user.id,
      podcast_id: podcast_id || '',
      asset_type: 'voiceover',
      title: title || `Voiceover — ${text.slice(0, 40)}`,
      file_url,
      metadata: { provider: 'elevenlabs', voice_id, model_id: model_id || 'eleven_multilingual_v2', emotion_tags: emotion_tags || [] },
    });

    return Response.json({ file_url, asset_id: asset.id, provider: 'elevenlabs' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}