// Resolves an Audius artist's public Solana $AUDIO wallet (their "spl_wallet"
// user bank). Used by both the tip transaction builder and the verifier so the
// destination is always read from Audius itself, never from the client.
export const AUDIO_MINT = '9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM';
export const AUDIO_DECIMALS = 8;
// Public mainnet RPC rejects cloud IPs — use a dedicated provider (Helius, QuickNode…).
export const solanaRpcUrl = () => Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';

export async function getAudiusTipWallet(audiusUserId: string) {
  const url = new URL(`https://api.audius.co/v1/users/${encodeURIComponent(audiusUserId)}`);
  const key = Deno.env.get('AUDIUS_API_KEY');
  if (key) url.searchParams.set('api_key', key);
  else url.searchParams.set('app_name', 'BaseStation');
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Audius artist not found');
  const u = (await res.json())?.data;
  if (!u?.spl_wallet) throw new Error('This Audius artist has no $AUDIO wallet yet');
  return { wallet: u.spl_wallet as string, name: (u.name || u.handle) as string, handle: u.handle as string };
}