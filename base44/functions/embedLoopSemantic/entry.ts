import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { embedAudio, CLAP_MODEL } from '../../shared/clapEmbed.ts';

// Embed ONE loop's audio into the CLAP space so it becomes findable by
// description. Caller must own the loop (or be an admin) — embedding downloads
// and processes the file, so it is not something any user may trigger on
// somebody else's audio.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { loop_id: loopId } = await req.json();
    if (!loopId) return Response.json({ error: 'loop_id is required' }, { status: 400 });

    const loop = await base44.asServiceRole.entities.LoopSample.get(loopId);
    if (!loop) return Response.json({ error: 'Loop not found' }, { status: 404 });

    const isOwner = loop.user_id === user.id;
    if (!isOwner && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!loop.file_url) {
      return Response.json({ error: 'Loop has no audio file' }, { status: 422 });
    }

    const { embedding, seconds } = await embedAudio(loop.file_url);

    await base44.asServiceRole.entities.LoopSample.update(loopId, {
      clap_embedding: embedding,
      clap_model: CLAP_MODEL,
    });

    return Response.json({ ok: true, loop_id: loopId, seconds, model: CLAP_MODEL });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}