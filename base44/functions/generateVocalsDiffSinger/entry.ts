import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { submitCantorJob, CANTOR_ENGINE } from '../../shared/diffSinger.ts';

/**
 * Render a lead sheet's melody as sung vocals on Cantor (our DiffSinger engine).
 *
 * Payload: { leadSheetId, voicebank }
 * Returns: { data: { job_id, status: 'processing', provider: 'diffsinger' } }
 *
 * The score is read from the stored LeadSheet, never from the request body. If the
 * caller could pass notes directly, the rendered audio would no longer be traceable
 * to a hashed, authored score — which is the only reason this path exists.
 *
 * Credits are deducted by pollDiffSingerVocals on completion: nothing is charged for
 * a render that never lands.
 */

// Our own CPU Space, so this is a queue/abuse guard rather than a cost pass-through.
const RENDER_COST = 2;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { leadSheetId, voicebank } = await req.json();
    if (!leadSheetId) return Response.json({ error: 'leadSheetId required' }, { status: 400 });
    if (!voicebank) return Response.json({ error: 'voicebank required' }, { status: 400 });

    const sheets = await base44.entities.LeadSheet.filter({ id: leadSheetId });
    const sheet = sheets[0];
    if (!sheet) return Response.json({ error: 'Lead sheet not found' }, { status: 404 });
    if (sheet.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const notes = Array.isArray(sheet.score) ? sheet.score : [];
    if (notes.length === 0) {
      return Response.json({ error: 'This score has no melody notes to sing yet' }, { status: 400 });
    }

    const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = recs[0]?.balance ?? 0;
    if (balance < RENDER_COST) {
      return Response.json({
        error: 'Insufficient credits',
        required: RENDER_COST,
        balance,
        message: `A vocal render costs ${RENDER_COST} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    const engineJobId = await submitCantorJob({
      voicebank,
      bpm: sheet.bpm || 120,
      notes: notes.map((n: any) => ({
        syllable: n.syllable,
        midi: n.midi,
        beats: n.beats,
      })),
    });

    const startedAt = new Date().toISOString();
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id,
      user_email: user.email,
      job_type: 'music',
      provider: 'diffsinger',
      status: 'processing',
      // The vocal line is the creator's own authored melody, so this render is
      // AI-assisted performance of human composition — not AI-generated music.
      ai_label: 'ai_assisted',
      input_data: {
        action: 'lead_sheet_vocal',
        lead_sheet_id: leadSheetId,
        score_hash: sheet.score_hash,
        source_title: sheet.title,
        voicebank,
        bpm: sheet.bpm,
        key: sheet.key,
        note_count: notes.length,
        credit_cost: RENDER_COST,
        engine: CANTOR_ENGINE,
      },
      provider_job_id: engineJobId,
      started_at: startedAt,
    });

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'diffsinger', task: 'lead_sheet_vocal',
      credits_used: 0, status: 'pending',
      timestamp: startedAt, job_id: job.id,
      metadata: {
        action: 'lead_sheet_vocal',
        lead_sheet_id: leadSheetId,
        provider_job_id: engineJobId,
        voicebank,
        engine: CANTOR_ENGINE,
      },
    }).catch(() => {});

    return Response.json({
      data: { job_id: job.id, status: 'processing', provider: 'diffsinger', engine_job_id: engineJobId },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});