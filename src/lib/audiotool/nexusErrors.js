// The Nexus SDK returns Error values instead of throwing, and wraps API failures
// as "…threw error" with the server's actual reason on .cause. Unwrap into one
// readable error so creators see why Audiotool refused, not a generic wrapper.
export function unwrap(v) {
  if (!(v instanceof Error)) return v;
  console.error('[Audiotool]', v, v.cause);
  const reason = v.cause?.rawMessage || v.cause?.message || (v.cause ? String(v.cause) : '');
  throw new Error(reason && !v.message.includes(reason) ? `${v.message} — ${reason}` : v.message);
}