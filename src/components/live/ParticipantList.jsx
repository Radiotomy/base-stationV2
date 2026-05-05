import { Users } from 'lucide-react';

const TYPE_COLOR = {
  performer: 'bg-purple-500/20 text-purple-300',
  fan: 'bg-blue-500/20 text-blue-300',
  agent: 'bg-emerald-500/20 text-emerald-300',
};

export default function ParticipantList({ participants = [] }) {
  if (participants.length === 0) return null;
  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground uppercase">
          Participants ({participants.length})
        </p>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt={p.displayName} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center flex-shrink-0 text-xs font-black text-white">
                {(p.displayName || '?')[0].toUpperCase()}
              </div>
            )}
            <span className="text-xs text-foreground font-medium truncate flex-1">{p.displayName}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${TYPE_COLOR[p.type] || ''}`}>
              {p.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}