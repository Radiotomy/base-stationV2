// Pull audio out of Audiotool through its Samples API, so an exported/bounced mix
// can be protected without the creator downloading and re-uploading it by hand.
// The SDK returns Error values instead of throwing — unwrap them here.
const ok = (v) => {
  if (v instanceof Error) throw v;
  return v;
};

/** Sample metadata for every audio sample placed in the open project. */
export async function listProjectSamples(at, nexus) {
  const entities = nexus.queryEntities.ofTypes('sample').get();
  const metas = await Promise.all(entities.map((e) => at.samples.get(e).catch((err) => err)));
  return metas.filter((m) => !(m instanceof Error));
}

export async function sampleForEntity(at, entity) {
  return ok(await at.samples.get(entity));
}

/** The creator's own most recent uploads/bounces in their Audiotool library. */
export async function listMyLibrary(at) {
  // AuthenticatedClient.userName is the resource name ("users/{id}") that
  // sample.owner_name is filtered on — normalise in case only the id is given.
  if (!at.userName) throw new Error("Couldn't read your Audiotool account.");
  const owner = at.userName.startsWith('users/') ? at.userName : `users/${at.userName}`;
  const res = ok(await at.samples.list({
    filter: `sample.owner_name == "${owner}"`,
    orderBy: 'sample.create_time desc',
    pageSize: 20,
  }));
  return res.samples || [];
}

/** Lossless WAV of a sample, ready for the BASE Mark pipeline. */
export async function downloadAsFile(at, meta) {
  const blob = ok(await at.samples.download(meta, { format: 'wav' }));
  const safe = (meta.displayName || 'audiotool-export').replace(/[^\w\- ]+/g, '').trim() || 'audiotool-export';
  return new File([blob], `${safe}.wav`, { type: 'audio/wav' });
}