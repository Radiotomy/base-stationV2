// Protect & Register an Audiotool export. Audiotool renders exports itself and
// offers no hook to intercept them, so the creator brings the exported file here.
// Scoring, the C2PA manifest and asset creation all run server-side; creating the
// asset starts BASE Mark embedding and (for opted-in creators) the Base anchor.
import { base44 } from '@/api/base44Client';

// `session` carries the live project's name, snapshot and BPM so the release
// artwork and tempo come straight from Audiotool.
export async function protectExport({ file, title, projectUrl, contribution, session }) {
  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
  const { data } = await base44.functions.invoke('audiotoolProtectExport', {
    file_url, title, project_url: projectUrl, contribution, session,
  });
  return data;
}