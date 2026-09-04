import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';

const STUDIOS = [
  { to: '/music-studio', label: '🎵 Music Studio', keywords: 'generate track song ai' },
  { to: '/lyrics-studio', label: '🎤 Lyrics Studio', keywords: 'write lyrics songwriter' },
  { to: '/cover-art-studio', label: '🎨 Cover Art Studio', keywords: 'album art image' },
  { to: '/cover-song-studio', label: '🎙️ Cover & Extend Studio', keywords: 'cover extend upload' },
  { to: '/voice-creator', label: '🗣️ Voice Creator', keywords: 'voice persona clone' },
  { to: '/sfx-studio', label: '💥 Sound FX Studio', keywords: 'sfx sound effects' },
  { to: '/eleven-music', label: '🎧 Eleven Music & My Sound', keywords: 'eleven music my sound finetune train own tracks signature style elevenlabs' },
  { to: '/mastering-studio', label: '🎚️ Mastering Studio', keywords: 'master lufs eq polish' },
  { to: '/audio-remix-studio', label: '🎛️ Audio Remix', keywords: 'edit effects remix' },
  { to: '/stem-creator', label: '🧬 Stem Creator', keywords: 'split stems vocals drums' },
  { to: '/mashup-studio', label: '🔀 Mashup Studio', keywords: 'blend mashup' },
  { to: '/vocal-harmonizer', label: '🎼 Vocal Harmonizer', keywords: 'harmony layers' },
  { to: '/id3-studio', label: '🏷️ ID3 Tag Editor', keywords: 'metadata tags' },
  { to: '/video-studio', label: '🎬 Video Studio (Beta)', keywords: 'music video ltx' },
  { to: '/visualizer-studio', label: '🌈 Visualizer Studio', keywords: 'audio reactive visuals' },
  { to: '/live-studio', label: '🔴 Live Studio (Beta)', keywords: 'go live stream' },
  { to: '/live-manager', label: '🗂️ Live Manager', keywords: 'sessions venues moderation' },
  { to: '/promo-studio', label: '📣 Promo Package', keywords: 'promo card bundle' },
  { to: '/social-automation', label: '📱 Social Automation', keywords: 'social cards instagram' },
  { to: '/loop-studio', label: '🥁 Loops & Samples', keywords: 'loops samples drum kits one shots' },
  { to: '/base-mark', label: '〰️ BASE Mark Studio', keywords: 'watermark forensic detection provenance' },
  { to: '/rights', label: '🛡️ Rights Portal', keywords: 'catalog ddex rights verification' },
];

const PAGES = [
  { to: '/', label: '🏠 Home', keywords: 'home' },
  { to: '/studios', label: '🎛️ Studio Hub', keywords: 'all studios tools' },
  { to: '/creator-dashboard', label: '📊 My Workspace', keywords: 'dashboard library projects stats' },
  { to: '/creator-dashboard?tab=proof', label: '🛡️ Proof of Ownership', keywords: 'blockchain register provenance' },
  { to: '/submit', label: '📤 Submit Track', keywords: 'submit charts radio' },
  { to: '/charts', label: '📈 Charts', keywords: 'top tracks rankings' },
  { to: '/radio', label: '📻 Radio', keywords: 'listen streaming' },
  { to: '/playlists', label: '🎧 Playlists', keywords: 'collections' },
  { to: '/challenges', label: '⚡ Challenges', keywords: 'weekly contests' },
  { to: '/leaderboard', label: '🏆 Leaderboard', keywords: 'top creators xp' },
  { to: '/asset-gallery', label: '🖼️ Asset Gallery', keywords: 'public creations browse' },
  { to: '/ai-studio/history', label: '🕘 Generation History', keywords: 'past generations jobs' },
  { to: '/news-hub', label: '📰 News & Legal', keywords: 'ai music news legal policy' },
  { to: '/credits', label: '⚡ Credits & Plans', keywords: 'buy credits pricing' },
  { to: '/my-profile', label: '👤 My Profile', keywords: 'account settings' },
  { to: '/creative-ownership', label: '🎖️ Creative Ownership (COS)', keywords: 'score ai label disclosure' },
  { to: '/governance', label: '🗳️ Community Governance', keywords: 'proposals vote tuning' },
  { to: '/help', label: '📚 Help & How-To', keywords: 'guide docs tutorial' },
  { to: '/audius-trending', label: '🌐 Audius Network', keywords: 'audius trending decentralized discover' },
  { to: '/audius-search', label: '🔎 Audius Search', keywords: 'search audius catalog tracks artists' },
  { to: '/featured-artists', label: '⭐ Featured Artists', keywords: 'spotlight featured creators' },
  { to: '/badges', label: '🎖️ Badges', keywords: 'badges achievements rewards earn' },
  { to: '/verify', label: '🔍 Verify a Track', keywords: 'scan verify watermark base mark provenance' },
  { to: '/trust', label: '🛡️ Trust & Provenance', keywords: 'trust provenance watermark labels' },
];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState([]);
  const navigate = useNavigate();

  // Cmd/Ctrl+K + header button event
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((p) => !p);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('bs:open-search', onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('bs:open-search', onOpen);
    };
  }, []);

  // Load the user's assets the first time the palette opens
  useEffect(() => {
    if (!open || assets.length > 0) return;
    (async () => {
      try {
        const me = await base44.auth.me();
        const rows = await base44.entities.UserAsset.filter({ user_id: me.id }, '-created_date', 100);
        setAssets(rows);
      } catch { /* not signed in or no assets */ }
    })();
  }, [open, assets.length]);

  const go = (to) => {
    setOpen(false);
    navigate(to);
  };

  const TYPE_EMOJI = { track: '🎵', lyric: '🎤', coverart: '🎨', video: '🎬', stem: '🧬', sfx: '💥' };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search studios, pages, or your assets…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Studios">
          {STUDIOS.map((s) => (
            <CommandItem key={s.to} value={`${s.label} ${s.keywords}`} onSelect={() => go(s.to)}>
              {s.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Pages">
          {PAGES.map((p) => (
            <CommandItem key={p.to} value={`${p.label} ${p.keywords}`} onSelect={() => go(p.to)}>
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {assets.length > 0 && (
          <CommandGroup heading="Your Assets">
            {assets.map((a) => (
              <CommandItem key={a.id} value={`${a.title} ${a.asset_type}`} onSelect={() => go('/creator-dashboard')}>
                {TYPE_EMOJI[a.asset_type] || '📦'} {a.title}
                <span className="ml-auto text-xs text-muted-foreground capitalize">{a.asset_type}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}