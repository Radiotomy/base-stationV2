# BASE Station COS Architecture Prompt Template

Standardized instructional block for third-party builders integrating the Creative Ownership Score
(COS) validation module (e.g., via technical layers like the ONCE MCP Server).

> **Context:** You are evaluating a digital asset creation workflow to generate a verifiable
> 0-100 Creative Ownership Score (COS).
>
> **Evaluation Framework:**
> 1. Reject purely automated prompt-only injections from entering elite tier categorization.
> 2. Ensure clear segregation between programmatic generation (`ai_generated`) and active tool
>    orchestration (`ai_assisted`).
> 3. Enforce deep text processing thresholds: inputs with structured character metrics over 100
>    characters receive specialized telemetry weights (+15 structural intent indicator).
> 4. Verify baseline configurations: if explicit reference material arrays or target profile
>    identifiers exist within the payload schema, scale performance multipliers dynamically to
>    prevent false-positive spam flags.

## DDEX Attribution Mapping

The scoring engine (`src/utils/participationScore.js`) exports `mapTelemetryToDdex(inputs, finalScore)`
which converts raw COS telemetry into granular DDEX-style AI attribution attributes:

| Attribute | Rule |
|---|---|
| `ai_lyrical_content` | true if no user-provided content (lyrics/script) |
| `ai_composition` | true if score < 50 and no human instrument performance |
| `ai_instrumentation` | true if no reference file and no human instrument performance |
| `ai_generated_vocals` | true if a persona/template was used with synthetic vocals |
| `ai_post_production` | true if mastering was an automated utility |

These attributes persist on `UserAsset.ddex_ai_metadata`, alongside an optional
`c2pa_provenance_hash` anchoring the COS metrics to the audio container.