// Timeline read/write for the workspaces: every note and audio region in the
// live document, grouped by track, measured in bars.
export const TICKS_PER_BAR = 3840 * 4;
export const BAR_PX = 48;
export const SECTIONS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Drop', 'Outro'];

const REGION_TYPES = ['noteRegion', 'audioRegion'];

export function readArrangement(nexus) {
  const regions = REGION_TYPES.flatMap((type) => nexus.queryEntities.ofTypes(type).get().map((r) => {
    const f = r.fields.region.fields;
    return {
      id: r.id,
      type,
      trackId: r.fields.track.value.entityId,
      name: f.displayName.value || (type === 'audioRegion' ? 'Audio' : 'MIDI'),
      start: f.positionTicks.value / TICKS_PER_BAR,
      length: f.durationTicks.value / TICKS_PER_BAR,
    };
  }));
  const trackIds = [...new Set(regions.map((r) => r.trackId))];
  const tracks = trackIds.map((id) => ({ id, regions: regions.filter((r) => r.trackId === id) }));
  const end = Math.max(0, ...regions.map((r) => r.start + r.length));
  return { tracks, bars: Math.max(16, Math.ceil(end) + 4) };
}

/** change: { start?, length? } in bars, { name? } — applied in one transaction. */
export function editRegion(nexus, { id, type }, change) {
  return nexus.modify((t) => {
    const region = t.entities.ofTypes(type).get().find((e) => e.id === id);
    if (!region) throw new Error('That region was removed.');
    const f = region.fields.region.fields;
    if (change.start != null) t.update(f.positionTicks, Math.max(0, Math.round(change.start * TICKS_PER_BAR)));
    if (change.length != null) t.update(f.durationTicks, Math.max(TICKS_PER_BAR / 4, Math.round(change.length * TICKS_PER_BAR)));
    if (change.name != null) t.update(f.displayName, change.name.slice(0, 40));
  });
}