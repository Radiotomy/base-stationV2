import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id } = await req.json();
    if (!job_id) return Response.json({ error: 'Missing job_id' }, { status: 400 });

    const job = await base44.entities.GenerationJob.filter({ id: job_id });
    if (!job || job.length === 0) return Response.json({ error: 'Job not found' }, { status: 404 });

    const jobData = job[0];
    if (jobData.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    return Response.json({
      id: jobData.id,
      status: jobData.status,
      output_url: jobData.output_url,
      output_metadata: jobData.output_metadata,
      error_message: jobData.error_message,
      created_at: jobData.created_date,
      completed_at: jobData.completed_at
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});