import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LayoutList } from 'lucide-react';
import { readArrangement, editRegion, BAR_PX } from '@/lib/audiotool/arrangement';
import { unwrap } from '@/lib/audiotool/nexusErrors';
import ArrangementRegionBlock from './ArrangementRegionBlock';
import RegionInspector from './RegionInspector';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';
import MercuryDisplayHeader from '@/components/audiotool/mercury/MercuryDisplayHeader';

const grid = { backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 1px, transparent 1px ${BAR_PX}px)` };

export default function ArrangementView({ nexus, version, onChanged, title = 'Arrangement' }) {
  const { tracks, bars } = useMemo(() => readArrangement(nexus), [nexus, version]);
  const [selectedId, setSelectedId] = useState('');
  const selected = tracks.flatMap((t) => t.regions).find((r) => r.id === selectedId);

  const edit = async (region, change) => {
    try { unwrap(await editRegion(nexus, region, change)); onChanged?.(); }
    catch (e) { toast.error(`Audiotool rejected the edit — ${e.message}`); }
  };

  return (
    <section className="rack-unit space-y-3">
      <MercuryDisplayHeader icon={LayoutList} title={title} status={`${bars} bars · ${tracks.length} tracks`} live={tracks.length > 0}
        extra={<InfoTip text={TIPS.arrangement} />} />
      <p className="text-xs text-muted-foreground px-1">Drag a region to move it · tap to edit or label a section</p>
      {tracks.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border px-4 py-6 text-center">
          Nothing on the timeline yet — anything you write below lands here live.
        </p>
      ) : (
        <div className="overflow-x-auto rack-screen">
          <div style={{ width: bars * BAR_PX }}>
            <div className="flex h-6 border-b border-border">
              {Array.from({ length: bars }, (_, i) => (
                <div key={i} style={{ width: BAR_PX }} className="shrink-0 text-[10px] font-mono text-muted-foreground pl-1 pt-1">{i + 1}</div>
              ))}
            </div>
            {tracks.map((t) => (
              <div key={t.id} style={grid} className="relative h-12 border-b border-border/50 last:border-b-0">
                {t.regions.map((r) => (
                  <ArrangementRegionBlock key={r.id} region={r} selected={r.id === selectedId}
                    onSelect={() => setSelectedId(r.id)} onMove={(start) => edit(r, { start })} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {selected && <RegionInspector region={selected} onEdit={(c) => edit(selected, c)} onClose={() => setSelectedId('')} />}
    </section>
  );
}