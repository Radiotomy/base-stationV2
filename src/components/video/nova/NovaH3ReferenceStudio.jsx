import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import ReferenceMediaInput from '@/components/video/ReferenceMediaInput';
import InfoTip from '@/components/common/InfoTip';
import { NOVA_REF_LIMITS } from '@/config/novaH3Spec';

/**
 * Nova's two conditioning paths, kept visibly separate because the model treats
 * them as different checkpoints and refuses a shot that mixes them:
 *
 *  · Keyframes (FL2VA) — anchor the opening frame, the closing frame, or both.
 *  · Omni references (Ref2VA) — up to 9 images, 3 videos and 3 audio clips
 *    within 12 files total; order is preserved through the conditioner, so the
 *    list order here is meaningful rather than cosmetic.
 */
export default function NovaH3ReferenceStudio({
  refMode, setRefMode,
  firstFrame, setFirstFrame,
  lastFrame, setLastFrame,
  references, setReferences,
}) {
  const counts = references.reduce((acc, r) => {
    acc[r.kind] = (acc[r.kind] || 0) + 1;
    return acc;
  }, {});
  const limitFor = (kind) => NOVA_REF_LIMITS[kind === 'image' ? 'images' : kind === 'video' ? 'videos' : 'audio'];
  const canAdd = (kind) => references.length < NOVA_REF_LIMITS.total && (counts[kind] || 0) < limitFor(kind);

  const addRef = (kind) => setReferences([...references, { kind, url: '' }]);
  const setRefUrl = (i, url) => setReferences(references.map((r, idx) => (idx === i ? { ...r, url } : r)));
  const removeRef = (i) => setReferences(references.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { id: 'none', label: 'Prompt only' },
          { id: 'keyframes', label: 'Keyframes' },
          { id: 'omni', label: 'Reference studio' },
        ].map((t) => (
          <button key={t.id} type="button" onClick={() => setRefMode(t.id)}
            className={`flex-1 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${refMode === t.id ? 'border-indigo-500 bg-indigo-500/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-indigo-500/40'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {refMode === 'keyframes' && (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            One frame animates outward from it. Two create a controlled transition between them. Frames are
            cover-cropped to the format you picked.
          </p>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase">First frame</p>
            <ReferenceMediaInput kind="image" value={firstFrame} onChange={setFirstFrame} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Last frame</p>
            <ReferenceMediaInput kind="image" value={lastFrame} onChange={setLastFrame} />
          </div>
        </div>
      )}

      {refMode === 'omni' && (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            Up to 9 images, 3 videos and 3 audio clips — 12 files total. Video and audio clips must each be
            2–15 seconds.
            <InfoTip text="Reference order is preserved through the conditioner and the joint video/audio denoiser, so the order you add them in is part of the instruction. Omni references always run the full 28-step path." />
          </p>

          {references.map((r, i) => (
            <div key={i} className="p-2.5 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground capitalize">{i + 1}. {r.kind}</span>
                <Button variant="ghost" size="sm" onClick={() => removeRef(i)} className="h-7 px-2">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <ReferenceMediaInput kind={r.kind} value={r.url} onChange={(url) => setRefUrl(i, url)} />
            </div>
          ))}

          <div className="flex gap-2 flex-wrap">
            {['image', 'video', 'audio'].map((kind) => (
              <Button key={kind} variant="outline" size="sm" disabled={!canAdd(kind)}
                onClick={() => addRef(kind)} className="gap-1.5 rounded-lg">
                <Plus className="w-3.5 h-3.5" /> {kind}
                <span className="text-[10px] text-muted-foreground">{counts[kind] || 0}/{limitFor(kind)}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}