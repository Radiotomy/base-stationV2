import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { embedAudio, CLAP_MODEL } from '../../shared/clapEmbed.ts';

// Index the caller's not-yet-embedded loops, a batch at a time.
//
// Batched deliberately: each loop means downloading and decoding a file, so a
// whole-library sweep in one request would time out. The caller re-invokes while
// `remaining` is above zero, which also means a failure costs one batch rather
// than the whole run.
const MAX_BATCH = 8;
const SCAN_LIMIT = 500;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Math.max(Number(body.batch_size) || MAX_BATCH, 1), MAX_BATCH);

    const svc = base44.asServiceRole.entities.LoopSample;
    const owned = await svc.filter({ user_id: user.id }, '-created_date', SCAN_LIMIT);

    // Re-embed anything with no vector OR a vector from a superseded checkpoint:
    // mixing checkpoints would quietly corrupt every future ranking.
    const pending = owned.filter(
      (l) => l.file_url && (!Array.isArray(l.clap_embedding) || l.clap_model !== CLAP_MODEL)
    );

    const batch = pending.slice(0, batchSize);
    let indexed = 0;
    const failures = [];

    for (const loop of batch) {
      try {
        const { embedding } = await embedAudio(loop.file_url);
        await svc.update(loop.id, { clap_embedding: embedding, clap_model: CLAP_MODEL });
        indexed++;
      } catch (e) {
        // One undecodable file must not end the sweep — report it and continue.
        failures.push({ id: loop.id, title: loop.title, error: e.message });
      }
    }

    return Response.json({
      indexed,
      failures,
      attempted: batch.length,
      remaining: Math.max(pending.length - batch.length, 0),
      total_owned: owned.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}