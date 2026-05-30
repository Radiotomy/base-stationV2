import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * WavDownloadButton — smart WAV download button.
 *
 * Why it exists: aimusicapi.ai does not pre-publish WAV files to its CDN.
 * Constructed URLs (e.g. /stems/{clip_id}.wav) return 404. Instead, WAVs must be
 * fetched on-demand via POST /api/v1/sonic/wav — which we wrap in our backend
 * function `getWavUrl`. Producer/Tempolor return a `wav_url` at task completion,
 * which we accept directly.
 *
 * Props:
 *   - wavUrl?: string  — direct provider-returned wav_url (Producer/Tempolor)
 *   - clipId?: string  — Sonic clip_id used to fetch the WAV on-demand
 *   - provider?: 'sonic' | 'producer' | 'tempcolor'
 *   - title?: string   — used for the downloaded filename
 */
export default function WavDownloadButton({ wavUrl, clipId, provider = 'sonic', title = 'track', className = '', size = 'sm', variant = 'outline' }) {
  const [loading, setLoading] = useState(false);

  // If we don't have either a direct URL or a clip_id, render nothing
  if (!wavUrl && !clipId) return null;

  const handleDownload = async () => {
    setLoading(true);
    try {
      let finalUrl = wavUrl;

      // Sonic: WAV is on-demand — always re-fetch a fresh signed URL
      if (provider === 'sonic' && clipId) {
        const res = await base44.functions.invoke('getWavUrl', { clip_id: clipId, provider: 'sonic' });
        finalUrl = res?.data?.wav_url;
        if (!finalUrl) throw new Error('No WAV URL returned by provider');
      }

      if (!finalUrl) throw new Error('WAV is not available for this track');

      // Verify the URL actually resolves (HEAD check) — surfaces 404s before
      // the browser triggers a confusing redirect to the CDN's 404 page.
      const head = await fetch(finalUrl, { method: 'HEAD' }).catch(() => null);
      if (!head || !head.ok) {
        throw new Error('The WAV file is not ready yet — please try again in a moment.');
      }

      // Trigger download
      const a = document.createElement('a');
      a.href = finalUrl;
      a.download = `${title}.wav`;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'WAV download failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleDownload} disabled={loading} size={size} variant={variant} className={`gap-2 rounded-xl ${className}`}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {loading ? 'Preparing WAV…' : 'Download WAV'}
    </Button>
  );
}