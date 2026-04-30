import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { track_title, mood, style, tier } = await req.json();
    if (!track_title) return Response.json({ error: 'Missing track_title' }, { status: 400 });

    // Create job record
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id,
      user_email: user.email,
      job_type: 'cover_art',
      provider: 'tempcolor',
      status: 'pending',
      input_data: { track_title, mood, style, tier: tier || 'auto' }
    });

    // TODO: Route to Tempcolor with tier selection (low-cost for auto, higher for deep sessions)
    return Response.json({ job_id: job.id, status: 'pending', message: 'Cover art generation queued' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});