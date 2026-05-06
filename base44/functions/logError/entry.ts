import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 5.5 — Centralized additive error logging.
 * Payload: { component, message, stack?, severity?, context? }
 * Never throws back to caller; always returns { ok: true } so it can be fire-and-forget.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch { /* anonymous allowed */ }

    const body = await req.json().catch(() => ({}));
    const { component, message, stack, severity, context } = body || {};

    if (!component || !message) {
      return Response.json({ ok: false, error: 'component and message required' }, { status: 400 });
    }

    await base44.asServiceRole.entities.ErrorLog.create({
      user_id: user?.id,
      user_email: user?.email,
      component: String(component).slice(0, 100),
      severity: severity || 'error',
      message: String(message).slice(0, 1000),
      stack: stack ? String(stack).slice(0, 4000) : undefined,
      context: context && typeof context === 'object' ? context : undefined,
    });

    return Response.json({ ok: true });
  } catch (error) {
    // Never break the caller — swallow.
    return Response.json({ ok: false, error: error.message });
  }
});