import { EMOTION_TAGS } from '@/lib/studios/orvo/inworldConfig';

export default function EmotionTagPicker({ selected = [], onToggle, disabled = false }) {
  return (
    <div className="merc-card rounded-xl p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-[#FF9A4D] mb-2">Emotion Steering</p>
      <div className="flex flex-wrap gap-2">
        {EMOTION_TAGS.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              disabled={disabled}
              onClick={() => onToggle?.(tag)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${
                active
                  ? 'text-[#2A1508] border-black bg-gradient-to-b from-[#FFC26E] to-[#FF9A4D]'
                  : 'text-white/60 border-black/60 bg-gradient-to-b from-[#28211A] to-[#171310] hover:text-[#FF9A4D]'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}