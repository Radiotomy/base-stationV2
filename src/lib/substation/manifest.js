// COS handoff manifest: the JSON block BASE Station's Content Ownership System
// and BASE Mark pipeline read. Built from the session only — it never asserts a
// provenance result, it only declares what the arrangement is and who owns it.
export function buildManifest(session, user) {
  const totalBeats = Math.max(0, ...session.tracks.flatMap(t => t.clips.map(c => c.start + c.length)));
  const splitTotal = session.splits.reduce((s, r) => s + (Number(r.pct) || 0), 0);

  return {
    manifest_version: 1,
    source_module: 'sub_station_studio',
    generated_at: new Date().toISOString(),
    project: {
      title: session.meta.title || session.name,
      genre: session.meta.genre || null,
      bpm: session.bpm,
      length_beats: Number(totalBeats.toFixed(3)),
      length_seconds: Number(((totalBeats * 60) / session.bpm).toFixed(3)),
      track_count: session.tracks.length,
      clip_count: session.tracks.reduce((n, t) => n + t.clips.length, 0),
    },
    owner: user ? { user_id: user.id, email: user.email, name: user.full_name } : null,
    ai_label: session.meta.ai_label,
    splits: session.splits.map(r => ({ name: r.name, role: r.role, percentage: Number(r.pct) || 0 })),
    split_total: Number(splitTotal.toFixed(2)),
    tracks: session.tracks.map(t => ({
      name: t.name,
      kind: t.kind,
      output: t.output,
      volume: t.volume,
      pan: t.pan,
      foundry_patch: t.patch ? { plugin_id: t.patch.plugin_id, title: t.patch.title, category: t.patch.category } : null,
      imported_assets: t.clips.filter(c => c.asset_id).map(c => ({ asset_id: c.asset_id, title: c.name })),
    })),
    master_chain: session.fx,
    ddex: {
      resource_type: 'SoundRecording',
      is_arrangement: true,
      contributors: session.splits.filter(r => r.name).map(r => ({ name: r.name, role: r.role })),
    },
  };
}

export function manifestReadiness(session) {
  const splitTotal = session.splits.reduce((s, r) => s + (Number(r.pct) || 0), 0);
  const clips = session.tracks.reduce((n, t) => n + t.clips.length, 0);
  return [
    { id: 'title', label: 'Project title set', ok: !!(session.meta.title || '').trim() },
    { id: 'clips', label: 'Arrangement has at least one clip', ok: clips > 0 },
    { id: 'splits_named', label: 'Every collaborator named', ok: session.splits.every(r => (r.name || '').trim()) },
    { id: 'splits_total', label: 'Splits total exactly 100%', ok: Math.abs(splitTotal - 100) < 0.01 },
    { id: 'label', label: 'AI disclosure label declared', ok: !!session.meta.ai_label },
  ];
}