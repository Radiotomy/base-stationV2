import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { Connection, PublicKey, Transaction } from 'npm:@solana/web3.js@1.95.3';
import {
  getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction,
} from 'npm:@solana/spl-token@0.4.8';
import bs58 from 'npm:bs58@6.0.0';
import { getAudiusTipWallet, AUDIO_MINT, AUDIO_DECIMALS, solanaRpcUrl } from '../../shared/audiusTipWallet.ts';

// Builds an UNSIGNED $AUDIO transfer from the fan's wallet straight to the
// Audius artist's wallet. The fan signs it in their own wallet — the platform
// never holds keys or funds.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Please sign in to tip' }, { status: 401 });

    const { audius_user_id, from_wallet, amount } = await req.json();
    const amt = Number(amount);
    if (!audius_user_id || !from_wallet || !(amt > 0 && amt <= 1_000_000)) {
      return Response.json({ error: 'audius_user_id, from_wallet and a positive amount are required' }, { status: 400 });
    }

    const { wallet } = await getAudiusTipWallet(audius_user_id);
    const conn = new Connection(solanaRpcUrl(), 'confirmed');
    const mint = new PublicKey(AUDIO_MINT);
    const fan = new PublicKey(from_wallet);
    const source = getAssociatedTokenAddressSync(mint, fan);

    const tx = new Transaction();
    let dest = new PublicKey(wallet);
    // Audius spl_wallet is normally a token account (user bank). If it is a
    // plain wallet instead, send to its associated token account.
    const info = await conn.getParsedAccountInfo(dest);
    const parsed: any = info.value?.data;
    const isAudioTokenAccount = parsed?.program === 'spl-token' && parsed?.parsed?.info?.mint === AUDIO_MINT;
    if (!isAudioTokenAccount) {
      const owner = dest;
      dest = getAssociatedTokenAddressSync(mint, owner, true);
      tx.add(createAssociatedTokenAccountIdempotentInstruction(fan, dest, owner, mint));
    }

    const raw = BigInt(Math.round(amt * 10 ** AUDIO_DECIMALS));
    tx.add(createTransferCheckedInstruction(source, mint, dest, fan, raw, AUDIO_DECIMALS));
    tx.feePayer = fan;
    tx.recentBlockhash = (await conn.getLatestBlockhash('confirmed')).blockhash;

    return Response.json({ message: bs58.encode(tx.serializeMessage()), to_wallet: wallet });
  } catch (error) {
    console.error('buildAudiusTipTx failed', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}