// SSRF guard — only allow public http(s) hostnames, never IP literals,
// loopback, or internal hosts. Shared by all functions that fetch a
// caller-supplied URL server-side (Pinata pinning, rehosting, etc.).
export function assertSafeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('Invalid URL'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only http(s) URLs are allowed');
  const host = u.hostname.toLowerCase();
  const ipv4 = /^\d{1,3}(\.\d{1,3}){3}$/;
  if (
    ipv4.test(host) || host.includes(':') ||
    host === 'localhost' || host.endsWith('.localhost') ||
    host.endsWith('.local') || host.endsWith('.internal') ||
    !host.includes('.')
  ) throw new Error('URL host not allowed');
  return u.toString();
}