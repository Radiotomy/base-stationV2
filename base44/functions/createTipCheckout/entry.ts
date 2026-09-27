import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import Stripe from 'npm:stripe@17.5.0';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Please sign in to tip' }, { status: 401 });

    const { artist_id, amount_cents, message, return_url } = await req.json();
    const cents = Math.round(Number(amount_cents));
    if (!artist_id || !(cents >= 100 && cents <= 50000)) {
      return Response.json({ error: 'Tip must be between $1 and $500' }, { status: 400 });
    }

    const sr = base44.asServiceRole.entities;
    const profile = (await sr.ArtistProfile.filter({ user_id: artist_id }))[0]
      || await sr.ArtistProfile.get(artist_id).catch(() => null);
    if (!profile || profile.tipping_enabled === false) {
      return Response.json({ error: 'This artist is not accepting tips' }, { status: 400 });
    }

    const tip = await sr.Tip.create({
      from_user_id: user.id, from_user_name: user.full_name, from_user_email: user.email,
      to_artist_id: profile.user_id, to_artist_name: profile.display_name, to_artist_email: profile.user_email,
      amount_cents: cents, currency: 'usd', blockchain: 'fiat', status: 'pending', message: message || '',
    });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: cents, product_data: { name: `Tip for ${profile.display_name}` } } }],
      customer_email: user.email,
      success_url: `${return_url}${return_url.includes('?') ? '&' : '?'}tip=success`,
      cancel_url: return_url,
      metadata: { base44_app_id: Deno.env.get('BASE44_APP_ID'), tip_id: tip.id },
    });
    await sr.Tip.update(tip.id, { stripe_payment_intent_id: session.id });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createTipCheckout failed', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}