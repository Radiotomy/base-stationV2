import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { EL_BASE } from '../../shared/elevenFinetunes.ts';

// List the user's music finetunes and refresh training status from ElevenLabs
// for any that are still pending / in progress.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const key = Deno.env.get('ELEVENLABS_API');
    const records = await base44.entities.MusicFinetune.filter({ user_id: user.id }, '-created_date', 50);

    const refreshed = await Promise.all(records.map(async (rec) => {
      if (!key || !rec.elevenlabs_finetune_id) return rec;
      if (rec.status === 'completed' || rec.status === 'failed' || rec.status === 'blocked') return rec;
      try {
        const res = await fetch(`${EL_BASE}/music/finetunes/${rec.elevenlabs_finetune_id}`, {
          headers: { 'xi-api-key': key },
        });
        if (!res.ok) return rec;
        const ft = await res.json();
        if (ft.status !== rec.status || (ft.training_progress || 0) !== (rec.training_progress || 0)) {
          const updates = {
            status: ft.status,
            training_progress: ft.training_progress || 0,
            ...(ft.failure_reason ? { failure_reason: ft.failure_reason } : {}),
          };
          await base44.asServiceRole.entities.MusicFinetune.update(rec.id, updates);
          return { ...rec, ...updates };
        }
        return rec;
      } catch {
        return rec;
      }
    }));

    return Response.json({ finetunes: refreshed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});