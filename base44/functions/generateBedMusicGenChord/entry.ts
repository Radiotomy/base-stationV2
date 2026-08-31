import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { startBed, MUSICGEN_CHORD_MODEL, MAX_BED_SECONDS } from '../../shared/musicGenChord.ts';

/**
 * Render an instrumental bed that plays a lead sheet's authored progression.
 *
 * Payload: { leadSheetId, style, duration }
 * Returns: { data: { job_id, status, provider: 'musicgenchord' } }
 *
 * The progression is read from the stored LeadSheet, never from the request body —
 * same rule as the vocal path. A bed conditioned on chords the platform never
 * recorded could not be traced back to an authored score, which is the only thing
 * that makes this different from prompt-to-audio.
 *
 * Credits are deducted by pollMusicGenChordBed on completion.
 */

// Replicate GPU time is a real per-call cost, unlike our self-hosted engines.
const BED_COST = 6;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { leadSheetId, style, duration } = await req.json();
    if (!leadSheetId) return Response.json({ error: 'leadSheetId required' }, { status: 400 });
    if (!style) return Response.json({ error: 'style required' }, { status: 400 });

    const sheets = await base44.entities.LeadSheet.filter({ id: leadSheetId });
    const sheet = sheets[0];
    if (!sheet) return Response.json({ error: 'Lead sheet not found' }, { status: 404 });
    if (sheet.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const chords = (sheet.chord_chart || '').trim();
    if (!chords) {
      return Response.json({ error: 'This score has no chord chart to play' }, { status: 400 });
    }

    const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = recs[0]?.balance ?? 0;
    if (balance < BED_COST) {
      return Response.json({
        error: 'Insufficient credits',
        required: BED_COST,
        balance,
        message: `An instrumental bed costs ${BED_COST} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    const seconds = Math.min(Math.max(Math.round(Number(duration) || 30), 8), MAX_BED_SECONDS);

    const prediction = await startBed({
      prompt: String(style).slice(0, 400),
      text_chords: chords,
      bpm: sheet.bpm || 120,
      time_sig: sheet.time_signature || '4/4',
      duration: seconds,
    });

    const startedAt = new Date().toISOString();
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id,
      user_email: user.email,
      job_type: 'music',
      provider: 'musicgenchord',
      status: 'processing',
      // The harmony is the creator's; the arrangement is the model's.
      ai_label: 'ai_assisted',
      input_data: {
        action: 'lead_sheet_bed',
        lead_sheet_id: leadSheetId,
        score_hash: sheet.score_hash,
        source_title: sheet.title,
        chord_chart: chords,
        style,
        bpm: sheet.bpm,
        key: sheet.key,
        time_signature: sheet.time_signature,
        duration: seconds,
        credit_cost: BED_COST,
        engine: MUSICGEN_CHORD_MODEL,
      },
      provider_job_id: prediction.id,
      started_at: startedAt,
    });

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'musicgenchord', task: 'lead_sheet_bed',
      credits_used: 0, status: 'pending',
      timestamp: startedAt, job_id: job.id,
      metadata: {
        action: 'lead_sheet_bed',
        lead_sheet_id: leadSheetId,
        provider_job_id: prediction.id,
        engine: MUSICGEN_CHORD_MODEL,
      },
    }).catch(() => {});

    return Response.json({
      data: { job_id: job.id, status: 'processing', provider: 'musicgenchord' },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});