import EndpointHeader from '../EndpointHeader';
import ParamsTable from '../ParamsTable';
import CodeBlock from '../CodeBlock';

const REQUEST = `POST /api/v1/ddex/export
Authorization: Bearer <YOUR_API_TOKEN>
Content-Type: application/json

{
  "asset_id": "ua_9f83bd21",
  "format": "ern-4.3",
  "include_manifest_link": true
}`;

const RESPONSE = `{
  "asset_id": "ua_9f83bd21",
  "format": "ern-4.3",
  "ddex_ai_metadata": {
    "ai_lyrical_content": false,
    "ai_composition": true,
    "ai_instrumentation": true,
    "ai_generated_vocals": false,
    "ai_post_production": true
  },
  "ai_disclosure_label": "ai_assisted",
  "human_participation_score": 72,
  "cos_engine": "2.0",
  "base_mark_watermark": {
    "payload_hex": "dff13efe",
    "layers": [
      { "version": "1.0", "layer": "spectral", "status": "embedded" },
      { "version": "2.0", "layer": "neural",   "status": "embedded" }
    ]
  },
  "manifest_url": "https://basestation.live/api/v1/cos/manifest/ua_9f83bd21",
  "export_url": "https://cdn.basestation.live/ddex/ua_9f83bd21.xml",
  "exported_at": "2026-07-19T15:26:04Z"
}`;

export default function DdexExportSection() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF9A4D] mb-2">API Reference</p>
        <h1 className="text-3xl font-display text-foreground mb-4">DDEX Export</h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl">
          Generates a DDEX-style AI attribution bundle for an asset — five granular boolean flags describing where
          generative AI was involved in the recording — packaged for delivery to distributors and DSP partner channels.
          Under COS Engine 2.0, each flag is derived directly from its matching creative dimension (Content Authorship,
          Creative Direction, Sonic Identity, Vocal Identity, Craft &amp; Refinement), so the attribution is telemetry-backed
          rather than self-declared.
        </p>
      </div>

      <EndpointHeader
        method="POST"
        path="/api/v1/ddex/export"
        description="Builds and returns the DDEX AI attribution profile plus a downloadable export bundle."
      />

      <ParamsTable
        title="Request body"
        params={[
          { name: 'asset_id', type: 'string', required: true, description: 'The BASE Station asset ID to export.' },
          { name: 'format', type: 'string', required: false, description: 'Export message format. Currently "ern-4.3" (default).' },
          { name: 'include_manifest_link', type: 'boolean', required: false, description: 'Include a link to the Provenance Manifest in the bundle. Default true.' },
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

      <ParamsTable
        title="ddex_ai_metadata flags"
        params={[
          { name: 'ai_lyrical_content', type: 'boolean', required: true, description: 'Lyrics were generated via LLM without human script input.' },
          { name: 'ai_composition', type: 'boolean', required: true, description: 'Baseline chord progressions or melodies were auto-generated.' },
          { name: 'ai_instrumentation', type: 'boolean', required: true, description: 'Backing stems or instruments were synthesised purely from text prompts.' },
          { name: 'ai_generated_vocals', type: 'boolean', required: true, description: 'Synthetic vocal profiles or cloned voice identities were used.' },
          { name: 'ai_post_production', type: 'boolean', required: true, description: 'Mastering or balance engineering was performed by automated utilities.' },
        ]}
      />

      <div className="rounded-xl border border-[#FF9A4D]/20 bg-[#FF9A4D]/5 p-5">
        <p className="font-bold text-foreground text-sm mb-1.5">Watermark cross-reference</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          When the asset carries a BASE Mark watermark, the export XML includes a{' '}
          <code className="text-[#FFC98A] text-xs">&lt;BaseMarkWatermark&gt;</code> element with the embedded
          payload — letting downstream partners verify that the delivered audio physically contains the
          identifier declared in the disclosure bundle. The payload is a single value shared by both embedded
          layers, so a partner recovering it with either detector is confirming the same record; the per-layer
          entries only report which layers are present on the delivered file.
        </p>
      </div>
    </div>
  );
}