import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, Vote, ShieldAlert } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/AuthContext';
import ProposalBoard from '@/components/governance/ProposalBoard';
import TransparencyRegistry from '@/components/governance/TransparencyRegistry';

export default function CommunityGovernance() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-16 inset-x-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 h-12 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-semibold">Back</span>
        </Link>
        <div className="flex-1" />
        <Scale className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-bold">Community Tuning Panel</span>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden pt-28 pb-12 px-6 bg-gradient-to-br from-amber-900/30 to-black">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold mb-5">
            <Scale className="w-3.5 h-3.5" /> The Living Standard
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            You Define What <span className="text-iridescent">Human Effort</span> Means
          </h1>
          <p className="text-white/70 text-base max-w-2xl mx-auto leading-relaxed">
            The lines of creative ownership are changing daily. BASE Station doesn't dictate the
            rules — this panel is the framework for the community to benchmark, tune, and
            collectively defend human creative intent. Every adopted weight becomes part of a
            public consensus ledger.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <Tabs defaultValue="proposals">
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto mb-8 rounded-xl">
            <TabsTrigger value="proposals" className="gap-2 rounded-lg">
              <Vote className="w-4 h-4" /> COS Weight Proposals
            </TabsTrigger>
            <TabsTrigger value="registry" className="gap-2 rounded-lg">
              <ShieldAlert className="w-4 h-4" /> Transparency Registry
            </TabsTrigger>
          </TabsList>
          <TabsContent value="proposals">
            <ProposalBoard user={user} />
          </TabsContent>
          <TabsContent value="registry">
            <TransparencyRegistry user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}