// Protect & Register an Audiotool export. Audiotool renders exports itself and
// offers no hook to intercept them, so the creator brings the exported file here.
// Scoring, the C2PA manifest and asset creation all run server-side; creating the
// asset starts BASE Mark embedding and (for opted-in creators) the Base anchor.
import { base44 } from '@/api/base44Client';

// Above this, the watermark and storage steps can't reliably keep the file, so a
// long export is stopped here with a clear answer instead of being lost later.
export const MAX_EXPORT_MB = 40;

export function exportSizeProblem(file) {
  if (!file || file.size <= MAX_EXPORT_MB * 1024 * 1024) return '';
  const mb = Math.round(file.size / 1024 / 1024);
  return `This export is ${mb} MB — the limit is ${MAX_EXPORT_MB} MB. Export it from Audiotool as FLAC (same quality, about half the size) or register it in shorter sections.`;
}

// `session` carries the live project's name, snapshot and BPM so the release
// artwork and tempo come straight from Audiotool.
export async function protectExport({ file, title, projectUrl, contribution, session }) {
  const problem = exportSizeProblem(file);
  if (problem) throw new Error(problem);
  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
  if (!file_url) throw new Error('The export could not be saved to storage — nothing was registered. Please try again.');
  const { data } = await base44.functions.invoke('audiotoolProtectExport', {
    file_url, title, project_url: projectUrl, contribution, session,
  });
  return data;
}