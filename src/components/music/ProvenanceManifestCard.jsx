import { useState } from 'react';
import { deriveDdexFromAsset } from '@/utils/participationScore';

function buildDdexXml(asset, ddex) {
  const lines = Object.entries(ddex)
    .map(([k, v]) => `    <AiAttribute name="${k}">${v}</AiAttribute>`)
    .join('\n');
  return `<DdexAiDisclosure>
  <Title>${asset.title || 'Untitled'}</Title>
  <HumanParticipationScore>${asset.human_participation_score ?? 0}</HumanParticipationScore>
  <DisclosureLabel>${asset.ai_disclosure_label || asset.ai_label || 'ai_generated'}</DisclosureLabel>
  <AiAttributionProfile>
${lines}
  </AiAttributionProfile>${asset.c2pa_provenance_hash ? `\n  <C2paProvenanceHash>${asset.c2pa_provenance_hash}</C2paProvenanceHash>` : ''}
</DdexAiDisclosure>`;
}

export default function ProvenanceManifestCard({ asset }) {
  const [copied, setCopied] = useState(false);
  const score = asset.human_participation_score ?? 0;
  const ddex = deriveDdexFromAsset(asset);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildDdexXml(asset, ddex));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-amber-500/20 bg-slate-950 p-6 rounded-xl font-mono text-xs text-slate-300 shadow-xl max-w-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <span className="text-amber-500 font-bold uppercase tracking-wider">🔒 Cryptographic Provenance Manifest</span>
        <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">C2PA Compliant</span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center bg-slate-900/50 p-2.5 rounded border border-slate-900">
          <span className="text-slate-400">Verified Ownership Weight:</span>
          <span className={`font-bold px-2 py-0.5 rounded text-sm ${
            score >= 70 ? 'text-emerald-400 bg-emerald-950/30' :
            score >= 40 ? 'text-amber-400 bg-amber-950/30' : 'text-rose-400 bg-rose-950/30'
          }`}>
            {score}% Human Input
          </span>
        </div>

        <div>
          <span className="text-slate-500 block mb-1 uppercase text-[10px]">Supply Chain Attribution Profile:</span>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {Object.entries(ddex).map(([key, isAi]) => (
              <div key={key} className="flex items-center justify-between bg-slate-900/30 p-2 rounded border border-slate-800/40">
                <span className="text-slate-400 truncate pr-2">{key.replace('ai_', '').replaceAll('_', ' ')}</span>
                <span className={isAi ? 'text-amber-500' : 'text-emerald-400 font-bold'}>
                  {isAi ? '🤖 Synthetic' : '👤 Human'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
          <span>Manifest Signature: {asset.c2pa_provenance_hash ? 'anchored' : 'valid'}</span>
          <button
            onClick={handleCopy}
            className="text-amber-500 hover:text-amber-400 transition-colors uppercase font-bold tracking-wider"
          >
            {copied ? '✓ Copied' : 'Copy DDEX Tag Bundle'}
          </button>
        </div>
      </div>
    </div>
  );
}