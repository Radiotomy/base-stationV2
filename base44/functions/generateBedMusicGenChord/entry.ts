import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { submitBed, CADENCE_ENGINE, MAX_BED_SECONDS } from '../../shared/cadenceEngine.ts';
import { normalizeChordChart, countBars } from '../../shared/chordNotation.ts';

/**
 * Render an instrumental bed that plays a lead sheet's authored progression.
 *
 * Payload: { leadSheetId, style, duration }
 * Returns: { data: { job_id, status, provider: 'musicgenchord' } }
 *
 * Runs on Cadence, our own HF Space (see base44/shared/cadenceEngine.ts). The
 * progression is read from the STORED LeadSheet, never from the request body: a bed
 * conditioned on chords the platform never recorded could not be traced back to an
 * authored score, which is the only thing separating this from prompt-to-audio.
 *
 * The normalized Harte form is recorded alongside the writer's own notation so a
 * render stays reproducible even if the normalizer is later improved.
 *
 * FREE BY DECISION, NOT BY ACCIDENT. Cadence runs Meta's musicgen-melody weights
 * (CC-BY-NC 4.0), so its beds are non-commercial drafting material — charging credits
 * for them would be monetary compensation in connection with the licensed material.
 * Commercial beds route to Skye (Apache-2.0), which is prompt-conditioned and carries
 * no chord-adherence claim. The cost is recorded as 0 on the job so the poller's
 * deduction path stays inert.
 */

const BED_COST = 0;

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

    const authored = (sheet.chord_chart || '').trim();
    if (!authored) {
      return Response.json({ error: 'This score has no chord chart to play' }, { status: 400 });
    }

    const textChords = normalizeChordChart(authored);
    if (!textChords) {
      return Response.json({
        error: 'No chords could be read from this chart. Use symbols like "C | Am | F | G7".',
      }, { status: 400 });
    }

    const seconds = Math.min(Math.max(Math.round(Number(duration) || 30), 8), MAX_BED_SECONDS);

    const engineJobId = await submitBed({
      prompt: String(style).slice(0, 400),
      text_chords: textChords,
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
        chord_chart: authored,
        chord_chart_normalized: textChords,
        bar_count: countBars(authored),
        style,
        bpm: sheet.bpm,
        key: sheet.key,
        time_signature: sheet.time_signature,
        duration: seconds,
        credit_cost: BED_COST,
        engine: CADENCE_ENGINE,
      },
      provider_job_id: engineJobId,
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
        provider_job_id: engineJobId,
        engine: CADENCE_ENGINE,
      },
    }).catch(() => {});

    return Response.json({
      data: { job_id: job.id, status: 'processing', provider: 'musicgenchord' },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});