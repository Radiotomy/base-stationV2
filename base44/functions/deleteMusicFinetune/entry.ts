import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { EL_BASE } from '../../shared/elevenFinetunes.ts';

// Delete a music finetune (ElevenLabs side + local record).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { record_id } = await req.json();
    if (!record_id) return Response.json({ error: 'Missing record_id' }, { status: 400 });

    const rec = await base44.entities.MusicFinetune.get(record_id);
    if (!rec || rec.user_id !== user.id) {
      return Response.json({ error: 'Finetune not found' }, { status: 404 });
    }

    const key = Deno.env.get('ELEVENLABS_API');
    if (key && rec.elevenlabs_finetune_id) {
      await fetch(`${EL_BASE}/music/finetunes/${rec.elevenlabs_finetune_id}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': key },
      }).catch(() => {});
    }

    await base44.entities.MusicFinetune.delete(record_id);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});