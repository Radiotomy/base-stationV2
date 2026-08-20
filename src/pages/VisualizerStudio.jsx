import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Film, Loader2, Wand2, Upload, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import StudioPageHeader from '@/components/studio/StudioPageHeader';
import AssetPicker from '@/components/studio/AssetPicker';
import MilkdropVisualizer from '@/components/studio/MilkdropVisualizer';
import PresetPicker from '@/components/studio/PresetPicker';
import ProvenancePanel from '@/components/studio/ProvenancePanel';
import AddToProjectButton from '@/components/studio/AddToProjectButton';
import InfoTip from '@/components/common/InfoTip';
import PatchModulationTap from '@/components/visualizer/PatchModulationTap';

export default function VisualizerStudio() {
  const params = new URLSearchParams(window.location.search);
  const preselected = params.get('assetId');

  const [source, setSource] = useState('library'); // 'library' | 'upload'
  const [selected, setSelected] = useState(preselected ? [preselected] : []);
  const [uploadedAssetId, setUploadedAssetId] = useState(null);
  const [uploadedName, setUploadedName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preset, setPreset] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [modLevel, setModLevel] = useState(0);

  const handleDirectUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Upload to Base44 storage (CORS-enabled), then register as a UserAsset
      // so the visualizer backend can find it by assetId.
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const user = await base44.auth.me();
      const asset = await base44.entities.UserAsset.create({
        user_id: user.id,
        user_email: user.email,
        asset_type: 'track',
        title: file.name.replace(/\.[^/.]+$/, ''),
        file_url,
        origin: 'creator',
        tags: ['uploaded', 'visualizer-input'],
        metadata: { source: 'direct_upload' },
      });
      setUploadedAssetId(asset.id);
      setUploadedName(file.name);
      setSelected([asset.id]);
      toast.success('Track ready!');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(false);
  };

  const generate = async () => {
    const assetId = source === 'upload' ? uploadedAssetId : selected[0];
    if (!assetId) { toast.error(source === 'upload' ? 'Upload a track first' : 'Pick a track first'); return; }
    if (!preset) { toast.error('Pick a MilkDrop preset first'); return; }
    setRunning(true);
    try {
      const r = await base44.functions.invoke('generateVisualizer', { assetId, style: preset });
      const asset = r.data?.data?.asset || r.data?.asset;
      setResult(asset);
      toast.success('Visualizer generated!', { icon: '🎬' });
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Visualizer failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={Film} accent="purple"
        title="AI Visualizer Studio"
        subtitle="Generate animated music videos and visualizers from any track."
        badge="Phase 3" />

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              1. Track
              <InfoTip text="Direct PC uploads give the most reactive visualizers. Library tracks served via CloudFront may fall back to synthetic mode due to CORS." />
            </h3>

            {/* Source toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSource('library')}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all ${source === 'library'
                  ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-purple-500/40'}`}>
                <Library className="w-3.5 h-3.5" /> From Library
              </button>
              <button onClick={() => setSource('upload')}
                className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold transition-all ${source === 'upload'
                  ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                  : 'border-border bg-muted/30 text-muted-foreground hover:border-purple-500/40'}`}>
                <Upload className="w-3.5 h-3.5" /> Upload from PC
              </button>
            </div>

            {source === 'library' && (
              <AssetPicker assetType="track" selected={selected} onChange={setSelected} />
            )}

            {source === 'upload' && (
              <label className={`block cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                <input type="file" accept="audio/*" onChange={handleDirectUpload} className="hidden" />
                <div className="border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-purple-500 transition-colors">
                  {uploading ? <Loader2 className="w-6 h-6 mx-auto text-purple-400 animate-spin" />
                             : <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />}
                  <p className="text-xs text-muted-foreground mt-1">
                    {uploadedName || 'Click to upload (MP3, WAV, FLAC)'}
                  </p>
                  {uploadedAssetId && !uploading && (
                    <p className="text-[10px] text-emerald-400 mt-1">✓ Ready for visualizer</p>
                  )}
                </div>
              </label>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              2. MilkDrop Preset
              <InfoTip text="Real MilkDrop visualizations rendered with Butterchurn — the same engine behind BeatDrop and the community preset collections. Search, pick, or shuffle a preset." />
            </h3>
            <PresetPicker value={preset} onChange={setPreset} />
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              3. Patch Modulation
              <InfoTip text="Tap a BASE Foundry patch's LFO or envelope and let it drive the visuals, so the picture moves with the processing instead of just the amplitude. The patch runs silently — it never alters your audio." />
            </h3>
            <PatchModulationTap onLevel={setModLevel} />
          </div>

          <Button onClick={generate} disabled={running || (source === 'library' ? selected.length === 0 : !uploadedAssetId)}
            className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 gap-2 font-bold">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {running ? 'Rendering…' : 'Generate Visualizer'}
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!result && (
            <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
              <Film className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Pick a track and a MilkDrop preset.</p>
            </div>
          )}

          {result && (
            <>
              <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold truncate">{result.title}</p>
                  <AddToProjectButton asset={result} tool="visualizer_studio" toolRoute="/visualizer-studio" />
                </div>
                <MilkdropVisualizer src={result.file_url} presetName={result.metadata?.visualizer_style || preset} title={result.title} modulation={modLevel} />
              </div>
              <ProvenancePanel asset={result} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}