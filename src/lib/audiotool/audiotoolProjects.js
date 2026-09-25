// The creator's Audiotool projects via the Nexus SDK's ProjectService.
// The SDK returns Error values instead of throwing — unwrap them here.
const ok = (v) => {
  if (v instanceof Error) throw v;
  return v;
};

const owner = (at) => (at.userName.startsWith('users/') ? at.userName : `users/${at.userName}`);

/** "projects/abc" → studio link that at.open() accepts. */
export const studioUrl = (project) =>
  `https://beta.audiotool.com/studio?project=${project.name.replace(/^projects\//, '')}`;

export async function listMyProjects(at) {
  if (!at.userName) throw new Error("Couldn't read your Audiotool account.");
  const res = ok(await at.projects.listProjects({
    filter: `project.creator_name == "${owner(at)}"`,
    orderBy: 'project.update_time desc',
    pageSize: 30,
  }));
  return res.projects || [];
}

/** Metadata for the project behind a studio link. */
export async function getProjectByUrl(at, url) {
  const id = url.match(/[?&]project=([^&#]+)/)?.[1];
  if (!id) throw new Error('Not an Audiotool project link.');
  const res = ok(await at.projects.getProject({ name: `projects/${id}` }));
  return res.project;
}

/** Blank project, or a copy of `templateName` ("projects/{id}") when given. */
export async function createProject(at, displayName, templateName) {
  const project = templateName ? { displayName, copyOfProjectName: templateName } : { displayName };
  const res = ok(await at.projects.createProject({ project }));
  return res.project;
}