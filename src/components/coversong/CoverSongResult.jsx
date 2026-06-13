import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Save, Download, Loader2 } from 'lucide-react';
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

  const clips = data?.audio_urls && data.audio_urls.length > 0
    ? data.audio_urls.map((u, i) => ({
        url: u,
        cover: (data.cover_image_urls && data.cover_image_urls[i]) || data.cover_image_url,
        clip_id: (data.clip_ids && data.clip_ids[i]) || data.clip_id,
      }))
    : data?.audio_url
      ? [{ url: data.audio_url, cover: data.cover_image_url, clip_id: data.clip_id }]
      : [];

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
          {clips.length > 1 ? `${clips.length} Cover Versions Ready` : 'Cover Ready'}
        </span>
        {data.model_version && <Badge variant="outline" className="text-xs ml-auto">{data.model_version}</Badge>}
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
              <audio src={clip.url} controls className="w-full" />
              <div className="flex gap-2">
                <Button onClick={() => saveToLibrary(clip, i)} disabled={isSaving || isSaved}
                  variant="outline" className="flex-1 rounded-lg text-xs gap-1.5">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {isSaved ? 'Saved' : 'Save to Library'}
                </Button>
                <a href={clip.url} download className="flex-1">
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