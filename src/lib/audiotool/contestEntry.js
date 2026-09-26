// Remembers which Audius remix contest an Audiotool project is remixing, so the
// finished export can be entered as a remix of the contest track on Audius.
// Keyed by project link; set when a contest stem is sent to the timeline.
const key = (projectUrl) => `bs-contest:${projectUrl}`;

export function rememberContest(projectUrl, contest) {
  if (projectUrl && contest?.parent_track_id) localStorage.setItem(key(projectUrl), JSON.stringify(contest));
}

export function getContest(projectUrl) {
  try {
    return projectUrl ? JSON.parse(localStorage.getItem(key(projectUrl)) || 'null') : null;
  } catch {
    return null;
  }
}

export function clearContest(projectUrl) {
  if (projectUrl) localStorage.removeItem(key(projectUrl));
}