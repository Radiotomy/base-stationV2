// SSRF guard — only allow public http(s) hostnames, never IP literals
// (including shorthand/hex/octal/decimal forms like 127.1, 0x7f.1, 0177.0.0.1,
// 2130706433), loopback, or internal hosts. Shared by all functions that fetch
// a caller-supplied URL server-side (Pinata pinning, rehosting, ID3 tagging, etc.).

// True when every dot-separated label is numeric (decimal, hex, or octal) —
// such hostnames parse as IPv4 addresses in all their shorthand forms.
function isIpLiteral(host: string): boolean {
  const labels = host.split('.').filter((l) => l.length > 0);
  if (labels.length === 0) return true;
  return labels.every((l) => /^(0x[0-9a-f]+|[0-9]+)$/i.test(l));
}

export function assertSafeUrl(raw: string): string {
  let u;
  try { u = new URL(raw); } catch { throw new Error('Invalid URL'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only http(s) URLs are allowed');
  const host = u.hostname.toLowerCase().replace(/\.+$/, ''); // strip trailing dots
  if (
    host.includes(':') ||            // IPv6 literals ([::1], etc.)
    isIpLiteral(host) ||             // any IPv4 form: full, shorthand, hex, octal, integer
    host === 'localhost' || host.endsWith('.localhost') ||
    host.endsWith('.local') || host.endsWith('.internal') ||
    !host.includes('.')              // bare single-label hosts (intranet names)
  ) throw new Error('URL host not allowed');
  return u.toString();
}