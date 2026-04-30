import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { event_type, event_data, job_id, session_id, credits_used, duration_ms } = await req.json();
    if (!event_type) return Response.json({ error: 'Missing event_type' }, { status: 400 });

    const event = await base44.asServiceRole.entities.AnalyticsEvent.create({
      user_id: user.id,
      user_email: user.email,
      event_type,
      event_data: event_data || {},
      session_id,
      job_id,
      duration_ms,
      credits_used,
      timestamp: new Date().toISOString()
    });

    return Response.json({
      event_id: event.id,
      recorded: true,
      timestamp: event.created_date
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});