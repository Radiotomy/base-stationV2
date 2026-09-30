import AudiotoolTab from '@/components/audiotool/AudiotoolTab';
import AudiotoolNextSteps from '@/components/audiotool/AudiotoolNextSteps';
import MercuryRackHero from '@/components/audiotool/mercury/MercuryRackHero';

export default function AudiotoolStudio() {
  return (
    <div className="min-h-screen bg-background">
      <MercuryRackHero />
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="space-y-6">
          <AudiotoolNextSteps />
          <AudiotoolTab />
        </div>
      </div>
    </div>
  );
}