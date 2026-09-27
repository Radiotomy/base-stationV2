// On-chain verification for non-custodial tips. A tip is only recorded after
// the chain itself confirms the artist's wallet received value — the client's
// claim that it sent a tip is never trusted.
import { ethers } from 'npm:ethers@6.13.4';

export const isBaseAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a || '');
export const isSolanaAddress = (a: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a || '');

export async function verifyBaseTip(txHash: string, toWallet: string) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('Invalid Base transaction hash');
  const provider = new ethers.JsonRpcProvider(Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org', 8453, { staticNetwork: true });
  const receipt = await provider.waitForTransaction(txHash, 1, 60000);
  if (!receipt || receipt.status !== 1) throw new Error('Transaction not confirmed or reverted');
  const tx = await provider.getTransaction(txHash);
  if (!tx || (tx.to || '').toLowerCase() !== toWallet.toLowerCase()) throw new Error("Transaction was not sent to the artist's Base wallet");
  if (tx.value <= 0n) throw new Error('Transaction carried no value');
  return { amount: Number(ethers.formatEther(tx.value)), symbol: 'ETH', from: tx.from };
}

export async function verifySolanaTip(signature: string, toWallet: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(signature)) throw new Error('Invalid Solana signature');
  const res = await fetch('https://api.mainnet-beta.solana.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'getTransaction',
      params: [signature, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
    }),
  });
  const tx = (await res.json())?.result;
  if (!tx) throw new Error('Transaction not found yet — wait a few seconds and retry');
  if (tx.meta?.err) throw new Error('Transaction failed on-chain');
  const keys = tx.transaction.message.accountKeys.map((k: any) => k.pubkey || k);
  const idx = keys.indexOf(toWallet);
  if (idx < 0) throw new Error("Transaction did not involve the artist's Solana wallet");
  const delta = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
  if (delta <= 0) throw new Error("Artist's wallet received no SOL");
  return { amount: delta / 1e9, symbol: 'SOL', from: keys[0] };
}