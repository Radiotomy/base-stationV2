// Remembers which Audius remix contest an Audiotool project is remixing, so the
// finished export can be entered as a remix of the contest track on Audius.
// Stored server-side per creator + project link so it follows the creator across
// devices. Set when a contest stem is sent to the timeline.
import { base44 } from '@/api/base44Client';

const FIELDS = ['parent_track_id', 'event_id', 'contest_title', 'parent_artist', 'end_date'];
const legacyKey = (projectUrl) => `bs-contest:${projectUrl}`;
const pick = (c) => Object.fromEntries(FIELDS.filter((f) => c?.[f]).map((f) => [f, String(c[f])]));

async function findLink(userId, projectUrl) {
  return (await base44.entities.AudiotoolContestLink.filter({ user_id: userId, project_url: projectUrl }, '-updated_date', 1))[0];
}

export async function rememberContest(projectUrl, contest) {
  if (!projectUrl || !contest?.parent_track_id) return;
  const user = await base44.auth.me();
  const existing = await findLink(user.id, projectUrl);
  const data = pick(contest);
  if (existing) await base44.entities.AudiotoolContestLink.update(existing.id, data);
  else await base44.entities.AudiotoolContestLink.create({ user_id: user.id, project_url: projectUrl, ...data });
}

export async function getContest(projectUrl) {
  if (!projectUrl) return null;
  const user = await base44.auth.me();
  const link = await findLink(user.id, projectUrl);
  if (link) return pick(link);

  // One-time move of a link saved in this browser before links were stored server-side.
  let legacy = null;
  try { legacy = JSON.parse(localStorage.getItem(legacyKey(projectUrl)) || 'null'); } catch { legacy = null; }
  if (!legacy?.parent_track_id) return null;
  await rememberContest(projectUrl, legacy);
  localStorage.removeItem(legacyKey(projectUrl));
  return pick(legacy);
}

export async function clearContest(projectUrl) {
  if (!projectUrl) return;
  const user = await base44.auth.me();
  const link = await findLink(user.id, projectUrl);
  if (link) await base44.entities.AudiotoolContestLink.delete(link.id);
  localStorage.removeItem(legacyKey(projectUrl));
}