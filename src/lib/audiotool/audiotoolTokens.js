// Keeps the creator's Audiotool access token fresh for work that runs server-side
// (the BASE Nexus Bridge ingest), where the browser SDK's own auto-refresh can't
// reach. Only the access token ever leaves the browser — the refresh token stays
// with the SDK, so a server task can never rotate it out from under the session.
const toMs = (v) => {
  if (v == null) return 0;
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Epoch ms when the current access token expires (0 if unknown). */
export const tokenExpiry = (at) => toMs(at?.exportTokens?.()?.expiresAt);

/**
 * Access token valid for at least `minValidMs`. If it's close to expiring, one
 * cheap authenticated call makes the SDK renew it before we hand it off.
 */
export async function freshAccessToken(at, minValidMs = 10 * 60 * 1000) {
  const expiry = tokenExpiry(at);
  if (expiry && expiry - Date.now() < minValidMs) {
    await at.projects.listProjects({ pageSize: 1 });
  }
  return at.exportTokens().accessToken;
}