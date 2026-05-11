import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Award, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Phase 1 — Triggers the secure backend PDF certificate generator and downloads the file.
 */
export default function DownloadCertificateButton({ registrationId, blockchainType, trackTitle }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!registrationId || !blockchainType) return;
    setLoading(true);

    // Frontend analytics — button click
    try {
      base44.analytics.track({
        eventName: 'certificate_download_button_click',
        properties: { registrationId, blockchainType },
      });
    } catch (_) { /* silent */ }

    try {
      const response = await base44.functions.invoke(
        'generateTrackCertificate',
        { registrationId, blockchainType },
        { responseType: 'blob' }
      );

      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'application/pdf' });

      const safeTitle = String(trackTitle || 'certificate').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificate_${blockchainType}_${safeTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Certificate downloaded');
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to download certificate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleDownload}
      disabled={loading}
      className="h-8 gap-1.5 rounded-lg bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
      <span className="text-xs font-semibold">Certificate</span>
    </Button>
  );
}