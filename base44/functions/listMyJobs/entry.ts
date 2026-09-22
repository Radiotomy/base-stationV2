import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Returns the signed-in creator's own recent generation jobs for the
// notification bell. Read server-side and scoped strictly to the caller's id,
// because the direct entity query was being refused for non-admin accounts.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const jobs = await base44.asServiceRole.entities.GenerationJob.filter(
      { user_id: user.id }, '-created_date', 20,
    );
    return Response.json({ jobs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}