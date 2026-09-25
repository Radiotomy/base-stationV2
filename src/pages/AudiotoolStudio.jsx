import AudiotoolTab from '@/components/audiotool/AudiotoolTab';
import AudiotoolNextSteps from '@/components/audiotool/AudiotoolNextSteps';
import BetaGate from '@/components/auth/BetaGate';

export default function AudiotoolStudio() {
  return (
    <div className="min-h-screen bg-background">
      <div className="pt-10 pb-8 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-foreground mb-2 tracking-tight">🔗 Audiotool Bridge</h1>
          <p className="text-muted-foreground text-lg">
            Connect Audiotool, open your projects live, and bring their sessions into BASE Station.
          </p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <BetaGate feature="Audiotool Bridge">
          <div className="space-y-6">
            <AudiotoolTab />
            <AudiotoolNextSteps />
          </div>
        </BetaGate>
      </div>
    </div>
  );
}