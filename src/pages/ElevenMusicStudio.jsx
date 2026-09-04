import MySoundTab from '@/components/music/mysound/MySoundTab';

export default function ElevenMusicStudio() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden pt-10 pb-10 px-6 bg-gradient-to-br from-cyan-900/30 to-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl font-black text-white mb-2 tracking-tight">🎧 Eleven Music &amp; My Sound</h1>
          <p className="text-white/60 text-lg">
            Eleven Music base model plus My Sound — train on your own tracks and generate in your signature style.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <MySoundTab />
      </div>
    </div>
  );
}