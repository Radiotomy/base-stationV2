import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle, Download, Save, RotateCcw, Image, Palette, ChevronsRight, Mic2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MidiExportButton from '@/components/music/MidiExportButton';

/**
 * Finished Quick Generate track: cover art, players for every take, the lyric the
 * ID3 tags carry, and the post-generation actions.
 *
 * `saved` covers BOTH the server-side auto-save and a manual one — the save
 * action is disabled once either has happened, because a second press would file
 * a duplicate recording rather than update the first.
 */
export default function QuickResultCard({
  result, audioUrl, lyrics, generatingCover,
  saving, saved, onSave,
  extending, onExtend, onReset, title,
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-emerald-500/30 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-bold text-emerald-400">Track Ready</span>
        {result?.bpm && <Badge variant="outline" className="text-xs">{result.bpm} BPM</Badge>}
        {result?.key && <Badge variant="outline" className="text-xs">{result.key}</Badge>}
      </div>

      <div className="flex items-start gap-4">
        {generatingCover ? (
          <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : result?.cover_image_url ? (
          <img src={result.cover_image_url} alt="Cover art" className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-border" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 border border-border">
            <Image className="w-6 h-6 text-muted-foreground opacity-30" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <Image className="w-3 h-3" />
            {generatingCover ? 'Generating cover art…' : result?.cover_image_url ? 'Auto-generated cover art' : 'Cover art'}
          </p>
          <Link to="/cover-art-studio">
            <Button variant="outline" size="sm" className="text-xs gap-1 rounded-lg">
              <Palette className="w-3 h-3" /> Upgrade in Cover Art Studio
            </Button>
          </Link>
        </div>
      </div>

      <audio controls className="w-full rounded-xl" src={audioUrl} />

      {lyrics && (
        <details className="rounded-xl bg-muted/50 border border-border overflow-hidden">
          <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-2">
            <Mic2 className="w-3.5 h-3.5 text-pink-400" /> Lyrics (embedded in ID3 tags)
          </summary>
          <pre className="px-4 py-3 text-xs text-muted-foreground whitespace-pre-wrap font-sans max-h-72 overflow-y-auto border-t border-border">
            {lyrics}
          </pre>
        </details>
      )}

      {result?.audio_urls?.length > 1 && result.audio_urls.slice(1).map((url, i) => (
        <div key={url} className="space-y-1">
          <p className="text-xs text-muted-foreground font-semibold">🎵 Track {i + 2}</p>
          <audio controls className="w-full rounded-xl" src={url} />
        </div>
      ))}

      {result?.extended_url && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-semibold">🎵 Extended Version</p>
          <audio controls className="w-full rounded-xl" src={result.extended_url} />
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button onClick={onSave} disabled={saving || saved}
          className="flex-1 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold">
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : saved ? 'In Your Library' : 'Save to Library'}
        </Button>
        <a href={audioUrl} download className="flex-1">
          <Button variant="outline" className="w-full gap-2 rounded-xl">
            <Download className="w-4 h-4" /> Download
          </Button>
        </a>
        <MidiExportButton clipId={result?.clip_id} bpm={result?.bpm} musicalKey={result?.key} title={title || 'Track'} />
        <Button variant="outline" onClick={onExtend} disabled={extending}
          className="gap-2 rounded-xl text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10">
          {extending ? <RotateCcw className="w-4 h-4 animate-spin" /> : <ChevronsRight className="w-4 h-4" />}
          {extending ? 'Extending…' : 'Extend'}
        </Button>
        <Button variant="outline" onClick={onReset} className="gap-2 rounded-xl">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}