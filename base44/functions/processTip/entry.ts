import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { verifyBaseTip, verifySolanaTip, verifyAudiusTip } from '../../shared/tipVerify.ts';
import { getAudiusTipWallet, AUDIO_MINT } from '../../shared/audiusTipWallet.ts';

// Records a NON-CUSTODIAL tip only after verifying it on-chain. The fan's own
// wallet paid the artist's own wallet directly; the platform never holds funds.
// blockchain 'audius' = $AUDIO to an Audius artist (artist_id is their Audius
// user id; the destination wallet is read from Audius, never the client).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { artist_id, blockchain, tx_hash, message, track_title } = await req.json();
    if (!artist_id || !tx_hash || !['base', 'solana', 'audius'].includes(blockchain)) {
      return Response.json({ error: 'artist_id, blockchain (base|solana|audius) and tx_hash are required' }, { status: 400 });
    }

    const sr = base44.asServiceRole.entities;
    let toWallet: string, artist: { id: string; name: string; email?: string };

    if (blockchain === 'audius') {
      const a = await getAudiusTipWallet(artist_id).catch((e) => ({ error: e.message }));
      if ('error' in a) return Response.json({ error: a.error }, { status: 400 });
      toWallet = a.wallet;
      artist = { id: `audius:${artist_id}`, name: a.name };
    } else {
      const profile = (await sr.ArtistProfile.filter({ user_id: artist_id }))[0]
        || await sr.ArtistProfile.get(artist_id).catch(() => null);
      if (!profile || profile.tipping_enabled === false) {
        return Response.json({ error: 'This artist is not accepting tips' }, { status: 400 });
      }
      toWallet = profile.tip_wallets?.[blockchain];
      if (!toWallet) return Response.json({ error: `Artist has no ${blockchain} wallet set` }, { status: 400 });
      artist = { id: profile.user_id, name: profile.display_name, email: profile.user_email };
    }

    const existing = await sr.Tip.filter({ tx_hash });
    if (existing.length) return Response.json({ error: 'This transaction was already recorded' }, { status: 409 });

    let verified;
    try {
      verified = blockchain === 'base' ? await verifyBaseTip(tx_hash, toWallet)
        : blockchain === 'solana' ? await verifySolanaTip(tx_hash, toWallet)
        : await verifyAudiusTip(tx_hash, toWallet, AUDIO_MINT);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }

    const tip = await sr.Tip.create({
      from_user_id: user.id,
      from_user_name: user.full_name,
      from_user_email: user.email,
      to_artist_id: artist.id,
      to_artist_name: artist.name,
      to_artist_email: artist.email || '',
      blockchain,
      tx_hash,
      token_symbol: verified.symbol,
      token_amount: verified.amount,
      from_wallet: verified.from,
      to_wallet: toWallet,
      currency: verified.symbol.toLowerCase(),
      message: message || '',
      track_title: track_title || '',
      status: 'completed',
    });

    await sr.ActivityFeedItem.create({
      type: 'track_submitted',
      actor_name: user.full_name,
      actor_id: user.id,
      title: `sent ${verified.amount} ${verified.symbol} to ${artist.name}`,
      description: `Verified on ${blockchain === 'base' ? 'Base' : 'Solana'}`,
    }).catch(() => {});

    return Response.json({ success: true, tip_id: tip.id, amount: verified.amount, symbol: verified.symbol });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}