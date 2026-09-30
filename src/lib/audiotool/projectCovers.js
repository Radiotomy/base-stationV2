import { base44 } from '@/api/base44Client';

export const DEFAULT_PROJECT_COVER = 'https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/225d3fa27_generated_image.png';

/** onError handler: swap a broken cover for the branded default once. */
export const coverFallback = (e) => {
  if (e.currentTarget.src !== DEFAULT_PROJECT_COVER) e.currentTarget.src = DEFAULT_PROJECT_COVER;
};

/** Generate (or reuse) the BASE Station cover for a project. Never throws. */
export async function requestProjectCover(payload) {
  try {
    const { data } = await base44.functions.invoke('generateProjectCover', payload);
    return data?.file_url || null;
  } catch (e) {
    console.warn('Project cover generation failed', e);
    return null;
  }
}

/** { project_url → cover url } for the current creator. */
export async function loadProjectCovers() {
  const user = await base44.auth.me();
  const rows = await base44.entities.UserAsset.filter({ user_id: user.id, asset_type: 'coverart', 'metadata.origin': 'project_cover' }, '-created_date', 100);
  return Object.fromEntries(rows.map((r) => [r.metadata?.project_url, r.file_url]));
}