import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileDown, FileKey2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RightsActions({ asset, manifestOpen, onToggleManifest }) {
  const [downloading, setDownloading] = useState(false);

  const downloadDdex = async () => {
    setDownloading(true);
    try {
      const response = await base44.functions.invoke('exportDdex', { assetId: asset.id }, { responseType: 'blob' });
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: 'application/xml' });
      const safeTitle = String(asset.title || 'asset').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ddex_disclosure_${safeTitle}.xml`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('DDEX disclosure downloaded');
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || 'DDEX export failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="outline" onClick={downloadDdex} disabled={downloading}
        className="h-8 gap-1.5 rounded-lg text-xs font-semibold" title="Download DDEX AI disclosure XML">
        {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
        DDEX
      </Button>
      <button onClick={onToggleManifest} title="View Provenance Manifest"
        className={`p-2 rounded-lg border transition-colors ${manifestOpen ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' : 'border-border text-muted-foreground hover:text-amber-400'}`}>
        <FileKey2 className="w-4 h-4" />
      </button>
    </div>
  );
}