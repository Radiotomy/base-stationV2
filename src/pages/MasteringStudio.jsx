import { Sparkles } from 'lucide-react';
import StudioPageHeader from '@/components/studio/StudioPageHeader';
import MasteringTab from '@/components/mastering/MasteringTab';

export default function MasteringStudio() {
  return (
    <div className="min-h-screen bg-background">
      <StudioPageHeader
        icon={Sparkles}
        accent="amber"
        title="AI Mastering Studio"
        subtitle="Real-time DSP mastering, audio editing, multitrack mixing & remix tools."
        badge="Phase 3"
      />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <MasteringTab />
      </div>
    </div>
  );
}