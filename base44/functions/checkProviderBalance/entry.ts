import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can check provider balances
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all provider balances
    const providers = await base44.asServiceRole.entities.ProviderBalance.list('-created_date', 10);

    return Response.json({
      providers: providers.map(p => ({
        provider: p.provider,
        balance: p.balance,
        currency: p.currency,
        status: p.status,
        last_checked: p.last_checked,
        monthly_usage: p.monthly_usage,
        monthly_limit: p.monthly_limit
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});