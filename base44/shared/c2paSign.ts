// C2PA claim signing — ES256 with the CAI SDK's published DEVELOPER TEST
// certificate (contentauth/c2pa-rs sdk/tests/fixtures/certs/es256.pem + .pub).
//
// What this is, stated plainly:
//   • A real ECDSA P-256 / SHA-256 signature over the canonical claim, with the
//     signer's X.509 chain attached (x5c), serialized as a detached JWS.
//   • The chain roots in "C2PA Test Root CA / FOR TESTING_ONLY". It is on no
//     C2PA trust list, and its private key is public by design, so a signature
//     proves the claim was not altered after sealing — it does NOT prove who
//     sealed it. Every result is therefore labelled 'signed_test_cert' and
//     trust:'untrusted_test_root', never 'verified'.
//   • It is a sidecar (JSON) manifest, not a JUMBF store embedded in the WAV.
//
// Swapping in a production certificate later is a secret change only:
// C2PA_SIGNING_KEY (PKCS#8 PEM) + C2PA_SIGNING_CERT (PEM chain, leaf first).

const TEST_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgfNJBsaRLSeHizv0m
GL+gcn78QmtfLSm+n+qG9veC2W2hRANCAAQPaL6RkAkYkKU4+IryBSYxJM3h77sF
iMrbvbI8fG7w2Bbl9otNG/cch3DAw5rGAPV7NWkyl3QGuV/wt0MrAPDo
-----END PRIVATE KEY-----`;

const TEST_CERT_CHAIN_PEM = `-----BEGIN CERTIFICATE-----
MIIChzCCAi6gAwIBAgIUcCTmJHYF8dZfG0d1UdT6/LXtkeYwCgYIKoZIzj0EAwIw
gYwxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTESMBAGA1UEBwwJU29tZXdoZXJl
MScwJQYDVQQKDB5DMlBBIFRlc3QgSW50ZXJtZWRpYXRlIFJvb3QgQ0ExGTAXBgNV
BAsMEEZPUiBURVNUSU5HX09OTFkxGDAWBgNVBAMMD0ludGVybWVkaWF0ZSBDQTAe
Fw0yMjA2MTAxODQ2NDBaFw0zMDA4MjYxODQ2NDBaMIGAMQswCQYDVQQGEwJVUzEL
MAkGA1UECAwCQ0ExEjAQBgNVBAcMCVNvbWV3aGVyZTEfMB0GA1UECgwWQzJQQSBU
ZXN0IFNpZ25pbmcgQ2VydDEZMBcGA1UECwwQRk9SIFRFU1RJTkdfT05MWTEUMBIG
A1UEAwwLQzJQQSBTaWduZXIwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQPaL6R
kAkYkKU4+IryBSYxJM3h77sFiMrbvbI8fG7w2Bbl9otNG/cch3DAw5rGAPV7NWky
l3QGuV/wt0MrAPDoo3gwdjAMBgNVHRMBAf8EAjAAMBYGA1UdJQEB/wQMMAoGCCsG
AQUFBwMEMA4GA1UdDwEB/wQEAwIGwDAdBgNVHQ4EFgQUFznP0y83joiNOCedQkxT
tAMyNcowHwYDVR0jBBgwFoAUDnyNcma/osnlAJTvtW6A4rYOL2swCgYIKoZIzj0E
AwIDRwAwRAIgOY/2szXjslg/MyJFZ2y7OH8giPYTsvS7UPRP9GI9NgICIDQPMKrE
LQUJEtipZ0TqvI/4mieoyRCeIiQtyuS0LACz
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIICajCCAg+gAwIBAgIUfXDXHH+6GtA2QEBX2IvJ2YnGMnUwCgYIKoZIzj0EAwIw
dzELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRIwEAYDVQQHDAlTb21ld2hlcmUx
GjAYBgNVBAoMEUMyUEEgVGVzdCBSb290IENBMRkwFwYDVQQLDBBGT1IgVEVTVElO
R19PTkxZMRAwDgYDVQQDDAdSb290IENBMB4XDTIyMDYxMDE4NDY0MFoXDTMwMDgy
NzE4NDY0MFowgYwxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJDQTESMBAGA1UEBwwJ
U29tZXdoZXJlMScwJQYDVQQKDB5DMlBBIFRlc3QgSW50ZXJtZWRpYXRlIFJvb3Qg
Q0ExGTAXBgNVBAsMEEZPUiBURVNUSU5HX09OTFkxGDAWBgNVBAMMD0ludGVybWVk
aWF0ZSBDQTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABHllI4O7a0EkpTYAWfPM
D6Rnfk9iqhEmCQKMOR6J47Rvh2GGjUw4CS+aLT89ySukPTnzGsMQ4jK9d3V4Aq4Q
LsOjYzBhMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQW
BBQOfI1yZr+iyeUAlO+1boDitg4vazAfBgNVHSMEGDAWgBRembiG4Xgb2VcVWnUA
UrYpDsuojDAKBggqhkjOPQQDAgNJADBGAiEAtdZ3+05CzFo90fWeZ4woeJcNQC4B
84Ill3YeZVvR8ZECIQDVRdha1xEDKuNTAManY0zthSosfXcvLnZui1A/y/DYeg==
-----END CERTIFICATE-----`;

export const SIGNED_TEST_CERT = 'signed_test_cert';
export const SIGNED_TEST_CERT_LABEL = 'signed (developer test certificate)';

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const pemBlocks = (pem: string) =>
  [...pem.matchAll(/-----BEGIN [A-Z ]+-----([\s\S]*?)-----END [A-Z ]+-----/g)].map((m) => m[1].replace(/\s+/g, ''));
const derOf = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Deterministic JSON (sorted keys) so the signed bytes are reproducible. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter((k) => (v as any)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((v as any)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

// P-256 SubjectPublicKeyInfo is a fixed 91-byte DER sequence with this prefix,
// so the leaf certificate's key can be lifted out without an X.509 parser.
const P256_SPKI_PREFIX = [0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00];
function spkiFromCert(der: Uint8Array) {
  outer: for (let i = 0; i + 91 <= der.length; i++) {
    for (let j = 0; j < P256_SPKI_PREFIX.length; j++) if (der[i + j] !== P256_SPKI_PREFIX[j]) continue outer;
    return der.slice(i, i + 91);
  }
  throw new Error('Signing certificate does not carry a P-256 key');
}

function signerMaterial() {
  const custom = Deno.env.get('C2PA_SIGNING_KEY') && Deno.env.get('C2PA_SIGNING_CERT');
  return {
    keyPem: custom ? Deno.env.get('C2PA_SIGNING_KEY')! : TEST_KEY_PEM,
    chainPem: custom ? Deno.env.get('C2PA_SIGNING_CERT')! : TEST_CERT_CHAIN_PEM,
    testCert: !custom,
  };
}

/** Sign a claim. Returns the full signed manifest object. */
export async function signClaim(claim: Record<string, unknown>) {
  const { keyPem, chainPem, testCert } = signerMaterial();
  const key = await crypto.subtle.importKey(
    'pkcs8', derOf(pemBlocks(keyPem)[0]), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  const x5c = pemBlocks(chainPem);
  const header = { alg: 'ES256', typ: 'c2pa-claim+json', x5c };
  const protectedB64 = b64url(enc.encode(canonicalJson(header)));
  const payloadB64 = b64url(enc.encode(canonicalJson(claim)));
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${protectedB64}.${payloadB64}`),
  ));
  return {
    format: 'c2pa-json/detached-jws',
    status: testCert ? SIGNED_TEST_CERT : 'signed',
    status_label: testCert ? SIGNED_TEST_CERT_LABEL : 'signed',
    trust: testCert ? 'untrusted_test_root' : 'unverified_chain',
    signer: testCert ? 'C2PA Signer — C2PA Test Signing Cert (FOR TESTING_ONLY)' : 'custom',
    claim,
    signature: { alg: 'ES256', protected: protectedB64, value: b64url(sig) },
  };
}

/** Verify a signed manifest against the leaf certificate it carries. */
export async function verifySignedManifest(m: any) {
  try {
    const header = JSON.parse(new TextDecoder().decode(fromB64url(m.signature.protected)));
    const spki = spkiFromCert(derOf(header.x5c[0]));
    const pub = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const payloadB64 = b64url(enc.encode(canonicalJson(m.claim)));
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, pub, fromB64url(m.signature.value),
      enc.encode(`${m.signature.protected}.${payloadB64}`),
    );
  } catch {
    return false;
  }
}