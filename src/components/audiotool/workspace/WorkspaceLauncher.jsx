import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { WORKSPACE_LIST, withProject } from '@/lib/audiotool/workspaces';

/** Bridge → workspace hand-off. Each card reopens the same live project in its instrument. */
export default function WorkspaceLauncher({ projectUrl }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">Create in a workspace</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {WORKSPACE_LIST.map(({ key, to, icon: Icon, label, desc }) => (
          <Link key={key} to={withProject(to, projectUrl)}
            className="group merc-card merc-card-hover rounded-2xl p-4 flex flex-col gap-3 transition-transform hover:-translate-y-0.5">
            <span className="w-10 h-10 rounded-2xl merc-bubble flex items-center justify-center">
              <Icon className="w-4 h-4 text-background relative z-10" />
            </span>
            <div className="flex-1">
              <div className="font-bold text-sm">{label}</div>
              <div className="text-xs text-muted-foreground mt-1">{desc}</div>
            </div>
            <span className="text-xs text-accent inline-flex items-center gap-1">
              Open live <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}