import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Admin-only — scheduled automations invoke with platform admin auth context
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    // Existing recent articles for deduplication
    const existing = await svc.entities.NewsArticle.list('-published_date', 150);
    const existingTitles = existing.map((a) => (a.title || '').toLowerCase().trim());

    const today = new Date().toISOString().split('T')[0];
    const result = await svc.integrations.Core.InvokeLLM({
      prompt: `You are a meticulous news researcher for an AI music creation platform's "News & Legal Hub".
Today's date is ${today}.

Search the web for the MOST RECENT (last 14 days preferred, last 60 days max) verified, real developments relevant to AI music creators, developers, and the music industry. Cover:
1. LEGAL — lawsuits, court rulings, settlements, copyright office decisions, new or proposed legislation (US, EU, UK, global) affecting generative AI music.
2. POLICY — new rules from DSPs (Spotify, Apple Music, YouTube), labels, distributors, PROs, RIAA/IFPI programs, labeling/disclosure standards (e.g. GenAI labeling, DDEX AI metadata).
3. INDUSTRY — licensing deals between AI companies and rights holders, funding, partnerships, market shifts.
4. TECHNOLOGY — significant new AI music model/tool/service releases or major updates.
5. RESOURCES — new guides, services, standards bodies, or tools that help AI music creators stay compliant.

STRICT RULES:
- Only include stories you can verify from reputable sources (major news outlets, trade press like Music Business Worldwide/Billboard/Variety, official government or organization announcements). NEVER invent stories, sources, or URLs.
- Every item must include the real source name and a real working source URL.
- Skip anything substantially similar to these already-published headlines: ${existingTitles.slice(0, 60).join(' | ') || '(none yet)'}
- Return 5 to 10 items. If fewer verified fresh stories exist, return fewer — accuracy over volume.
- summary: 2-4 factual sentences. content: 1-2 paragraphs explaining what happened and why it matters specifically to AI music creators and developers. Neutral, factual tone — no hype, no speculation presented as fact.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          articles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                summary: { type: 'string' },
                content: { type: 'string' },
                category: { type: 'string', enum: ['legal', 'policy', 'industry', 'technology', 'resources'] },
                source_name: { type: 'string' },
                source_url: { type: 'string' },
                published_date: { type: 'string' },
                region: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
              },
              required: ['title', 'summary', 'category', 'source_name', 'source_url'],
            },
          },
        },
        required: ['articles'],
      },
    });

    const candidates = (result?.articles || []).filter(
      (a) => a.title && a.summary && a.source_url && a.category
    );
    const fresh = candidates.filter(
      (a) => !existingTitles.includes(a.title.toLowerCase().trim())
    );

    let created = 0;
    if (fresh.length > 0) {
      await svc.entities.NewsArticle.bulkCreate(
        fresh.map((a) => ({
          title: a.title,
          summary: a.summary,
          content: a.content || '',
          category: a.category,
          source_name: a.source_name,
          source_url: a.source_url,
          published_date: a.published_date || today,
          region: a.region || 'Global',
          tags: a.tags || [],
          status: 'published',
        }))
      );
      created = fresh.length;
    }

    return Response.json({
      created,
      skipped_duplicates: candidates.length - fresh.length,
      total_returned: candidates.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});