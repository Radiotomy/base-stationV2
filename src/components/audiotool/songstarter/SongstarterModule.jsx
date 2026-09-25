import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Rocket } from 'lucide-react';
import InstrumentChainPanel from '@/components/audiotool/InstrumentChainPanel';
import SemanticLoopSearch from '@/components/loops/SemanticLoopSearch';
import LoopDiscoverTab from '@/components/loops/LoopDiscoverTab';
import CommunityLoopsTab from '@/components/loops/CommunityLoopsTab';
import { BridgeSessionContext } from './BridgeSessionContext';
import SendToAudiotoolButton from './SendToAudiotoolButton';
import ForgeLoopGenerator from './ForgeLoopGenerator';
import SfxGenerator from './SfxGenerator';

// Library loops that were themselves AI-generated are logged as AI material,
// so the Creative Ownership meter doesn't count them as human-made.
const isAi = (item) => item.source === 'soundforge' || item.license === 'AI Generated';

const librarySend = (item) => (
  <SendToAudiotoolButton url={item.file_url} name={item.title || 'Loop'} bpm={item.bpm}
    aiTool={isAi(item) ? 'library_ai_sample' : undefined} className="w-full" />
);
// Freesound CC-BY attribution travels with the region name.
const freesoundSend = (r) => (
  <SendToAudiotoolButton url={r.preview_url} name={`${r.name} by ${r.username}`} className="w-full" />
);

const TABS = [
  ['chain', 'Instrument Chain'], ['forge', 'BASE Forge Loops'], ['sfx', 'Sound FX'],
  ['search', 'Search by Sound'], ['free', 'Discover Free Loops'], ['community', 'Community Library'],
];

export default function SongstarterModule({ at, nexus, projectUrl, onChanged }) {
  return (
    <BridgeSessionContext.Provider value={{ at, nexus, projectUrl, onChanged }}>
      <section className="rounded-2xl border border-border p-5 space-y-4">
        <div>
          <h3 className="font-bold flex items-center gap-2"><Rocket className="w-4 h-4" /> Songstarter</h3>
          <p className="text-sm text-muted-foreground">
            Generate or find sounds, audition them here, then send them straight onto your Audiotool timeline.
          </p>
        </div>
        <Tabs defaultValue="forge">
          <TabsList className="flex flex-wrap h-auto justify-start">
            {TABS.map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="chain"><InstrumentChainPanel at={at} nexus={nexus} projectUrl={projectUrl} onChanged={onChanged} /></TabsContent>
          <TabsContent value="forge"><ForgeLoopGenerator /></TabsContent>
          <TabsContent value="sfx"><SfxGenerator /></TabsContent>
          <TabsContent value="search"><SemanticLoopSearch renderExtra={librarySend} /></TabsContent>
          <TabsContent value="free"><LoopDiscoverTab renderExtra={freesoundSend} /></TabsContent>
          <TabsContent value="community"><CommunityLoopsTab renderExtra={librarySend} /></TabsContent>
        </Tabs>
      </section>
    </BridgeSessionContext.Provider>
  );
}