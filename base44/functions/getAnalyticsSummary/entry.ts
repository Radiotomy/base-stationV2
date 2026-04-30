import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user's recent analytics (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const events = await base44.entities.AnalyticsEvent.filter({
      user_id: user.id
    });

    const recentEvents = events.filter(e => e.created_date >= thirtyDaysAgo);

    // Aggregate metrics
    const metrics = {
      total_events: recentEvents.length,
      generations: recentEvents.filter(e => e.event_type.includes('generation')).length,
      completions: recentEvents.filter(e => e.event_type === 'generation_completed').length,
      failures: recentEvents.filter(e => e.event_type === 'generation_failed').length,
      total_credits_used: recentEvents.reduce((sum, e) => sum + (e.credits_used || 0), 0),
      total_duration_hours: recentEvents.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / (1000 * 60 * 60),
      studios_visited: new Set(recentEvents.map(e => e.event_data?.studio).filter(Boolean)).size,
      success_rate: recentEvents.filter(e => e.event_type === 'generation_completed').length / Math.max(recentEvents.filter(e => e.event_type.includes('generation')).length, 1)
    };

    // Top providers
    const providerStats = {};
    recentEvents.forEach(e => {
      if (e.provider) {
        providerStats[e.provider] = (providerStats[e.provider] || 0) + 1;
      }
    });

    return Response.json({
      period: 'last_30_days',
      user_id: user.id,
      metrics,
      top_providers: Object.entries(providerStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([provider, count]) => ({ provider, count }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});