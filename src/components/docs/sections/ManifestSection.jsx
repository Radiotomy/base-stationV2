import EndpointHeader from '../EndpointHeader';
import ParamsTable from '../ParamsTable';
import CodeBlock from '../CodeBlock';

const REQUEST = `GET /api/v1/cos/manifest/ua_9f83bd21
Authorization: Bearer <YOUR_API_TOKEN>`;

const RESPONSE = `{
  "manifest_version": "1.0",
  "asset_id": "ua_9f83bd21",
  "title": "Neon Riverbed",
  "asset_type": "track",
  "human_participation_score": 72,
  "ai_disclosure_label": "ai_assisted",
  "ai_label": "ai_assisted",
  "participation_signals": {
    "own_content":      { "points": 30, "granted": true  },
    "detailed_prompt":  { "points": 15, "granted": true  },
    "persona_preset":   { "points": 10, "granted": true  }
  },
  "ddex_ai_metadata": {
    "ai_lyrical_content": false,
    "ai_composition": true,
    "ai_instrumentation": true,
    "ai_generated_vocals": false,
    "ai_post_production": true
  },
  "c2pa_provenance_hash": "sha256:7c1e4a9b0d…",
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
          score, signal breakdown, DDEX AI attribution flags, cryptographic hash, and derivation chain. This is the URL
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
        <h4 className="text-sm font-semibold text-foreground">Verification</h4>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          The <code className="text-[#FFC98A] text-xs">c2pa_provenance_hash</code> is a SHA-256 checksum anchoring the COS
          metrics to the audio container. To verify an audio file, recompute the checksum over the manifest payload and
          compare it with the hash stored in the file's embedded <code className="text-[#FFC98A] text-xs">TXXX</code> frames —
          see the <span className="text-foreground font-medium">ID3v2 Compliance</span> section.
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