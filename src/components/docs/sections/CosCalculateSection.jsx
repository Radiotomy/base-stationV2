import EndpointHeader from '../EndpointHeader';
import ParamsTable from '../ParamsTable';
import CodeBlock from '../CodeBlock';

const REQUEST = `POST /api/v1/cos/calculate
Authorization: Bearer <YOUR_API_TOKEN>
Content-Type: application/json

{
  "asset_id": "ua_9f83bd21",
  "telemetry": {
    "prompt": "Dark synthwave at 108 BPM in F minor, verse-chorus-bridge…",
    "userProvidedContent": true,
    "styleOrTags": ["synthwave", "dark", "retro"],
    "referenceFile": false,
    "personaOrTemplate": true,
    "isIteration": true,
    "humanInstrumentPerformance": false
  }
}`;

const RESPONSE = `{
  "asset_id": "ua_9f83bd21",
  "cos_engine": "2.0",
  "human_participation_score": 72,
  "telemetry_confidence": 89,
  "ai_disclosure_label": "ai_assisted",
  "ai_disclosure_basis": "Original lyrics, custom persona and 4 refinement passes indicate substantial human creative direction.",
  "participation_signals": {
    "user_content":        { "points": 35, "granted": true  },
    "deep_prompt":         { "points": 18, "granted": true  },
    "musical_specificity": { "points": 6,  "granted": false },
    "reference_material":  { "points": 12, "granted": false },
    "persona_used":        { "points": 9,  "granted": true  },
    "custom_style":        { "points": 6,  "granted": true  },
    "iteration":           { "points": 8,  "granted": true  }
  },
  "dimensions": {
    "content_authorship": { "points": 35, "max": 35, "pct": 100 },
    "creative_direction": { "points": 18, "max": 45, "pct": 40 },
    "sonic_identity":     { "points": 6,  "max": 22, "pct": 27 },
    "vocal_identity":     { "points": 9,  "max": 9,  "pct": 100 },
    "craft_refinement":   { "points": 8,  "max": 20, "pct": 40 }
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
          Computes the Creative Ownership Score for an asset from its participation telemetry using{' '}
          <span className="text-foreground font-medium">COS Engine 2.0</span>. Prompt depth is graded on a curve,
          musical direction is detected from the prompt's vocabulary, and every granted point rolls up into one of
          five creative dimensions. Returns the 0–100 score, the derived RIAA/IFPI-style disclosure label, a
          human-readable basis, the full signal breakdown, the dimension roll-up, and a telemetry-confidence metric.
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
          { name: 'telemetry', type: 'object', required: true, description: 'Participation telemetry object (see fields below). The more fields reported, the higher the telemetry confidence.' },
          { name: 'telemetry.prompt', type: 'string', required: false, description: 'The creator-authored prompt. Depth is graded: 40+ chars (+7), 100+ (+14), 200+ (+18); musical vocabulary (BPM, key, structure) adds +6.' },
          { name: 'telemetry.userProvidedContent', type: 'boolean', required: false, description: 'Creator supplied their own lyrics, melody, or recording (+35).' },
          { name: 'telemetry.styleOrTags', type: 'array', required: false, description: 'Genre/mood/style selections (+6); 3+ selections earn a rich-palette bonus (+4).' },
          { name: 'telemetry.referenceFile', type: 'boolean', required: false, description: 'Creator uploaded reference audio, image, or document (+12).' },
          { name: 'telemetry.personaOrTemplate', type: 'boolean', required: false, description: 'A creator-designed voice persona or template was used (+9).' },
          { name: 'telemetry.isIteration', type: 'boolean', required: false, description: 'The work refines, remixes, or extends prior work (+8).' },
          { name: 'telemetry.humanInstrumentPerformance', type: 'boolean', required: false, description: 'A recorded human performance is part of the work (+12).' },
          { name: 'telemetry.hasSyntheticVocals', type: 'boolean', required: false, description: 'Synthetic or cloned vocals were used (feeds DDEX vocal attribution).' },
          { name: 'telemetry.isAutomatedMaster', type: 'boolean', required: false, description: 'Mastering was performed by automated utilities (feeds DDEX post-production attribution).' },
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
          { name: 'cos_engine', type: 'string', required: true, description: 'Scoring engine version ("2.0").' },
          { name: 'telemetry_confidence', type: 'number', required: true, description: '0–100 — how much of the creative process was actually observed by telemetry.' },
          { name: 'ai_disclosure_label', type: 'string', required: true, description: '"ai_generated" (score < 40) or "ai_assisted" (score ≥ 40).' },
          { name: 'ai_disclosure_basis', type: 'string', required: true, description: 'Human-readable explanation of the label assignment.' },
          { name: 'participation_signals', type: 'object', required: true, description: 'Per-signal points and whether each was granted.' },
          { name: 'dimensions', type: 'object', required: true, description: 'Five-dimension roll-up — points, ceiling, and percentage per creative dimension.' },
        ]}
      />
    </div>
  );
}