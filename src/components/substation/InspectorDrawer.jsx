import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PanelRightClose } from 'lucide-react';
import FxRack from './FxRack';
import SplitSheet from './SplitSheet';
import CosHandoffPanel from './CosHandoffPanel';

export default function InspectorDrawer({ session, patch, onClose }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#09090b]/80 p-2.5 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-white/45 font-mono">Inspector</span>
        <button onClick={onClose} className="text-white/35 hover:text-white"><PanelRightClose className="w-3.5 h-3.5" /></button>
      </div>

      <Tabs defaultValue="fx" className="flex-1 min-h-0 flex flex-col">
        <TabsList className="grid grid-cols-3 h-8 bg-black/40">
          <TabsTrigger value="fx" className="text-[10px]">FX Rack</TabsTrigger>
          <TabsTrigger value="splits" className="text-[10px]">Splits</TabsTrigger>
          <TabsTrigger value="cos" className="text-[10px]">COS</TabsTrigger>
        </TabsList>
        <div className="flex-1 overflow-y-auto pt-2.5 pr-1">
          <TabsContent value="fx" className="mt-0">
            <FxRack fx={session.fx} onChange={(fx) => patch({ fx })} />
          </TabsContent>
          <TabsContent value="splits" className="mt-0">
            <SplitSheet splits={session.splits} onChange={(splits) => patch({ splits })} />
          </TabsContent>
          <TabsContent value="cos" className="mt-0">
            <CosHandoffPanel
              session={session}
              patchMeta={(m) => patch({ meta: { ...session.meta, ...m } })}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}