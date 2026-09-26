// Project collaborators via the Nexus SDK's ProjectRoleService.
// The SDK returns Error values instead of throwing — unwrap them here.
const ok = (v) => {
  if (v instanceof Error) throw v;
  return v;
};

// Audiotool ProjectRoleType values (owner is never listed as a collaborator).
export const ROLE_TYPES = [
  [3, 'Editor', 'Can edit · credited on the published track'],
  [4, 'Editor (uncredited)', 'Can edit · not credited on the track'],
  [5, 'Viewer', 'Can view only'],
];

const userName = (u) => {
  const clean = u.trim().replace(/^@/, '').replace(/^.*audiotool\.com\/user\//, '').replace(/\/$/, '');
  return clean.startsWith('users/') ? clean : `users/${clean}`;
};

export async function listCollaborators(at, projectName) {
  const res = ok(await at.projectRoles.listProjectRoles({ parent: projectName, pageSize: 50 }));
  return res.projectRoles || [];
}

export async function addCollaborator(at, projectName, user, roleType) {
  const res = ok(await at.projectRoles.createProjectRole({
    parent: projectName,
    projectRole: { userName: userName(user), roleType },
  }));
  return res.projectRole;
}

export async function changeCollaboratorRole(at, role, roleType) {
  const res = ok(await at.projectRoles.updateProjectRole({
    projectRole: { name: role.name, roleType },
    updateMask: { paths: ['role_type'] },
  }));
  return res.projectRole;
}

export async function removeCollaborator(at, role) {
  ok(await at.projectRoles.deleteProjectRole({ name: role.name }));
}