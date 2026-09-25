// audiotoolConfig — returns the public Audiotool OAuth client id so the browser
// can start the PKCE flow, plus the Songstarter template project name. Neither
// is a secret (the client id appears in the authorize URL, the template is a
// copy-allowed project), so this endpoint needs no login.

import { secrets } from 'base44:runtime';

// Accepts a studio link, a bare id, or "projects/{id}" → "projects/{id}".
const toProjectName = (raw: string) => {
  const v = raw.trim();
  if (!v) return '';
  const id = v.match(/[?&]project=([^&#]+)/)?.[1] || v.replace(/^projects\//, '');
  return `projects/${id}`;
};

export default async function (req: Request): Promise<Response> {
  try {
    const clientId = secrets.get('AUDIOTOOL_CLIENT_ID');
    if (!clientId) return Response.json({ error: 'Audiotool is not configured yet' }, { status: 503 });
    const template = toProjectName(secrets.get('AUDIOTOOL_TEMPLATE_PROJECT') || '');
    return Response.json({ client_id: clientId, template_project: template || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}