import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Wand2, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import VoiceChainPicker from './VoiceChainPicker';
import { renderVoiceChain } from '@/lib/foundry/voiceChainRender';

// Applies a Foundry voice chain to an existing voiceover asset, saving the
// result as a NEW asset — the unprocessed take is never overwritten, so a
// chain the creator dislikes costs nothing.
export default function ApplyVoiceChainCard({ asset, onApplied }) {
  const { toast } = useToast();
  const [chain, setChain] = useState(null);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!chain) return;
    setBusy(true);
    try {
      const safe = (asset.title || 'segment').replace(/[^a-z0-9\s-]/gi, '').trim().replace(/\s+/g, '_');
      const { file, duration, sampleRate } = await renderVoiceChain(
        asset.file_url,
        chain.graph_state,
        { filename: `${safe}_${chain.title.replace(/\s+/g, '_')}.wav` },
      );
      const uploaded = await base44.integrations.Core.UploadFile({ file });
      const me = await base44.auth.me();

      const created = await base44.entities.OrvoPodcastAsset.create({
        user_id: me.id,
        podcast_id: asset.podcast_id,
        asset_type: 'voiceover',
        title: `${asset.title} — ${chain.title}`,
        file_url: uploaded.file_url,
        duration_seconds: duration,
        metadata: {
          ...(asset.metadata || {}),
          duration_seconds: duration,
          sample_rate: sampleRate,
          format: 'wav-16bit',
          source_asset_id: asset.id,
          // Processing record, NOT an authorship record. A voice chain shapes
          // tone; it does not speak, so per the ORVO attestation rule nothing
          // here may be read as changing who made the audio. Episode
          // declared_origin is intentionally untouched by this path.
          voice_chain: {
            plugin_id: chain.id,
            title: chain.title,
            parameter_snapshot: chain.dsp_definition || null,
            applied_at: new Date().toISOString(),
            affects_origin: false,
          },
        },
      });

      toast({ title: 'Voice chain applied', description: `Saved as "${created.title}".` });
      setChain(null);
      onApplied?.();
    } catch (e) {
      toast({ title: 'Could not apply chain', description: e.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5">
      <VoiceChainPicker selected={chain} onSelect={setChain} disabled={busy} />

      <button
        onClick={apply}
        disabled={busy || !chain}
        className="merc-button rounded-full px-4 py-1.5 text-[11px] font-black flex items-center gap-1.5 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
        {busy ? 'Rendering…' : 'Apply to a new copy'}
      </button>

      <p className="text-[10px] text-white/35 flex items-start gap-1.5">
        <ShieldCheck className="w-3 h-3 mt-px shrink-0 text-emerald-400/70" />
        Tone shaping only — your episode&apos;s origin attestation is unchanged, because processing
        isn&apos;t authorship.
      </p>
    </div>
  );
}