import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Zap, Trophy, Star } from 'lucide-react';

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500];
const LEVEL_NAMES = ['Newcomer', 'Beat Maker', 'Rhyme Starter', 'Groove Shaper', 'Track Builder',
  'Sound Sculptor', 'Studio Artist', 'Beat Legend', 'Music Maestro', 'AI Visionary', 'Base Station GOD'];

function getLevel(xp) {
  let level = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i;
    else break;
  }
  return level;
}

function getProgress(xp, level) {
  const current = LEVEL_THRESHOLDS[level] || 0;
  const next = LEVEL_THRESHOLDS[level + 1];
  if (!next) return 100;
  return Math.min(100, Math.round(((xp - current) / (next - current)) * 100));
}

export default function XPWidget({ userId }) {
  const [xpRecord, setXpRecord] = useState(null);

  useEffect(() => {
    if (!userId) return;
    base44.entities.UserXP.filter({ user_id: userId }, '-created_date', 1)
      .then(data => { if (data[0]) setXpRecord(data[0]); })
      .catch(() => {});
  }, [userId]);

  if (!xpRecord) return null;

  const level = getLevel(xpRecord.total_xp || 0);
  const progress = getProgress(xpRecord.total_xp || 0, level);
  const nextThreshold = LEVEL_THRESHOLDS[level + 1];

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-yellow-900/40 to-orange-900/40 border border-yellow-500/20 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <Star className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Level {level}</p>
            <p className="text-sm font-black text-yellow-400">{LEVEL_NAMES[level]}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-foreground">{(xpRecord.total_xp || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total XP</p>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="space-y-1">
        <div className="h-2 rounded-full bg-yellow-500/10 overflow-hidden border border-yellow-500/20">
          <div className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all"
            style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progress}% to Level {level + 1}</span>
          {nextThreshold && <span>{nextThreshold - (xpRecord.total_xp || 0)} XP needed</span>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-yellow-500/10">
        {[
          { label: 'Tracks', value: xpRecord.tracks_submitted || 0, icon: '🎵' },
          { label: 'Won', value: xpRecord.challenges_won || 0, icon: '🏆' },
          { label: 'Weekly XP', value: xpRecord.weekly_xp || 0, icon: '⚡' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="text-center">
            <p className="text-xs text-muted-foreground">{icon} {label}</p>
            <p className="font-black text-foreground text-sm">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}