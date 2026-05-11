import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Phase 3 — Real-time registration status indicator.
 * Polls the registry entity every 8s while status is 'pending'.
 */
export default function RegistrationStatusBadge({ registrationId, blockchainType, initialStatus }) {
  const [status, setStatus] = useState(initialStatus || 'pending');
  const entity = blockchainType === 'base' ? 'BaseTrackRegistry' : 'SolanaTrackRegistry';

  useEffect(() => {
    if (!registrationId || status !== 'pending') return;
    let cancelled = false;

    const poll = async () => {
      try {
        const rows = await base44.entities[entity].filter({ id: registrationId });
        if (!cancelled && rows[0]?.registration_status) {
          setStatus(rows[0].registration_status);
        }
      } catch (_) { /* silent */ }
    };

    const interval = setInterval(poll, 8000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [registrationId, entity, status]);

  const config = {
    registered: { icon: CheckCircle, label: 'registered', cls: 'bg-green-500/20 text-green-400' },
    pending: { icon: Loader2, label: 'pending', cls: 'bg-yellow-500/20 text-yellow-400', spin: true },
    failed: { icon: AlertCircle, label: 'failed', cls: 'bg-red-500/20 text-red-400' },
  }[status] || { icon: Clock, label: status, cls: 'bg-muted text-muted-foreground' };

  const Icon = config.icon;
  return (
    <Badge className={`text-xs gap-1 ${config.cls}`}>
      <Icon className={`w-3 h-3 ${config.spin ? 'animate-spin' : ''}`} />
      {config.label}
    </Badge>
  );
}