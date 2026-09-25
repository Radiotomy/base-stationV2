import { Input } from '@/components/ui/input';
import { NODE_DEFS } from '@/lib/foundry/nodeTypes';
import { defaultRange } from '@/lib/audiotool/deviceParams';

/** Per-parameter mapping: Foundry param → Audiotool field + the Audiotool range it scales onto. */
export default function ParamMappingEditor({ node, link, fields, onChange }) {
  const def = NODE_DEFS[node.type];
  const params = Object.entries(def?.params || {}).filter(([, p]) => p.type !== 'text');

  const setMapping = (param, patch) => {
    const rest = link.params.filter((m) => m.param !== param);
    if (patch === null) return onChange(rest);
    const cur = link.params.find((m) => m.param === param) || { param };
    onChange([...rest, { ...cur, ...patch }]);
  };

  const pickField = (param, path) => {
    if (!path) return setMapping(param, null);
    const f = fields.find((x) => x.path === path);
    const [min, max] = defaultRange(f);
    setMapping(param, { field: path, kind: f.kind, min, max });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase">Parameter mapping</p>
      {params.map(([key]) => {
        const m = link.params.find((x) => x.param === key);
        return (
          <div key={key} className="grid grid-cols-[90px_1fr_70px_70px] gap-2 items-end">
            <span className="text-xs capitalize pb-2">{key.replace(/_/g, ' ')}</span>
            <label className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Audiotool field</span>
              <select value={m?.field || ''} onChange={(e) => pickField(key, e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs text-foreground">
                <option value="">Not mapped</option>
                {fields.map((f) => <option key={f.path} value={f.path}>{f.path}</option>)}
              </select>
            </label>
            {m && m.kind === 'number' ? (
              <>
                <label className="space-y-1"><span className="text-[10px] text-muted-foreground">Min</span>
                  <Input className="h-8 text-xs" type="number" value={m.min} onChange={(e) => setMapping(key, { min: Number(e.target.value) })} /></label>
                <label className="space-y-1"><span className="text-[10px] text-muted-foreground">Max</span>
                  <Input className="h-8 text-xs" type="number" value={m.max} onChange={(e) => setMapping(key, { max: Number(e.target.value) })} /></label>
              </>
            ) : <span className="col-span-2" />}
          </div>
        );
      })}
    </div>
  );
}