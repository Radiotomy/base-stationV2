import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Admin-only: turns creators' generated library tracks (UserAsset) into approved
// TrackSubmissions so the radio queue — which only reads approved submissions —
// can play them. Runs as service role because TrackSubmission create-RLS only
// lets a user submit as themselves.
const GENRES = ['hip-hop', 'edm', 'pop', 'r&b', 'rock', 'lo-fi', 'jazz', 'classical', 'trap'];
const ALIASES = {
  'hip hop': 'hip-hop', hiphop: 'hip-hop', rap: 'hip-hop', drill: 'trap',
  house: 'edm', 'deep house': 'edm', techno: 'edm', dubstep: 'edm', 'future bass': 'edm', electronic: 'edm', dance: 'edm',
  rnb: 'r&b', 'r and b': 'r&b', soul: 'r&b', 'neo soul': 'r&b',
  lofi: 'lo-fi', 'lo fi': 'lo-fi', 'chill': 'lo-fi',
  'indie rock': 'rock', alternative: 'rock', metal: 'rock', punk: 'rock',
  cinematic: 'classical', orchestral: 'classical', 'jazz fusion': 'jazz',
  'dark pop': 'pop', hyperpop: 'pop',
};
const mapGenre = (raw) => {
  const g = String(raw || '').toLowerCase().trim();
  if (GENRES.includes(g)) return g;
  if (ALIASES[g]) return ALIASES[g];
  const hit = GENRES.find((x) => g.includes(x));
  return hit || 'other';
};
const isAudio = (a) => a.file_url && /^https?:\/\//.test(a.file_url);

async function loadAll(entity, query, sort, cap = 1000) {
  const out = [];
  for (let skip = 0; skip < cap; skip += 200) {
    const page = await entity.filter(query, sort, 200, skip);
    out.push(...page);
    if (page.length < 200) break;
  }
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const { action = 'preview', user_ids = [], max = 200 } = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole.entities;

    if (action === 'approve_pending') {
      const pending = await loadAll(sr.TrackSubmission, { status: 'pending' }, '-created_date');
      if (pending.length) await sr.TrackSubmission.bulkUpdate(pending.map((p) => ({ id: p.id, status: 'approved' })));
      return Response.json({ approved: pending.length });
    }

    const [users, assets, subs] = await Promise.all([
      sr.User.list('-created_date', 500),
      loadAll(sr.UserAsset, { asset_type: 'track' }, '-created_date'),
      loadAll(sr.TrackSubmission, {}, '-created_date', 3000),
    ]);
    const byId = Object.fromEntries(users.map((u) => [u.id, u]));
    const existing = new Set(subs.map((s) => s.track_url).filter(Boolean));

    const accounts = {};
    const candidates = [];
    for (const a of assets) {
      if (!isAudio(a) || a.origin === 'audius' || existing.has(a.file_url)) continue;
      existing.add(a.file_url);
      const acct = accounts[a.user_id] ||= { user_id: a.user_id, name: byId[a.user_id]?.full_name || a.user_email || 'Unknown', email: byId[a.user_id]?.email || a.user_email || '', count: 0 };
      acct.count++;
      if (!user_ids.length || user_ids.includes(a.user_id)) candidates.push(a);
    }

    if (action === 'preview') {
      return Response.json({
        accounts: Object.values(accounts).sort((x, y) => y.count - x.count),
        total: candidates.length,
        pending: subs.filter((s) => s.status === 'pending').length,
      });
    }

    if (action !== 'import') return Response.json({ error: 'Unknown action' }, { status: 400 });
    const pick = candidates.sort(() => Math.random() - 0.5).slice(0, Math.min(Number(max) || 200, 500));
    const rows = pick.map((a) => {
      const owner = byId[a.user_id];
      const m = a.metadata || {};
      return {
        artist_id: a.user_id,
        artist_name: owner?.full_name || a.user_email || 'BASE Station Artist',
        artist_email: owner?.email || a.user_email || '',
        title: a.title || 'Untitled',
        description: (a.description || '').slice(0, 1000),
        track_url: a.file_url,
        cover_image_url: a.thumbnail_url || m.cover_image_url || '',
        genre: mapGenre(m.genre || a.tags?.[0]),
        ai_label: ['ai_generated', 'ai_assisted', 'human'].includes(a.ai_label) ? a.ai_label : 'ai_generated',
        ai_tools_used: m.provider || m.model || '',
        tags: a.tags || [],
        duration_seconds: Number(m.duration || m.duration_seconds) || undefined,
        bpm: Number(m.bpm) || undefined,
        key: m.key || undefined,
        source_check: { verified: true, source_name: 'Base Station Library', method: 'admin_import', asset_id: a.id },
        play_count: 0,
        like_count: 0,
        status: 'approved',
      };
    });
    for (let i = 0; i < rows.length; i += 100) await sr.TrackSubmission.bulkCreate(rows.slice(i, i + 100));
    return Response.json({ imported: rows.length, remaining: candidates.length - rows.length });
  } catch (error) {
    console.error('importLibraryToRadio', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}