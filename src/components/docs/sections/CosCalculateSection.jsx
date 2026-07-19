import EndpointHeader from '../EndpointHeader';
import ParamsTable from '../ParamsTable';
import CodeBlock from '../CodeBlock';

const REQUEST = `POST /api/v1/cos/calculate
Authorization: Bearer <YOUR_API_TOKEN>
Content-Type: application/json

{
  "asset_id": "ua_9f83bd21",
  "signals": {
    "own_content": true,
    "detailed_prompt": true,
    "reference_upload": false,
    "persona_preset": true,
    "style_selection": true,
    "iteration_count": 4
  }
}`;

const RESPONSE = `{
  "asset_id": "ua_9f83bd21",
  "human_participation_score": 72,
  "ai_disclosure_label": "ai_assisted",
  "ai_disclosure_basis": "Original lyrics, custom persona and 4 refinement passes indicate substantial human creative direction.",
  "participation_signals": {
    "own_content":      { "points": 30, "granted": true  },
    "detailed_prompt":  { "points": 15, "granted": true  },
    "reference_upload": { "points": 15, "granted": false },
    "persona_preset":   { "points": 10, "granted": true  },
    "style_selection":  { "points": 7,  "granted": true  },
    "iteration":        { "points": 10, "granted": true  }
  },
  "calculated_at": "2026-07-19T15:26:04Z"
}`;

export default function CosCalculateSection() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF9A4D] mb-2">API Reference</p>
        <h1 className="text-3xl font-display text-foreground mb-4">Calculate COS</h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl">
          Computes the Creative Ownership Score for an asset from its participation telemetry. Returns the 0–100 score,
          the derived RIAA/IFPI-style disclosure label, a human-readable basis, and the full signal breakdown.
        </p>
      </div>

      <EndpointHeader
        method="POST"
        path="/api/v1/cos/calculate"
        description="Calculates and persists the Creative Ownership Score for the given asset."
      />

      <ParamsTable
        title="Request body"
        params={[
          { name: 'asset_id', type: 'string', required: true, description: 'The BASE Station asset ID to score.' },
          { name: 'signals', type: 'object', required: true, description: 'Participation telemetry object (see fields below).' },
          { name: 'signals.own_content', type: 'boolean', required: false, description: 'Creator supplied their own lyrics, melody, or recording.' },
          { name: 'signals.detailed_prompt', type: 'boolean', required: false, description: 'A substantive, creator-authored prompt directed the generation.' },
          { name: 'signals.reference_upload', type: 'boolean', required: false, description: 'Creator uploaded reference audio or stems.' },
          { name: 'signals.persona_preset', type: 'boolean', required: false, description: 'A creator-designed voice persona was used.' },
          { name: 'signals.style_selection', type: 'boolean', required: false, description: 'Deliberate genre/mood/structure choices were made.' },
          { name: 'signals.iteration_count', type: 'number', required: false, description: 'Number of refinement passes on the output.' },
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
        title="Response fields"
        params={[
          { name: 'human_participation_score', type: 'number', required: true, description: '0–100 Creative Ownership Score.' },
          { name: 'ai_disclosure_label', type: 'string', required: true, description: '"ai_generated" (score < 50) or "ai_assisted" (score ≥ 50).' },
          { name: 'ai_disclosure_basis', type: 'string', required: true, description: 'Human-readable explanation of the label assignment.' },
          { name: 'participation_signals', type: 'object', required: true, description: 'Per-signal points and whether each was granted.' },
        ]}
      />
    </div>
  );
}