import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import InfoTip from '@/components/common/InfoTip';
import TIPS from '@/lib/audiotool/bridgeTips';
import SendToAudiotoolButton from '@/components/audiotool/songstarter/SendToAudiotoolButton';

/** The creator's finished renders from one BASE engine, each placeable on the live timeline. */
export default function EngineRenderPicker({ provider, aiTool, title, hint, linkTo, linkLabel }) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState(null);

  useEffect(() => {
    if (!user) return;
    base44.entities.GenerationJob.filter({ user_id: user.id, provider, status: 'completed' }, '-created_date', 10)
      .then((list) => setJobs(list.filter((j) => j.output_url)));
  }, [user, provider]);

  return (
    <section className="rack-module space-y-3">
      <div>
        <h3 className="font-bold flex items-center gap-1.5">{title} <InfoTip text={TIPS.engineRender} /></h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {!jobs ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : !jobs.length ? (
        <p className="text-sm text-muted-foreground">No renders yet.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {jobs.map((j) => {
            const name = j.input_data?.title || `${title} · ${new Date(j.created_date).toLocaleDateString()}`;
            return (
              <div key={j.id} className="rounded-2xl bg-secondary/50 p-3 space-y-2">
                <p className="text-sm font-semibold truncate">{name}</p>
                <audio src={j.output_url} controls preload="none" className="w-full h-8" />
                <SendToAudiotoolButton url={j.output_url} name={name} bpm={j.input_data?.bpm} aiTool={aiTool} prompt={name} label="Place on timeline" />
              </div>
            );
          })}
        </div>
      )}
      <Link to={linkTo} className="text-sm text-accent inline-flex items-center gap-1 hover:underline">
        {linkLabel} <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </section>
  );
}