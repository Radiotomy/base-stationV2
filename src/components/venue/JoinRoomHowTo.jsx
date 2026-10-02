import { HelpCircle } from 'lucide-react';

const STEPS = [
  'Click "Enter the 3D room". It opens in a new tab, so your browser can remember you.',
  'Wait for the room to load. On first visit, pick a name (or sign in to Portals) and press Enter once.',
  'Walk around with W A S D or the arrow keys (on a phone, use the on-screen joystick). Drag to look around.',
  'Allow microphone access only if you want to talk. Listening works without it.',
  'Stuck on the name screen? Allow cookies for portals.to, refresh the tab, or try another browser.',
];

export default function JoinRoomHowTo() {
  return (
    <div className="merc-card rounded-2xl p-5 space-y-3">
      <p className="font-bold flex items-center gap-2 text-sm">
        <HelpCircle className="w-4 h-4 text-accent" /> How to join this room
      </p>
      <ol className="list-decimal pl-5 space-y-1.5 text-xs text-muted-foreground">
        {STEPS.map((s) => <li key={s}>{s}</li>)}
      </ol>
      <p className="text-[11px] text-muted-foreground">
        You don't need a BASE Station account to visit a public room. You can also listen right here on this page.
      </p>
    </div>
  );
}