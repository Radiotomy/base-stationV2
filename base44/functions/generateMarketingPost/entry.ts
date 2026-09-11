import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// Admin-only marketing copy generator. The prompt, brand context and response
// schema live HERE rather than in the browser: the client used to call
// Core.InvokeLLM / Core.GenerateImage directly, which put unmetered integration
// credit spend behind a button anyone could reach. Runs as service role so the
// spend is billed to the platform, never to the admin's own balance.
const BRAND_CONTEXT = `BASE Station is an AI music creation platform for creators: 11+ AI studios (music, lyrics, mastering, cover art, video, visualizers), live streaming with 3D venues, community charts & radio, a fan economy (tips, collectibles, fan clubs), and industry-leading AI transparency — Creative Ownership Scores, RIAA/IFPI AI labels, on-chain provenance on Base, and DDEX exports. Human-first, transparent AI music.`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    // Two modes on one narrow function: draft the copy, or render the visual for
    // a concept the copy step already produced. Kept together because the image
    // prompt is only meaningful as a continuation of this same brand brief.
    if (body.image_concept) {
      const concept = String(body.image_concept).slice(0, 500);
      const { url } = await base44.asServiceRole.integrations.Core.GenerateImage({
        prompt: `Social media promotional graphic for BASE Station, an AI music creation platform. ${concept}. Dark obsidian background with warm orange/amber chrome accents, modern, bold, music-tech aesthetic. No text overlays.`,
      });
      return Response.json({ image_url: url });
    }

    const topic = String(body.topic || '').trim();
    const platform = String(body.platform || 'twitter').trim();
    if (!topic) return Response.json({ error: 'A topic is required' }, { status: 400 });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are the marketing lead for BASE Station. ${BRAND_CONTEXT}\n\nWrite a ${platform} post promoting: ${topic.slice(0, 2000)}\n\nMatch the platform's tone and length conventions (e.g. punchy and short for X, hook-first for TikTok, professional for LinkedIn). Include a strong hook and a call to action. Also provide 4-8 relevant hashtags and a one-line image concept for an accompanying visual.`,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short internal title for this post' },
          body: { type: 'string', description: 'The post caption, ready to publish' },
          hashtags: { type: 'array', items: { type: 'string' } },
          image_concept: { type: 'string' },
        },
      },
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}