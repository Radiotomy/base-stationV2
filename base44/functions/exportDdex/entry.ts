import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * DDEX Export — POST { assetId }
 * Generates and returns a downloadable DDEX-style AI disclosure XML file
 * for the asset. Access: owner, admin, or any authenticated caller when
 * the asset is public.
 */
function xmlEscape(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assetId } = await req.json().catch(() => ({}));
    if (!assetId) return Response.json({ error: 'assetId required' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.UserAsset.filter({ id: assetId });
    const asset = rows[0];
    if (!asset) return Response.json({ error: 'Asset not found' }, { status: 404 });

    if (!asset.is_public && asset.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'This asset is not public' }, { status: 403 });
    }

    const s = asset.participation_signals || {};
    const score = asset.human_participation_score ?? 0;
    const ddex = (asset.ddex_ai_metadata && Object.keys(asset.ddex_ai_metadata).length > 0)
      ? asset.ddex_ai_metadata
      : {
          ai_lyrical_content: !s.user_content,
          ai_composition: score < 50,
          ai_instrumentation: !s.reference_material,
          ai_generated_vocals: !!s.persona_used,
          ai_post_production: asset.asset_type === 'master',
        };

    const attrLines = Object.entries(ddex)
      .map(([k, v]) => `    <AiAttribute name="${xmlEscape(k)}">${!!v}</AiAttribute>`)
      .join('\n');
    const signalLines = Object.entries(s)
      .map(([k, v]) => `    <Signal name="${xmlEscape(k)}" points="${xmlEscape(v)}"/>`)
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DdexAiDisclosure version="1.0" generatedAt="${new Date().toISOString()}">
  <AssetId>${xmlEscape(asset.id)}</AssetId>
  <Title>${xmlEscape(asset.title || 'Untitled')}</Title>
  <HumanParticipationScore>${score}</HumanParticipationScore>
  <DisclosureLabel>${xmlEscape(asset.ai_disclosure_label || asset.ai_label || 'ai_generated')}</DisclosureLabel>
  <DisclosureBasis>${xmlEscape(asset.ai_disclosure_basis || '')}</DisclosureBasis>
  <AiAttributionProfile>
${attrLines}
  </AiAttributionProfile>
  <ParticipationSignals>
${signalLines}
  </ParticipationSignals>${asset.c2pa_provenance_hash ? `\n  <C2paProvenanceHash>${xmlEscape(asset.c2pa_provenance_hash)}</C2paProvenanceHash>` : ''}${asset.metadata?.base_mark?.payload_hex ? `\n  <BaseMarkWatermark version="${xmlEscape(asset.metadata.base_mark.version || '1.0')}">${xmlEscape(asset.metadata.base_mark.payload_hex)}</BaseMarkWatermark>` : ''}
  <LabelingStandard>RIAA/IFPI voluntary GenAI labeling program (July 2026)</LabelingStandard>
</DdexAiDisclosure>`;

    const safeTitle = String(asset.title || 'asset').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="ddex_disclosure_${safeTitle}.xml"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});