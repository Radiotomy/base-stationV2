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
import VibeSessionStarter from './VibeSessionStarter';
import PreStarterPanel from '@/components/audiotool/prestarter/PreStarterPanel';
import AudiusRemixTab from './AudiusRemixTab';
import DemoSongPanel from './DemoSongPanel';
import AudiusContestsTab from '@/components/audiotool/contests/AudiusContestsTab';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';
import { FAMILIES, AI_ORIGIN_COLOR } from '@/lib/audiotool/familyColors';

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

// Tab dot = where the sound comes from: AI generation, sound libraries, or Audius.
const SOURCE = { ai: AI_ORIGIN_COLOR, library: FAMILIES.effect.color, audius: FAMILIES.eq.color };
const TABS = [
  ['demo', 'Demo Song', 'library'], ['vibe', 'Vibe → Session', 'ai'], ['prestarter', '60s Pre-Starter', 'ai'], ['chain', 'Instrument Chain', 'ai'], ['forge', 'BASE Forge Loops', 'ai'], ['sfx', 'Sound FX', 'ai'],
  ['search', 'Search by Sound', 'library'], ['free', 'Discover Free Loops', 'library'], ['community', 'Community Library', 'library'],
  ['contests', 'Audius Contests', 'audius'], ['audius', 'Remix from Audius', 'audius'],
];

export default function SongstarterModule({ at, nexus, projectUrl, onChanged }) {
  return (
    <BridgeSessionContext.Provider value={{ at, nexus, projectUrl, onChanged }}>
      <section className="rounded-2xl border border-border p-5 space-y-4">
        <div>
          <h3 className="font-bold flex items-center gap-2"><Rocket className="w-4 h-4" /> Songstarter <InfoTip text={TIPS.songstarter} size="sm" side="bottom" /></h3>
          <p className="text-sm text-muted-foreground">
            Generate or find sounds, audition them here, then send them straight onto your Audiotool timeline.
          </p>
        </div>
        <Tabs defaultValue="demo">
          <TabsList className="flex flex-wrap h-auto justify-start">
            {TABS.map(([v, l, src]) => (
              <TabsTrigger key={v} value={v} className="gap-1.5">
                <span className="at-family-dot" style={{ '--family': SOURCE[src] }} />{l}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="chain"><InstrumentChainPanel at={at} nexus={nexus} projectUrl={projectUrl} onChanged={onChanged} /></TabsContent>
          <TabsContent value="forge"><ForgeLoopGenerator /></TabsContent>
          <TabsContent value="sfx"><SfxGenerator /></TabsContent>
          <TabsContent value="search"><SemanticLoopSearch renderExtra={librarySend} /></TabsContent>
          <TabsContent value="free"><LoopDiscoverTab renderExtra={freesoundSend} /></TabsContent>
          <TabsContent value="community"><CommunityLoopsTab renderExtra={librarySend} /></TabsContent>
          <TabsContent value="contests"><AudiusContestsTab /></TabsContent>
          <TabsContent value="demo"><DemoSongPanel /></TabsContent>
          <TabsContent value="vibe"><VibeSessionStarter /></TabsContent>
          <TabsContent value="prestarter"><PreStarterPanel /></TabsContent>
          <TabsContent value="audius"><AudiusRemixTab /></TabsContent>
        </Tabs>
      </section>
    </BridgeSessionContext.Provider>
  );
}