import { Badge } from '@/components/ui/badge';
import { Unlock, Lock } from 'lucide-react';

export default function AudiusLicenseBadge({ licensing, size = 'default' }) {
  if (!licensing) return null;
  const compact = size === 'sm';
  return licensing.is_open ? (
    <Badge className={`bg-emerald-500/20 text-emerald-300 border-0 gap-1 ${compact ? 'text-[10px] px-1.5 py-0' : ''}`}>
      <Unlock className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {licensing.is_cc ? licensing.license : 'Open Remix'}
    </Badge>
  ) : (
    <Badge className={`bg-white/10 text-white/50 border-0 gap-1 ${compact ? 'text-[10px] px-1.5 py-0' : ''}`}>
      <Lock className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      All Rights Reserved
    </Badge>
  );
}