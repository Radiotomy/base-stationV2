import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { topic, mood, style, length } = await req.json();
    if (!topic) return Response.json({ error: 'Missing topic' }, { status: 400 });

    // Create job record
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id,
      user_email: user.email,
      job_type: 'lyrics',
      provider: 'nuro',
      status: 'pending',
      input_data: { topic, mood, style, length }
    });

    // TODO: Route to Nuro or Tempcolor for lyrics generation
    return Response.json({ job_id: job.id, status: 'pending', message: 'Lyrics generation queued' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});