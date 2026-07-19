import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

/**
 * Teaching empty state — explains what a section is for and points to
 * the action that fills it.
 */
export default function EmptyStateTeacher({ emoji = '✨', title, description, actionLabel, actionTo }) {
  return (
    <div className="p-10 text-center rounded-2xl bg-card border border-border">
      <div className="text-4xl mb-3">{emoji}</div>
      <h3 className="font-black text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">{description}</p>
      {actionTo && (
        <Link to={actionTo}>
          <Button className="rounded-xl gap-1.5 merc-button font-bold">
            {actionLabel} <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}