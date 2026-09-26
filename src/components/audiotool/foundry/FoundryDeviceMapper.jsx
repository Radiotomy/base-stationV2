import { useState } from 'react';
import { toast } from 'sonner';
import { SlidersHorizontal, RefreshCw, Send, Save, Cable } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import ParameterPanel from '@/components/foundry/ParameterPanel';
import useFoundryRemote from '@/hooks/useFoundryRemote';
import FoundryPatchPicker from './FoundryPatchPicker';
import NodeLinkRow from './NodeLinkRow';
import ParamMappingEditor from './ParamMappingEditor';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';

export default function FoundryDeviceMapper({ nexus, projectUrl, version }) {
  const [plugin, setPlugin] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const r = useFoundryRemote({ nexus, projectUrl, plugin, version });
  const nodes = (r.graph?.nodes || []).filter((n) => n.type !== 'input' && n.type !== 'output');
  const selected = nodes.find((n) => n.id === selectedId) || null;
  const link = selected && r.linkFor(selected.id);

  const save = async () => { await r.saveGraph(); toast.success('Knob positions saved to the Foundry patch.'); };

  return (
    <section className="rounded-2xl border border-border p-5 space-y-4">
      <div>
        <h3 className="font-bold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Foundry Remote <InfoTip text={TIPS.foundryRemote} size="sm" side="bottom" /></h3>
        <p className="text-sm text-muted-foreground">
          Link Foundry modules to Audiotool devices and map their parameters. Turning a knob here moves the matching knob in your live session.
        </p>
      </div>
      <FoundryPatchPicker value={plugin?.id} onPick={(p) => { setPlugin(p); setSelectedId(null); }} />

      {plugin && !r.map && <p className="text-xs text-muted-foreground">Loading mapping…</p>}
      {plugin && r.map && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><Switch checked={r.map.mirror_cables} onCheckedChange={r.setMirror} />
              <Cable className="w-3.5 h-3.5" /> Mirror patch routing to cables <InfoTip text={TIPS.mirrorCables} /></label>
            <Button size="sm" variant="ghost" onClick={r.refreshDevices}><RefreshCw className="w-3.5 h-3.5" /> Devices</Button>
            <Button size="sm" variant="outline" onClick={r.sendAll}><Send className="w-3.5 h-3.5" /> Send all values</Button>
            {plugin.user_id && <Button size="sm" variant="outline" onClick={save}><Save className="w-3.5 h-3.5" /> Save to patch</Button>}
          </div>
          {r.map.mirror_cables && <p className="text-xs text-muted-foreground">Cables between linked devices now follow this patch. {r.cableStatus}</p>}
          {r.error && <p className="text-xs text-destructive">Audiotool rejected a value — {r.error}. Adjust that mapping's range.</p>}
          {!r.devices.length && <p className="text-sm text-muted-foreground">No synths or effects in this session yet — add one (e.g. with Instrument Chain) and refresh devices.</p>}

          <div className="grid md:grid-cols-[240px_1fr] gap-4">
            <div className="space-y-2">
              {nodes.map((n) => (
                <NodeLinkRow key={n.id} node={n} link={r.linkFor(n.id)} devices={r.devices}
                  bypassed={r.map.bypassed.includes(n.id)} selected={n.id === selectedId}
                  onSelect={() => setSelectedId(n.id)} onLink={(id) => r.linkNode(n, id)} onBypass={(on) => r.setBypass(n.id, on)} />
              ))}
            </div>
            <div className="merc-card rounded-xl p-4 space-y-5">
              <ParameterPanel node={selected} onParamChange={r.setParam} />
              {selected && !link && <p className="text-xs text-muted-foreground">Link this module to an Audiotool device to control it remotely.</p>}
              {link && <ParamMappingEditor node={selected} link={link} fields={r.fieldsFor(link)} onChange={(p) => r.setLinkParams(selected.id, p)} />}
            </div>
          </div>
        </>
      )}
    </section>
  );
}