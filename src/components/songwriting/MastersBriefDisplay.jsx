import { motion } from 'framer-motion';
import { Crown, Music2, Layers, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Renders the rich 243 Masters output: lyrics + chords + arrangement + brief.
 * Read-only display. Used in Lyrics Studio and Music Studio.
 */
export default function MastersBriefDisplay({ result }) {
  if (!result) return null;
  const { title, key, bpm, chord_progression = [], arrangement = [], production_brief, masters_used = [] } = result;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="space-y-4 p-4 rounded-2xl bg-gradient-to-br from-amber-500/5 to-purple-500/5 border border-amber-500/30">

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Crown className="w-4 h-4 text-amber-300" />
        <span className="text-xs font-black text-amber-300 uppercase tracking-wider">243 Masters Engine</span>
        {title && <span className="text-sm font-bold text-foreground">· {title}</span>}
        {key && <Badge variant="outline" className="text-xs border-amber-500/40">{key}</Badge>}
        {bpm && <Badge variant="outline" className="text-xs border-amber-500/40">{bpm} BPM</Badge>}
      </div>

      {/* Masters informing this job */}
      {masters_used.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-amber-300/70 uppercase tracking-wider mb-1.5">Channeling the craft of</p>
          <div className="flex flex-wrap gap-1.5">
            {masters_used.map(m => (
              <span key={m.n} className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                {m.n} <span className="text-amber-300/60">· {m.r}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Chord progression */}
      {chord_progression.length > 0 && (
        <div>
          <p className="text-xs font-black text-foreground flex items-center gap-1.5 mb-2">
            <Music2 className="w-3.5 h-3.5 text-amber-300" /> Chord Progression
          </p>
          <div className="space-y-1.5">
            {chord_progression.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 text-xs p-2 rounded-lg bg-background/40">
                <span className="col-span-3 font-bold text-amber-300 truncate">{c.section}</span>
                <span className="col-span-4 font-mono text-foreground truncate" title={c.nashville}>{c.nashville}</span>
                <span className="col-span-5 font-mono text-muted-foreground truncate" title={c.roman}>{c.roman}</span>
                {c.notes && <span className="col-span-12 text-[10px] text-muted-foreground italic pl-1">{c.notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arrangement */}
      {arrangement.length > 0 && (
        <div>
          <p className="text-xs font-black text-foreground flex items-center gap-1.5 mb-2">
            <Layers className="w-3.5 h-3.5 text-amber-300" /> Arrangement Notes
          </p>
          <div className="space-y-1.5">
            {arrangement.map((a, i) => (
              <div key={i} className="text-xs p-2 rounded-lg bg-background/40 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-300">{a.section}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{a.dynamics}</span>
                </div>
                <p className="text-muted-foreground leading-snug">{a.instrumentation}</p>
                {a.production_detail && (
                  <p className="text-[11px] text-amber-200/70 italic leading-snug">→ {a.production_detail}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Production brief */}
      {production_brief && (
        <div>
          <p className="text-xs font-black text-foreground flex items-center gap-1.5 mb-2">
            <FileText className="w-3.5 h-3.5 text-amber-300" /> Production Brief
            <span className="text-[10px] text-amber-300/60 font-normal normal-case">ready for Music Studio</span>
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed p-2.5 rounded-lg bg-background/40 italic">
            "{production_brief}"
          </p>
        </div>
      )}
    </motion.div>
  );
}