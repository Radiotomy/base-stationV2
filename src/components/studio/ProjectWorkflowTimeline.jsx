import { Link } from 'react-router-dom';
import { Mic2, Music, Layers, Combine, Sparkles, Film, Image, FileText, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const TYPE_META = {
  lyrics_studio:     { icon: FileText, color: 'bg-pink-600' },
  music_studio:      { icon: Music, color: 'bg-blue-600' },
  cover_art_studio:  { icon: Image, color: 'bg-purple-600' },
  video_studio:      { icon: Film, color: 'bg-indigo-600' },
  stem_creator:      { icon: Layers, color: 'bg-emerald-600' },
  mashup_studio:     { icon: Combine, color: 'bg-amber-600' },
  vocal_harmonizer:  { icon: Mic2, color: 'bg-pink-500' },
  mastering_studio:  { icon: Sparkles, color: 'bg-yellow-500' },
  visualizer_studio: { icon: Film, color: 'bg-fuchsia-600' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Phase 3 — Vertical workflow timeline for a Project.
 *
 * Props: { workflow: { steps: [...] } }
 */
export default function ProjectWorkflowTimeline({ workflow }) {
  const steps = workflow?.steps || [];

  if (steps.length === 0) {
    return (
      <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
        No workflow steps yet — open any Studio tool and click <strong>Add to Project</strong> to start your timeline.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const meta = TYPE_META[step.type] || { icon: Sparkles, color: 'bg-slate-600' };
        const Icon = meta.icon;
        return (
          <div key={i} className="relative flex gap-3">
            {i < steps.length - 1 && (
              <div className="absolute left-5 top-10 w-px h-[calc(100%-1rem)] bg-border" />
            )}
            <div className={`w-10 h-10 rounded-xl ${meta.color} flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0 bg-card border border-border rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{step.label}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">
                      {step.type?.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(step.createdAt)}</span>
                  </div>
                </div>
                {step.tool_route && step.asset_id && (
                  <Link to={`${step.tool_route}?assetId=${step.asset_id}`}
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 flex-shrink-0">
                    Reopen <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}