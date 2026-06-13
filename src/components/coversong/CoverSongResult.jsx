import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sparkles, Save, Download, Loader2, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

/**
 * Displays the generated cover song(s) — Sonic returns up to 2 clips.
 * Lets the user preview, save each as a library asset, and download.
 */
export default function CoverSongResult({ data, sourceUrl, title }) {
  const [saving, setSaving] = useState({}); // { [url]: bool }
  const [savedUrls, setSavedUrls] = useState(new Set());
  const autoSavedRef = useRef(false);

  const clips = data?.audio_urls && data.audio_urls.length > 0
    ? data.audio_urls.map((u, i) => ({
        url: u,
        cover: (data.cover_image_urls && data.cover_image_urls[i]) || data.cover_image_url,
        clip_id: (data.clip_ids && data.clip_ids[i]) || data.clip_id,
      }))
    : data?.audio_url
      ? [{ url: data.audio_url, cover: data.cover_image_url, clip_id: data.clip_id }]
      : [];

  // Track proxied (Base44-hosted) URLs so the audio element always loads
  // even when the provider CDN (musicapi-cdn.b-cdn.net) blocks CORS or expires the link.
  const [playableUrls, setPlayableUrls] = useState({}); // { [originalUrl]: base44Url }

  // Auto-save every finished clip to the Library so the user never loses a generated cover,
  // even if they navigate away before clicking Save. ALSO re-host via proxyAudioAsset so the
  // saved file is on Base44 storage (provider CDN URLs expire / lack CORS).
  useEffect(() => {
    if (autoSavedRef.current || clips.length === 0) return;
    autoSavedRef.current = true;
    (async () => {
      try {
        const me = await base44.auth.me();
        const existing = await base44.entities.UserAsset.filter({ user_id: me.id, asset_type: 'track' }, '-created_date', 50).catch(() => []);
        const existingClipIds = new Set(existing.map(a => a?.metadata?.clip_id).filter(Boolean));

        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i];
          if (clip.clip_id && existingClipIds.has(clip.clip_id)) {
            setSavedUrls(s => new Set([...s, clip.url]));
            // Recover the Base44-hosted URL from the existing asset if present
            const existingAsset = existing.find(a => a?.metadata?.clip_id === clip.clip_id);
            if (existingAsset?.file_url) {
              setPlayableUrls(p => ({ ...p, [clip.url]: existingAsset.file_url }));
            }
            continue;
          }

          // Re-host via proxy so the file lives on Base44 storage permanently
          let hostedUrl = clip.url;
          try {
            const proxy = await base44.functions.invoke('proxyAudioAsset', {
              source_url: clip.url,
              filename: `cover-${clip.clip_id || i}.mp3`,
            });
            if (proxy?.data?.file_url) hostedUrl = proxy.data.file_url;
          } catch (e) {
            console.warn('Proxy failed, falling back to provider URL:', e.message);
          }
          setPlayableUrls(p => ({ ...p, [clip.url]: hostedUrl }));

          await base44.entities.UserAsset.create({
            user_id: me.id,
            user_email: me.email,
            asset_type: 'track',
            title: `${title || data.title || 'Cover'} ${clips.length > 1 ? `(v${i + 1})` : ''}`.trim(),
            description: `AI cover song · ${data.model_version || 'sonic'} · ${data.tags || ''}`.trim(),
            file_url: hostedUrl,
            thumbnail_url: clip.cover || undefined,
            origin: 'creator',
            tags: ['cover-song', 'sonic', data.model_version].filter(Boolean),
            metadata: {
              task_kind: 'cover_song',
              source_url: sourceUrl,
              original_provider_url: clip.url,
              clip_id: clip.clip_id,
              provider_clip_id: clip.clip_id,
              model_version: data.model_version,
              lyrics: data.lyrics || '',
              tags: data.tags || '',
              duration: data.duration,
              cover_image_url: clip.cover,
              auto_saved: true,
              provenance: { created_by: 'cover_song_studio', source: sourceUrl },
            },
          });
          setSavedUrls(s => new Set([...s, clip.url]));
        }
        toast.success(`Auto-saved ${clips.length} cover${clips.length > 1 ? 's' : ''} to your Library`, { icon: '📚' });
      } catch (err) {
        console.warn('Auto-save failed:', err.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.audio_url, data?.audio_urls?.length]);

  if (clips.length === 0) return null;

  const saveToLibrary = async (clip, index) => {
    setSaving(s => ({ ...s, [clip.url]: true }));
    try {
      const me = await base44.auth.me();
      const asset = await base44.entities.UserAsset.create({
        user_id: me.id,
        user_email: me.email,
        asset_type: 'track',
        title: `${title || data.title || 'Cover'} ${clips.length > 1 ? `(v${index + 1})` : ''}`.trim(),
        description: `AI cover song · ${data.model_version || 'sonic'} · ${data.tags || ''}`.trim(),
        file_url: clip.url,
        thumbnail_url: clip.cover || undefined,
        origin: 'creator',
        tags: ['cover-song', 'sonic', data.model_version].filter(Boolean),
        metadata: {
          task_kind: 'cover_song',
          source_url: sourceUrl,
          clip_id: clip.clip_id,
          provider_clip_id: clip.clip_id,
          model_version: data.model_version,
          lyrics: data.lyrics || '',
          tags: data.tags || '',
          duration: data.duration,
          cover_image_url: clip.cover,
          provenance: {
            created_by: 'cover_song_studio',
            source: sourceUrl,
          },
        },
      });
      setSavedUrls(s => new Set([...s, clip.url]));
      toast.success(`Saved "${asset.title}" to library`);
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
    setSaving(s => ({ ...s, [clip.url]: false }));
  };

  return (
    <div className="merc-card rounded-2xl border border-emerald-500/30 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-bold text-emerald-400">
          {clips.length > 1 ? `${clips.length} Versions Ready` : 'Ready'}
        </span>
        {data.model_version && <Badge variant="outline" className="text-xs ml-auto">{data.model_version}</Badge>}
      </div>

      <div className="flex items-center justify-between text-[11px] px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <span className="text-emerald-300">✓ Auto-saved to your Library</span>
        <Link to="/asset-gallery" className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1">
          <Library className="w-3 h-3" /> View Library
        </Link>
      </div>

      <div className="space-y-4">
        {clips.map((clip, i) => {
          const isSaving = !!saving[clip.url];
          const isSaved = savedUrls.has(clip.url);
          return (
            <div key={clip.url} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center gap-3">
                {clip.cover && (
                  <img src={clip.cover} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    Version {i + 1}
                  </p>
                  {data.duration && (
                    <p className="text-[10px] text-muted-foreground">
                      {Math.round(data.duration)}s · {data.model_version}
                    </p>
                  )}
                </div>
              </div>
              <audio src={playableUrls[clip.url] || clip.url} controls className="w-full" preload="metadata" />
              <div className="flex gap-2">
                <Button onClick={() => saveToLibrary(clip, i)} disabled={isSaving || isSaved}
                  variant="outline" className="flex-1 rounded-lg text-xs gap-1.5">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {isSaved ? 'Saved' : 'Save to Library'}
                </Button>
                <a href={playableUrls[clip.url] || clip.url} download className="flex-1">
                  <Button variant="ghost" className="w-full rounded-lg text-xs gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {data.lyrics && (
        <details className="rounded-xl border border-border bg-muted/20 p-3">
          <summary className="text-xs font-bold text-foreground cursor-pointer">Generated Lyrics</summary>
          <pre className="mt-2 text-[11px] text-muted-foreground whitespace-pre-wrap font-mono">{data.lyrics}</pre>
        </details>
      )}
    </div>
  );
}