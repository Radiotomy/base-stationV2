import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Combine, Loader2, Wand2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

import StudioPageHeader from '@/components/studio/StudioPageHeader';
import AssetPicker from '@/components/studio/AssetPicker';
import StudioAudioPlayer from '@/components/audio/StudioAudioPlayer';
import ProvenancePanel from '@/components/studio/ProvenancePanel';
import AddToProjectButton from '@/components/studio/AddToProjectButton';
import CostBadge from '@/components/credits/CostBadge';
import { useJobPolling } from '@/hooks/useJobPolling';
import { handleCreditError } from '@/utils/creditErrors';
import { calculateHumanParticipationScore } from '@/utils/participationScore';

export default function MashupStudio() {
  const params = new URLSearchParams(window.location.search);
  const preselected = params.get('assetId');

  const [selected, setSelected] = useState(preselected ? [preselected] : []);
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [instrumental, setInstrumental] = useState(false);
  const [bpm, setBpm] = useState('');
  const [musicalKey, setMusicalKey] = useState('');

  const [jobId, setJobId] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  // ── Poll for completion ─────────────────────────────────────────────────
  useJobPolling(
    jobId,
    async (data) => {
      setRunning(false);
      setJobId(null);
      // Save the completed mashup as a UserAsset so it appears in the library
      try {
        const participation = calculateHumanParticipationScore({
          userProvidedContent: false,
          prompt: description,
          styleOrTags: tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : [],
          referenceFile: true,   // 2 user-selected source tracks
          isIteration: true,     // derived from prior works
        });
        const asset = await base44.entities.UserAsset.create({
          asset_type: 'mashup',
          title: data.title || title || 'Mashup',
          description: `Sonic mashup of 2 tracks`,
          file_url: data.audio_url,
          thumbnail_url: data.cover_image_url || undefined,
          origin: 'creator',
          ai_disclosure_label: participation.label,
          ai_disclosure_basis: participation.basis,
          human_participation_score: participation.score,
          participation_signals: participation.signals,
          tags: ['mashup', 'creator', ...(tags ? tags.split(',').map(s => s.trim()).filter(Boolean) : [])],
          metadata: {
            bpm: data.bpm || (bpm ? parseInt(bpm) : undefined),
            key: data.key || musicalKey || undefined,
            duration: data.duration,
            lyrics: data.lyrics,
            provider: 'sonic',
            model_version: data.model_version,
            clip_id: data.clip_id,
            source_count: 2,
            provenance: {
              created_by: 'mashup_studio',
              providers_used: ['sonic'],
              remix_sources: selected,
            },
          },
        });
        setResult(asset);
        toast.success('Mashup created!', { icon: '🎚️' });
      } catch (err) {
        toast.error('Mashup ready, but library save failed: ' + (err.message || 'unknown'));
        // Fall back to showing the raw audio URL
        setResult({
          title: data.title || title || 'Mashup',
          file_url: data.audio_url,
          metadata: { bpm: data.bpm, key: data.key },
        });
      }
    },
    (err) => {
      setRunning(false);
      setJobId(null);
      const msg = String(err || 'Mashup failed');
      if (/copyrighted|catalog|matches an existing recording/i.test(msg)) {
        toast.error('Copyrighted track blocked', {
          description: 'Sonic detected one of your tracks matches a commercial recording in their catalog and refused to mashup. Try original, royalty-free, or AI-generated tracks instead.',
          duration: 12000,
          icon: '🚫',
        });
      } else {
        toast.error(msg, { duration: 6000 });
      }
    },
    80,
  );

  const generate = async () => {
    if (selected.length !== 2) {
      toast.error('Sonic mashup requires exactly 2 tracks');
      return;
    }
    if (!description.trim() && !instrumental) {
      toast.error('Add a style description (or toggle Instrumental)');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const payload = {
        assetIds: selected,
        mv: 'sonic-v5',
        custom_mode: false,
        gpt_description_prompt: description.trim() || 'Energetic mashup blending both source tracks',
        title: title || undefined,
        tags: tags || undefined,
        make_instrumental: instrumental,
        options: {
          ...(bpm ? { bpm: parseInt(bpm) } : {}),
          ...(musicalKey ? { key: musicalKey } : {}),
        },
      };
      const r = await base44.functions.invoke('generateMashup', payload);
      const j = r.data?.job_id;
      if (!j) throw new Error(r.data?.error || 'No job_id returned');
      setJobId(j);
      toast.success('Mashup started — this can take 1-2 minutes…');
    } catch (e) {
      setRunning(false);
      if (!handleCreditError(e)) {
        toast.error(e?.response?.data?.error || e.message || 'Mashup failed');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={Combine} accent="amber"
        title="Mashup Studio"
        subtitle="Blend 2 tracks into a brand new song. Powered by Sonic AI."
        badge="Sonic Mashup" />

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="merc-card rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-black">1. Pick Exactly 2 Tracks</h3>
            <AssetPicker assetType="track" multi max={2}
              selected={selected} onChange={setSelected} />
            <p className="text-[10px] text-muted-foreground">
              {selected.length}/2 selected. Sonic requires exactly 2 source tracks.
            </p>
          </div>

          <div className="merc-card rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> 2. Style Description
            </h3>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. high-energy dance mashup with driving 808s and euphoric vocals"
              rows={4}
              maxLength={200}
              className="rounded-xl text-sm"
            />
            <p className="text-[10px] text-muted-foreground text-right">{description.length} / 200</p>
          </div>

          <div className="merc-card rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-black">3. Optional</h3>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="My Mashup" maxLength={80} className="rounded-xl text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">Style Tags</label>
              <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. edm, pop, mashup" className="rounded-xl text-sm" />
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border">
              <div>
                <p className="text-xs font-bold text-foreground">Instrumental</p>
                <p className="text-[10px] text-muted-foreground">No vocals</p>
              </div>
              <Switch checked={instrumental} onCheckedChange={setInstrumental} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">BPM Hint</label>
                <Input value={bpm} onChange={e => setBpm(e.target.value)} placeholder="Auto" type="number" className="rounded-xl text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">Key Hint</label>
                <Input value={musicalKey} onChange={e => setMusicalKey(e.target.value)} placeholder="Auto" className="rounded-xl text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1">
            <p className="text-xs text-amber-300">⚠️ Loudly catalog content cannot be mashed with Audius content (legal separation).</p>
            <p className="text-xs text-amber-300">🚫 Copyrighted commercial recordings will be blocked by Sonic. Use original or AI-generated tracks.</p>
          </div>

          <Button onClick={generate} disabled={running || selected.length !== 2}
            className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 gap-2 font-bold py-6">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {running ? 'Mashing…' : 'Generate Mashup'}
            {!running && <CostBadge cost={10} />}
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!result && !running && (
            <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
              <Combine className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Pick 2 tracks and describe the vibe you want.</p>
            </div>
          )}

          {running && !result && (
            <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
              <Loader2 className="w-10 h-10 mx-auto mb-3 text-amber-400 animate-spin" />
              <p className="text-sm font-bold mb-1">Mashing tracks together…</p>
              <p className="text-xs text-muted-foreground">Uploading sources, then blending. This takes 1-2 minutes.</p>
            </div>
          )}

          {result && (
            <>
              <div className="merc-card rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{result.title}</p>
                    <div className="flex gap-1.5 mt-1">
                      {result.metadata?.bpm && <Badge variant="outline" className="text-xs">{result.metadata.bpm} BPM</Badge>}
                      {result.metadata?.key && <Badge variant="outline" className="text-xs">{result.metadata.key}</Badge>}
                    </div>
                  </div>
                  {result.id && <AddToProjectButton asset={result} tool="mashup_studio" toolRoute="/mashup-studio" />}
                </div>
                <StudioAudioPlayer src={result.file_url} title={result.title} compact />
              </div>
              {result.id && <ProvenancePanel asset={result} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}