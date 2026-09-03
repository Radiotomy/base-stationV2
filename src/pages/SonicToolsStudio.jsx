import { Wrench } from 'lucide-react';
import StudioPageHeader from '@/components/studio/StudioPageHeader';
import SonicToolsTab from '@/components/music/SonicToolsTab';

export default function SonicToolsStudio() {
  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader icon={Wrench} accent="cyan"
        title="Sonic Tools"
        subtitle="Remaster, replace a section, add vocals or an instrumental, or stitch an extension into one continuous song."
        badge="Sonic engine" />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <SonicToolsTab />
      </div>
    </div>
  );
}