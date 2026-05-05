import { Link } from 'react-router-dom';
import { Layers, Combine, Mic2, Sparkles, Film, ChevronDown } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

/**
 * Phase 3 — "Open in Studio" actions for any UserAsset card.
 * Pre-fills the target studio with this assetId via querystring.
 */
const STUDIO_ACTIONS = [
  { route: '/stem-creator',     label: 'Open in Stem Creator',     icon: Layers,    types: ['track', 'stem', 'master', 'mashup', 'harmony'] },
  { route: '/mashup-studio',    label: 'Open in Mashup Studio',    icon: Combine,   types: ['track', 'master', 'stem'] },
  { route: '/vocal-harmonizer', label: 'Open in Vocal Harmonizer', icon: Mic2,      types: ['track', 'stem'] },
  { route: '/mastering-studio', label: 'Open in Mastering Studio', icon: Sparkles,  types: ['track', 'mashup', 'harmony'] },
  { route: '/visualizer-studio',label: 'Open in Visualizer Studio',icon: Film,      types: ['track', 'master', 'mashup'] },
];

export default function OpenInStudioMenu({ asset, size = 'sm', label = 'Open in Studio' }) {
  if (!asset?.id) return null;
  const available = STUDIO_ACTIONS.filter(a => a.types.includes(asset.asset_type));
  if (available.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="rounded-lg gap-1.5 text-xs">
          <Sparkles className="w-3 h-3" /> {label}
          <ChevronDown className="w-3 h-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Studio Tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {available.map(({ route, label, icon: Icon }) => (
          <DropdownMenuItem key={route} asChild>
            <Link to={`${route}?assetId=${asset.id}`} className="flex items-center gap-2 cursor-pointer">
              <Icon className="w-3.5 h-3.5" />
              <span className="text-xs">{label}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}