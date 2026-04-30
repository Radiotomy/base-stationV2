import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { artist_id, artist_name, artist_email, amount_cents, message, track_title, blockchain } = await req.json();

    if (!artist_id || !amount_cents || !blockchain) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create tip record
    const tip = await base44.entities.Tip.create({
      from_user_id: user.id,
      from_user_name: user.full_name,
      from_user_email: user.email,
      to_artist_id: artist_id,
      to_artist_name: artist_name,
      to_artist_email: artist_email,
      amount_cents,
      message: message || '',
      track_title: track_title || '',
      blockchain,
      status: 'completed', // In MVP, immediately mark as completed
    });

    // Log activity
    await base44.asServiceRole.entities.ActivityFeedItem.create({
      type: 'track_submitted', // Reusing type for activity feed
      actor_name: user.full_name,
      actor_id: user.id,
      title: `sent a ${(amount_cents / 100).toFixed(2)} tip to ${artist_name}`,
      description: `via ${blockchain === 'base' ? 'Base blockchain' : blockchain === 'solana' ? 'Solana blockchain' : 'Stripe'}`,
    }).catch(() => {});

    return Response.json({ 
      success: true, 
      tip_id: tip.id,
      message: `Tip sent! Thanks for supporting ${artist_name}.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});