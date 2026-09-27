import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import Stripe from 'npm:stripe@17.5.0';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body, req.headers.get('stripe-signature'), Deno.env.get('STRIPE_WEBHOOK_SECRET'),
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const tipId = session.metadata?.tip_id;
      if (tipId && session.payment_status === 'paid') {
        const sr = base44.asServiceRole.entities;
        const tip = await sr.Tip.get(tipId);
        if (tip.status !== 'completed') {
          await sr.Tip.update(tipId, { status: 'completed', stripe_payment_intent_id: session.payment_intent || session.id });
          const profile = (await sr.ArtistProfile.filter({ user_id: tip.to_artist_id }))[0];
          if (profile) {
            await sr.ArtistProfile.update(profile.id, {
              total_tips_received_cents: (profile.total_tips_received_cents || 0) + (tip.amount_cents || 0),
            });
          }
        }
      }
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeTipWebhook failed', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
}