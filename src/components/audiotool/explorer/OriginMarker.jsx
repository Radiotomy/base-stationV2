import { AI_ORIGIN_COLOR } from '@/lib/audiotool/familyColors';

/** Tiny "AI-made" marker for entities an AI tool created (from COS telemetry). */
export default function OriginMarker({ ai }) {
  if (!ai) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: AI_ORIGIN_COLOR }}>
      <span className="w-1.5 h-1.5 rounded-full opacity-80" style={{ background: AI_ORIGIN_COLOR }} />
      AI-made
    </span>
  );
}