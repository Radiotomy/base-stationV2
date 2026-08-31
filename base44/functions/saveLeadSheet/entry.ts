import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Create or update a lead sheet, and hash it.
 *
 * Payload: { id?, title, key, bpm, time_signature, chord_chart, lyrics, melody, score[], notes? }
 * Returns: { data: <LeadSheet> }
 *
 * The hash is computed HERE and never accepted from the client. A score hash the
 * caller could supply would attest to nothing — the whole point of the artifact is
 * that the platform, not the author, vouches for what was stored and when.
 *
 * Canonicalization is explicit and ordered rather than JSON.stringify over the raw
 * payload: key order in an object literal is not guaranteed to be stable across
 * clients, and an unstable hash would make an unchanged score look edited.
 */

async function hashScore(sheet: any): Promise<string> {
  const canonical = [
    `title:${sheet.title || ''}`,
    `key:${sheet.key || ''}`,
    `bpm:${sheet.bpm || ''}`,
    `time:${sheet.time_signature || ''}`,
    `chords:${(sheet.chord_chart || '').trim()}`,
    `lyrics:${(sheet.lyrics || '').trim()}`,
    `notes:${(sheet.score || []).map((n: any) => `${n.syllable}/${n.midi}/${n.beats}`).join(',')}`,
  ].join('\n');

  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body?.title) return Response.json({ error: 'title required' }, { status: 400 });

    const payload = {
      title: String(body.title).slice(0, 200),
      key: body.key || '',
      bpm: Number(body.bpm) || 120,
      time_signature: body.time_signature || '4/4',
      chord_chart: (body.chord_chart || '').slice(0, 4000),
      lyrics: (body.lyrics || '').slice(0, 8000),
      melody: (body.melody || '').slice(0, 20000),
      score: Array.isArray(body.score) ? body.score : [],
      notes: (body.notes || '').slice(0, 2000),
      source: body.source === 'midi_import' ? 'midi_import' : 'typed',
    };

    const score_hash = await hashScore(payload);

    if (body.id) {
      const existing = await base44.entities.LeadSheet.filter({ id: body.id });
      if (!existing[0]) return Response.json({ error: 'Lead sheet not found' }, { status: 404 });
      if (existing[0].user_id !== user.id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const updated = await base44.entities.LeadSheet.update(body.id, { ...payload, score_hash });
      return Response.json({ data: updated });
    }

    const created = await base44.entities.LeadSheet.create({
      user_id: user.id,
      user_email: user.email,
      ...payload,
      score_hash,
      rendered_asset_ids: [],
    });
    return Response.json({ data: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});