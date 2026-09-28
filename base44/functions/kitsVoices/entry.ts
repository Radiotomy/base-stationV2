import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { kitsGet } from '../../shared/kitsQueue.ts';

/**
 * Kits voice registry.
 *  { action:'list' }                       → platform library (cached 24h) + the caller's own voices
 *  { action:'add', voiceModelId, title? }  → register a cloned voice trained on app.kits.ai
 *  { action:'remove', id }                 → remove one of the caller's own voices
 */
const TTL_MS = 24 * 3600 * 1000;

async function refreshLibrary(base44: any) {
  const svc = base44.asServiceRole.entities.KitsVoice;
  const cached = await svc.filter({ is_platform: true }, '-updated_date', 1);
  if (cached[0] && Date.now() - Date.parse(cached[0].updated_date) < TTL_MS) return;
  const models: any[] = [];
  for (let page = 1; page <= 5; page++) {
    const r = await kitsGet(`/voice-models?perPage=50&page=${page}`);
    models.push(...(r.data || []));
    if (!r.meta?.nextPageUrl) break;
  }
  const existing = await svc.filter({ is_platform: true }, 'created_date', 500);
  const byId = Object.fromEntries(existing.map((v: any) => [v.model_id, v]));
  const creates: any[] = [];
  const updates: any[] = [];
  for (const m of models) {
    const row = {
      model_id: String(m.id), title: m.title, tags: m.tags || [], image_url: m.imageUrl || '',
      demo_url: m.demoUrl || '', is_platform: true, source: 'library', is_usable: m.isUsable !== false,
    };
    const prev = byId[row.model_id];
    if (prev) updates.push({ id: prev.id, ...row }); else creates.push(row);
  }
  if (creates.length) await svc.bulkCreate(creates);
  if (updates.length) await svc.bulkUpdate(updates);
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { action = 'list', voiceModelId, title, id } = await req.json();
    const svc = base44.asServiceRole.entities.KitsVoice;

    if (action === 'list') {
      await refreshLibrary(base44);
      const [library, mine] = await Promise.all([
        svc.filter({ is_platform: true }, 'title', 500),
        svc.filter({ user_id: user.id }, '-created_date', 100),
      ]);
      return Response.json({ library, mine });
    }

    if (action === 'add') {
      const mid = String(voiceModelId || '').trim();
      if (!/^\d+$/.test(mid)) return Response.json({ error: 'Voice model id must be the number shown on Kits' }, { status: 400 });
      let m;
      try { m = await kitsGet(`/voice-models/${mid}`); } catch {
        return Response.json({ error: 'Kits could not find that voice, or it is private to another account. Make it shareable on Kits and try again.' }, { status: 400 });
      }
      const dup = (await svc.filter({ user_id: user.id, model_id: mid }))[0];
      if (dup) return Response.json({ voice: dup });
      const voice = await svc.create({
        model_id: mid, title: String(title || m.title || 'My voice').slice(0, 80), tags: m.tags || [],
        image_url: m.imageUrl || '', demo_url: m.demoUrl || '', is_platform: false,
        user_id: user.id, source: 'clone', is_usable: m.isUsable !== false,
      });
      return Response.json({ voice });
    }

    if (action === 'remove') {
      const v = (await svc.filter({ id }))[0];
      if (!v || v.user_id !== user.id) return Response.json({ error: 'Not found' }, { status: 404 });
      await svc.delete(v.id);
      return Response.json({ removed: id });
    }
    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}