import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Cpu, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PluginCard from '@/components/foundry/PluginCard';
import CommunityFoundryHub from '@/components/foundry/CommunityFoundryHub';
import { starterGraph } from '@/lib/foundry/nodeTypes';
import { compileGraph } from '@/lib/foundry/audioEngine';

export default function Foundry() {
  const [mine, setMine] = useState(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      const rows = await base44.entities.FoundryPlugin.filter({ user_id: me.id }, '-created_date', 40);
      setMine(rows);
    })().catch(() => setMine([]));
  }, []);

  const create = async () => {
    setCreating(true);
    try {
      const me = await base44.auth.me();
      const graph = starterGraph();
      const created = await base44.entities.FoundryPlugin.create({
        user_id: me.id,
        user_email: me.email,
        title: 'Untitled Patch',
        category: 'effect',
        graph_state: graph,
        dsp_definition: compileGraph(graph),
        is_public: false,
        human_score: 0,
        participation_signals: { label: 'ai_generated' },
      });
      navigate(`/foundry/${created.id}`);
    } catch (e) {
      toast({ title: 'Could not create patch', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen pt-6 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4 text-[#FF9A4D]" />
              <h1 className="text-2xl font-display text-iridescent">BASE Foundry</h1>
            </div>
            <p className="text-xs text-white/45 max-w-lg leading-relaxed">
              Prompt custom DSP into existence, rewire it on the canvas, and audition it live.
              Foundry patches are tools — they run in their own audio engine and never alter
              your saved masters.
            </p>
          </div>
          <Button onClick={create} disabled={creating} className="h-9 text-xs merc-button shrink-0">
            {creating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
            New patch
          </Button>
        </div>

        <div className="mb-10">
          <span className="text-[11px] uppercase tracking-widest text-white/50">My patches</span>
          {mine === null && (
            <div className="flex items-center gap-2 text-xs text-white/40 py-8">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </div>
          )}
          {mine?.length === 0 && (
            <div className="merc-card rounded-2xl p-8 mt-3 text-center">
              <p className="text-sm text-white/60 mb-1">No patches yet</p>
              <p className="text-xs text-white/35 mb-4">
                Start one and describe the sound you're after — the architect builds the chain.
              </p>
              <Button onClick={create} disabled={creating} className="h-8 text-xs merc-button">
                Create your first patch
              </Button>
            </div>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {(mine || []).map((p) => <PluginCard key={p.id} plugin={p} />)}
          </div>
        </div>

        <CommunityFoundryHub />
      </div>
    </div>
  );
}