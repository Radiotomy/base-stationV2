import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Cpu, Plus, Loader2, GraduationCap, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InfoTip from '@/components/common/InfoTip';
import { useToast } from '@/components/ui/use-toast';
import PluginCard from '@/components/foundry/PluginCard';
import CommunityFoundryHub from '@/components/foundry/CommunityFoundryHub';
import FeaturedPatchShelf from '@/components/foundry/FeaturedPatchShelf';
import StarterTemplatesShelf from '@/components/foundry/StarterTemplatesShelf';
import TemplatePickerDialog from '@/components/foundry/TemplatePickerDialog';
import PatchCollections from '@/components/foundry/PatchCollections';
import { starterGraph } from '@/lib/foundry/nodeTypes';
import { compileGraph } from '@/lib/foundry/audioEngine';

export default function Foundry() {
  const [mine, setMine] = useState(null);
  const [creating, setCreating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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
              <InfoTip
                side="bottom"
                size="sm"
                text="The Foundry is a DSP workbench: describe an effect or instrument, get a live node graph, then rewire and tune it. Patches are tools — they never re-render or overwrite your saved audio."
              />
            </div>
            <p className="text-xs text-white/45 max-w-lg leading-relaxed">
              Prompt custom DSP into existence, rewire it on the canvas, and audition it live.
              Foundry patches are tools — they run in their own audio engine and never alter
              your saved masters. Publish a patch to share it, fork anyone else's, group
              favourites into collections, or enter a Patch Design challenge — all below.
            </p>
            <Link
              to="/help"
              className="inline-flex items-center gap-1.5 mt-2 text-[11px] text-[#FFC98A] hover:text-white transition-colors"
            >
              <BookOpen className="w-3 h-3" />
              Read the Foundry guide
            </Link>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setPickerOpen(true)}
              className="h-9 text-xs border-white/12 text-white/70"
            >
              <GraduationCap className="w-3.5 h-3.5 mr-1.5" />
              Start from a template
            </Button>
            <InfoTip
              side="bottom"
              text="Templates are curated reference patches. Audition one, inspect how it's wired, then fork it to get your own editable copy."
            />
            <InfoTip
              side="bottom"
              text="A new patch starts from a minimal chain. Prompt the architect for a starting point, or drop modules in by hand for a higher ownership score."
            />
            <Button onClick={create} disabled={creating} className="h-9 text-xs merc-button">
              {creating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              New patch
            </Button>
          </div>
        </div>

        <StarterTemplatesShelf />

        <FeaturedPatchShelf />

        <div className="mb-10">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-widest text-white/50">My patches</span>
            <InfoTip text="Every patch you create or fork lives here. Publishing one makes it forkable by the community and eligible for Patch Design challenges." />
          </span>
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

        <PatchCollections />

        <CommunityFoundryHub />
      </div>

      <TemplatePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} />
    </div>
  );
}