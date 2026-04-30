import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, description, tags = [] } = await req.json();
    if (!title) return Response.json({ error: 'Missing title' }, { status: 400 });

    const session = await base44.asServiceRole.entities.LiveSession.create({
      user_id: user.id,
      user_email: user.email,
      title,
      description,
      status: 'draft',
      tags,
      recording_enabled: true,
      viewer_count: 0,
      peak_viewers: 0
    });

    return Response.json({
      session_id: session.id,
      title: session.title,
      status: session.status,
      created_at: session.created_date
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});