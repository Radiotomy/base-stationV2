// The creator's Audiotool projects via the Nexus SDK's ProjectService.
import { unwrap as ok } from '@/lib/audiotool/nexusErrors';

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

const snake = (k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Update only the given Project fields (camelCase) of "projects/{id}". */
export async function updateProject(at, name, fields) {
  const res = ok(await at.projects.updateProject({
    project: { name, ...fields },
    updateMask: { paths: Object.keys(fields).map(snake) },
  }));
  return res.project;
}

/** "audiotool.com/template/{id}" → "projects/{id}", else null. */
export const templateProjectName = (url) => {
  const id = url.match(/audiotool\.com\/template\/([0-9a-f-]{36})/i)?.[1];
  return id ? `projects/${id}` : null;
};

/** Permanently delete "projects/{id}" from the creator's Audiotool account. */
export async function deleteProject(at, name) {
  ok(await at.projects.deleteProject({ name }));
}

/** Blank project, or a copy of `templateName` ("projects/{id}") when given. */
export async function createProject(at, displayName, templateName) {
  const project = templateName ? { displayName, copyOfProjectName: templateName } : { displayName };
  const res = ok(await at.projects.createProject({ project }));
  return res.project;
}