import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// Admin-only press release writer. Same reasoning as generateMarketingPost: the
// LLM call was reachable straight from the browser, so it moved behind an
// admin gate and onto the service role (platform credits, not the admin's).
const BRAND_CONTEXT = `BASE Station is an AI music creation platform: 11+ AI studios (music, lyrics, mastering, cover art, video, visualizers), live streaming with 3D venues, community charts & radio, a fan economy (tips, collectibles, fan clubs), and industry-leading AI transparency — Creative Ownership Scores, RIAA/IFPI-aligned AI labels, on-chain provenance records on Base, and DDEX metadata exports. The platform's mission is human-first, transparent AI music creation.`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const announcement = String(body.announcement || '').trim();
    const quoteFrom = String(body.quote_from || '').trim();
    if (!announcement) return Response.json({ error: 'An announcement is required' }, { status: 400 });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a music-tech PR professional writing for BASE Station. ${BRAND_CONTEXT}\n\nWrite a complete, professional press release announcing: ${announcement.slice(0, 2000)}\n${quoteFrom ? `Include an attributed quote from: ${quoteFrom.slice(0, 200)}.` : 'Include a quote attributed to a BASE Station spokesperson.'}\n\nUse standard press release structure: headline, subheadline, dateline (city + today's date), lead paragraph with the key news, body paragraphs with detail and context, the quote, a boilerplate "About BASE Station" section, and a media contact placeholder. Write in AP style.`,
      response_json_schema: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          body: { type: 'string', description: 'Full press release text including subheadline, dateline, paragraphs, quote, boilerplate and contact' },
        },
      },
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}