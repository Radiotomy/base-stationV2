import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { provider, duration, mood, genre, tempo } = await req.json();
    if (!provider || !duration) return Response.json({ error: 'Missing provider or duration' }, { status: 400 });

    // Create job record
    const job = await base44.entities.GenerationJob.create({
      user_id: user.id,
      user_email: user.email,
      job_type: 'music',
      provider,
      status: 'pending',
      input_data: { duration, mood, genre, tempo }
    });

    // TODO: Route to appropriate provider (Loudly, Nuro, Sonic, Producer)
    // For now, return stub response
    return Response.json({ job_id: job.id, status: 'pending', message: 'Music generation queued' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});