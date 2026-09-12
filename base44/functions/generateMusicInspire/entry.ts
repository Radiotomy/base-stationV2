// generateMusicInspire — submits a render to Inspire (our InspireMusic engine)
// and returns a job id immediately. Finalized by pollInspireJob, because a
// 300s long-form render with a 48kHz flow-matching pass runs for minutes and a
// synchronous wait would blow the function timeout.
//
// Two tasks share this entry point:
//   text-to-music — a prose description of the production.
//   continuation  — the same, plus one of the creator's OWN library tracks as an
//                   audio prompt the model keeps composing from. That render is
//                   labelled 'ai_assisted', because a human recording is part of
//                   the sound recording rather than merely part of the prompt.
//
// Credits are checked here but only DEDUCTED on completion.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  submitInspireJob, inspireBalance, resolveInspireModel,
  INSPIRE_COST, INSPIRE_MIN_DURATION, INSPIRE_MAX_DURATION, INSPIRE_DEFAULT_DURATION,
  INSPIRE_DEFAULT_MODEL, INSPIRE_SECTIONS, INSPIRE_INSTRUMENTAL_HINT,
} from '../../shared/inspireEngine.ts';
import { releaseMetadata } from '../../shared/trackMetadata.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      prompt, task, continuation_asset_id, section,
      duration, model, seed, title, genre, mood,
    } = await req.json();

    const safePrompt = String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, 600);
    if (!safePrompt) {
      return Response.json({ error: 'Describe the music you want Inspire to compose' }, { status: 400 });
    }

    const isContinuation = task === 'continuation';

    // The audio prompt must be one of the CALLER'S OWN assets, resolved
    // server-side. Accepting a raw URL from the client would let anyone feed
    // arbitrary audio (or another creator's private track) into a render and end
    // up with it as the seed of a new recording in their own library.
    let promptUrl = '';
    let promptAsset = null;
    if (isContinuation) {
      if (!continuation_asset_id) {
        return Response.json({ error: 'Pick a track from your library to continue from' }, { status: 400 });
      }
      promptAsset = await base44.entities.UserAsset.get(continuation_asset_id).catch(() => null);
      if (!promptAsset || promptAsset.user_id !== user.id) {
        return Response.json({ error: 'That track is not in your library' }, { status: 403 });
      }
      if (!promptAsset.file_url) {
        return Response.json({ error: 'That library item has no audio file' }, { status: 400 });
      }
      promptUrl = promptAsset.file_url;
    }

    const chosen = resolveInspireModel(model || INSPIRE_DEFAULT_MODEL);
    const safeSection = INSPIRE_SECTIONS.includes(String(section)) ? String(section) : 'intro';

    // Clamped to the CHOSEN checkpoint's own ceiling, not the global one: only
    // 1.5B-Long is trained for multi-minute coherence, so asking the standard
    // model for 300s would return audio that drifts rather than a longer piece.
    const numDur = Number(duration);
    const ceiling = Math.min(chosen.maxDuration, INSPIRE_MAX_DURATION);
    const safeDuration = Number.isFinite(numDur)
      ? Math.min(Math.max(Math.round(numDur), INSPIRE_MIN_DURATION), ceiling)
      : Math.min(INSPIRE_DEFAULT_DURATION, ceiling);

    const numSeed = Number(seed);
    const safeSeed = Number.isFinite(numSeed) && numSeed > 0 ? Math.round(numSeed) : undefined;

    const cost = INSPIRE_COST;
    const { balance } = await inspireBalance(base44, user.id);
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits', required: cost, balance,
        message: `Inspire generation costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    // Upstream reads English prose and has no vocal path — the instrumental
    // steer is appended once, here, so every render sends it.
    const engineText = `${safePrompt.replace(/[.,;\s]+$/, '')}. ${INSPIRE_INSTRUMENTAL_HINT}.`;

    let submitted;
    try {
      submitted = await submitInspireJob({
        task: isContinuation ? 'continuation' : 'text-to-music',
        text: engineText,
        audioPromptUrl: promptUrl,
        section: safeSection,
        duration: safeDuration,
        model: chosen.id,
        seed: safeSeed,
      });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 502 });
    }

    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'inspire',
      status: 'processing',
      // A continuation carries the creator's own recording INTO the output, so it
      // is assisted rather than generated. Recorded at submit, never inferred later.
      ai_label: isContinuation ? 'ai_assisted' : 'ai_generated',
      input_data: {
        prompt: safePrompt,
        engine_text: engineText,
        task: isContinuation ? 'continuation' : 'text-to-music',
        section: safeSection,
        duration: safeDuration,
        model: chosen.id,
        target_sample_rate: chosen.sampleRate,
        seed: safeSeed,
        continuation_asset_id: isContinuation ? continuation_asset_id : '',
        continuation_source_title: promptAsset?.title || '',
        continuation_source_url: promptUrl,
        title: title || '',
        credit_cost: cost,
        engine: 'hf_space', model_family: 'InspireMusic (Inspire)',
        ...releaseMetadata({ genre, mood }),
      },
      provider_job_id: submitted.jobId,
      started_at: new Date().toISOString(),
    });

    return Response.json({
      job_id: job.id,
      provider_job_id: submitted.jobId,
      status: 'processing',
      credit_cost: cost,
      duration: safeDuration,
      model: chosen.id,
      continuation_source_title: promptAsset?.title || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});