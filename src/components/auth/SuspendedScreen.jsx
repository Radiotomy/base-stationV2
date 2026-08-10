import { ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function SuspendedScreen({ user }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#14100C' }}>
      <div className="merc-card rounded-2xl p-8 max-w-md text-center">
        <ShieldAlert className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <h1 className="font-display text-2xl text-white mb-2">Account suspended</h1>
        <p className="text-sm text-white/60 mb-4">
          Your BASE Station account has been suspended by a platform administrator.
        </p>
        {user?.suspension_reason && (
          <p className="text-sm text-white/80 bg-white/5 border border-white/10 rounded-xl p-3 mb-5 text-left">
            {user.suspension_reason}
          </p>
        )}
        <p className="text-xs text-white/40 mb-5">
          If you believe this is a mistake, reply to the email address on your account to appeal.
        </p>
        <Button onClick={() => base44.auth.logout('/login')} className="merc-button rounded-full px-6 font-black">
          Sign out
        </Button>
      </div>
    </div>
  );
}