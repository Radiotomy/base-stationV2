import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import WavDownloadButton from '@/components/music/WavDownloadButton';

/**
 * Dual-format download: tagged MP3 (always) + lossless WAV master (when one exists).
 *
 * The WAV is the file that carries the full BASE Mark cascade, but marking runs
 * asynchronously AFTER the asset is created. Downloading too early would hand the
 * user an unmarked master, so while the cascade is in flight the WAV button is
 * disabled. Once V2 completes, metadata.wav_url points at the marked master and
 * we serve that instead of the raw provider WAV.
 */
export default function MasterDownloadButtons({ mp3Url, wavUrl, clipId, provider, assetId, title = 'track' }) {
  const [markStatus, setMarkStatus] = useState(assetId ? 'pending' : 'none');
  const [markedWavUrl, setMarkedWavUrl] = useState(null);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    let tries = 0;

    const check = async () => {
      tries += 1;
      try {
        const asset = await base44.entities.UserAsset.get(assetId);
        const status = asset?.metadata?.base_mark_v2?.status;
        if (cancelled) return;
        if (status === 'completed') {
          setMarkedWavUrl(asset.metadata?.wav_url || null);
          setMarkStatus('completed');
          return;
        }
        if (status === 'failed') { setMarkStatus('failed'); return; }
        setMarkStatus('processing');
      } catch { /* keep waiting */ }
      // Cascade typically settles in 1–3 min on a warm GPU; stop nagging after ~4.
      if (!cancelled && tries < 24) setTimeout(check, 10000);
      else if (!cancelled) setMarkStatus('failed');
    };

    check();
    return () => { cancelled = true; };
  }, [assetId]);

  const waiting = markStatus === 'pending' || markStatus === 'processing';
  const hasWav = !!(markedWavUrl || wavUrl || clipId);

  return (
    <>
      <a href={mp3Url} download className="flex-1">
        <Button variant="outline" className="w-full gap-2 rounded-xl">
          <Download className="w-4 h-4" /> MP3 (tagged)
        </Button>
      </a>

      {hasWav && (waiting ? (
        <Button variant="outline" disabled className="gap-2 rounded-xl">
          <Loader2 className="w-4 h-4 animate-spin" /> Finalizing master…
        </Button>
      ) : (
        <WavDownloadButton
          wavUrl={markedWavUrl || wavUrl}
          clipId={markedWavUrl ? null : clipId}
          provider={provider}
          title={title}
          size="default"
        />
      ))}
    </>
  );
}