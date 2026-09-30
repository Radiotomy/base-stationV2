import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Associative cover art for a new Audiotool project, stored as a coverart
// UserAsset keyed by project_url. Blank projects share one branded default.
const DEFAULT_COVER = 'https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/225d3fa27_generated_image.png';
const STYLE = 'Square album cover artwork, premium abstract, rich lighting, cinematic depth, no text, no letters, no logos.';
const SOURCES = ['blank_default', 'vibe', 'template', 'prestarter'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_url, source, vibe_label = '', prompt = '', title = '' } = await req.json();
    if (!project_url || !SOURCES.includes(source)) {
      return Response.json({ error: 'project_url and a valid source are required' }, { status: 400 });
    }

    const existing = await base44.entities.UserAsset.filter({ user_id: user.id, asset_type: 'coverart', 'metadata.project_url': project_url }, '-created_date', 1);
    if (existing[0]) return Response.json({ file_url: existing[0].file_url, asset_id: existing[0].id, reused: true });

    let file_url = DEFAULT_COVER;
    if (source !== 'blank_default') {
      const theme = source === 'template'
        ? 'a music producer songstarter session: drum machine, mixer and audio track glowing on dark hardware, warm amber light'
        : `the mood of "${vibe_label}" music. ${prompt}`.slice(0, 600);
      const img = await base44.integrations.Core.GenerateImage({ prompt: `${STYLE} Visual theme: ${theme}` });
      file_url = img.url;
    }

    const asset = await base44.entities.UserAsset.create({
      user_id: user.id,
      user_email: user.email,
      asset_type: 'coverart',
      title: `${title || 'Audiotool project'} — cover`,
      file_url,
      thumbnail_url: file_url,
      metadata: { project_url, vibe: vibe_label || null, origin: 'project_cover', source },
      tags: ['audiotool', 'project-cover'],
    });
    return Response.json({ file_url, asset_id: asset.id, reused: false });
  } catch (error) {
    console.error('generateProjectCover', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}