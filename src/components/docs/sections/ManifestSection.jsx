import EndpointHeader from '../EndpointHeader';
import ParamsTable from '../ParamsTable';
import CodeBlock from '../CodeBlock';

const REQUEST = `GET /api/v1/cos/manifest/ua_9f83bd21
Authorization: Bearer <YOUR_API_TOKEN>`;

const RESPONSE = `{
  "manifest_version": "2.0",
  "cos_engine": "2.0",
  "asset_id": "ua_9f83bd21",
  "title": "Neon Riverbed",
  "asset_type": "track",
  "human_participation_score": 72,
  "ai_disclosure_label": "ai_assisted",
  "ai_label": "ai_assisted",
  "participation_signals": {
    "user_content": true,
    "deep_prompt":  true,
    "persona_used": true,
    "iteration":    true
  },

  "dimensions": {
    "content_authorship": { "label": "Content Authorship",  "pct": 100 },
    "creative_direction": { "label": "Creative Direction",  "pct": 40  },
    "sonic_identity":     { "label": "Sonic Identity",      "pct": 0   },
    "vocal_identity":     { "label": "Vocal Identity",      "pct": 100 },
    "craft_refinement":   { "label": "Craft & Refinement",  "pct": 40  }
  },
  "ddex_ai_metadata": {
    "ai_lyrical_content": false,
    "ai_composition": true,
    "ai_instrumentation": true,
    "ai_generated_vocals": false,
    "ai_post_production": true
  },
  "c2pa_provenance_hash": "sha256:7c1e4a9b0d…",
  "base_mark": {
    "status": "embedded",
    "mark_id": "dff13efe",
    "embedded_at": "2026-07-19T15:24:31Z"
  },
  "base_mark_layers": {
    "primary":   { "status": "embedded" },
    "secondary": { "status": "embedded" }
  },
  "provenance_chain": [
    { "parent_asset_id": null, "operation": "generate" },
    { "parent_asset_id": "ua_9f83bd21", "operation": "master" }
  ],
  "issued_at": "2026-07-19T15:26:04Z",
  "issuer": "BASE Station Provenance Ledger"
}`;

export default function ManifestSection() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF9A4D] mb-2">API Reference</p>
        <h1 className="text-3xl font-display text-foreground mb-4">Provenance Manifest</h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl">
          Retrieves the complete, verifiable Provenance Manifest for an asset — the canonical record joining the COS
          score, observed signal set, the COS Engine 2.0 five-dimension roll-up (Content Authorship, Creative Direction,
          Sonic Identity, Vocal Identity, Craft &amp; Refinement), DDEX AI attribution flags, cryptographic hash, and
          derivation chain. Signals are reported as <span className="text-foreground font-medium">presence only</span> and
          dimensions as percentages — per-signal point values are engine-internal and never exposed through partner
          endpoints. This is the URL
          embedded in the asset's ID3v2 <code className="text-[#FFC98A] text-xs">WXXX</code> frame.
        </p>
      </div>

      <EndpointHeader
        method="GET"
        path="/api/v1/cos/manifest/{asset_id}"
        description="Returns the canonical provenance manifest for the given asset."
      />

      <ParamsTable
        title="Path parameters"
        params={[
          { name: 'asset_id', type: 'string', required: true, description: 'The BASE Station asset ID whose manifest to fetch.' },
        ]}
      />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Example request</h4>
        <CodeBlock title="Request" language="http" code={REQUEST} />
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Example response — 200 OK</h4>
        <CodeBlock title="Response" code={RESPONSE} />
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Data integrity & storage</h4>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          The manifest is served <span className="text-foreground font-medium">live</span> from the platform's
          provenance ledger so scores and attribution always reflect the asset's current state. Permanence comes
          from a second layer: when an asset is registered on-chain, its full provenance bundle (audio, cover art,
          and metadata JSON including the COS metrics and DDEX flags) is pinned to
          <span className="text-foreground font-medium"> IPFS via Pinata</span>. IPFS content addressing makes the
          registered snapshot immutable — any change produces a different CID — and the resulting
          <code className="text-[#FFC98A] text-xs"> ipfs://</code> metadata URI plus the provenance hash are anchored
          in the Base or Solana registry record. The pinning pipeline enforces strict source-URL validation (SSRF
          protection) and keeps all storage credentials server-side.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Verification</h4>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          The <code className="text-[#FFC98A] text-xs">c2pa_provenance_hash</code> is a SHA-256 checksum anchoring the COS
          metrics to the audio container. To verify an audio file, recompute the checksum over the manifest payload and
          compare it with the hash stored in the file's embedded <code className="text-[#FFC98A] text-xs">TXXX</code> frames —
          see the <span className="text-foreground font-medium">ID3v2 Compliance</span> section. The{' '}
          <code className="text-[#FFC98A] text-xs">base_mark</code> object reports the asset&apos;s in-waveform
          forensic signature and its opaque{' '}
          <code className="text-[#FFC98A] text-xs">mark_id</code>. Scanning the audio returns the same{' '}
          <code className="text-[#FFC98A] text-xs">mark_id</code>, proving the audio and this manifest belong
          together even when all metadata has been stripped. Multiple layers carry the mark and each resolves
          independently, so a layer still reported as pending in{' '}
          <code className="text-[#FFC98A] text-xs">base_mark_layers</code> does not weaken the record — the
          signature is already authoritative. Layer technologies, payload structure and detection thresholds are
          confidential and never exposed through partner endpoints.
        </p>
      </div>

      <ParamsTable
        title="Error responses"
        params={[
          { name: '404', type: 'error', required: false, description: 'No asset exists with the given asset_id.' },
          { name: '403', type: 'error', required: false, description: 'The token does not have access to this asset.' },
        ]}
      />
    </div>
  );
}