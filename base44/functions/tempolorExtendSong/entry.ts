// Tempolor Song Extension — continue an existing Tempolor-generated track from a timestamp.
// Docs: POST /open-apis/v1/song/extend
//   body: { item_id, start_time (10..600 s), lyrics?, callback_url(required) }
//   200:  { status: 200000, data: { item_ids: [string] } }
//
// Auth: Authorization header = raw API key (NOT Bearer). Same as song/generate.
//
// Creates a new GenerationJob for the extension so it flows through the normal
// poll/webhook completion path and gets stored on the user's library.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TEMPCOLOR_API_KEY = Deno.env.get('TEMPCOLOR_API_KEY');
const TEMPOLOR_BASE = 'https://api.tempolor.com/open-apis/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { item_id, start_time = 60, lyrics } = await req.json();
    if (!item_id) return Response.json({ error: 'Missing item_id' }, { status: 400 });

    // Server-side credit gate (10 credits, same as generation)
    const cost = 10;
    const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = recs[0]?.balance ?? 0;
    if (balance < cost) {
      return Response.json({
        error: 'Insufficient credits', required: cost, balance,
        message: `Extension costs ${cost} credits. You have ${balance}.`,
      }, { status: 402 });
    }

    const callbackUrl = Deno.env.get('TEMPOLOR_WEBHOOK_URL') || 'https://webhook.site/tempolor-callback';

    const body = {
      item_id,
      start_time: Math.min(Math.max(Number(start_time) || 60, 10), 600),
      callback_url: callbackUrl,
      ...(lyrics && { lyrics: String(lyrics).slice(0, 3000) }),
    };

    const res = await fetch(`${TEMPOLOR_BASE}/song/extend`, {
      method: 'POST',
      headers: { 'Authorization': TEMPCOLOR_API_KEY, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log('Tempolor extend response:', JSON.stringify(data));
    if (!res.ok || data?.status !== 200000) {
      return Response.json({ error: data?.message || 'Tempolor extend failed' }, { status: 502 });
    }

    const newItemId = data?.data?.item_ids?.[0];
    if (!newItemId) {
      return Response.json({ error: 'No item_id returned from Tempolor' }, { status: 502 });
    }

    const startedAt = new Date().toISOString();
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id, user_email: user.email,
      job_type: 'music', provider: 'tempcolor',
      status: 'processing',
      input_data: {
        action: 'extend',
        source_item_id: item_id,
        start_time: body.start_time,
        lyrics: lyrics || '',
        credit_cost: cost,
      },
      provider_job_id: newItemId,
      started_at: startedAt,
    });

    // Pending log — finalized by tempolorWebhook or pollGenerationJob
    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'tempcolor', task: 'generate_music',
      credits_used: 0, status: 'pending',
      timestamp: startedAt, job_id: job.id,
      metadata: { action: 'extend', source_item_id: item_id, start_time: body.start_time, base44_job_id: job.id },
    }).catch(() => {});

    return Response.json({ job_id: job.id, status: 'processing', item_id: newItemId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});