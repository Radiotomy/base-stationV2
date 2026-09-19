import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles, Mic2 } from 'lucide-react';
import ChipSelector from '@/components/music/ChipSelector';
import InfoTip from '@/components/common/InfoTip';
import LanguageSelect from '@/components/songwriting/LanguageSelect';
import { isEnglishLanguage } from '@/config/lyricLanguages';

/**
 * The optional half of Quick Generate — genre, voice persona and a custom title.
 * Collapsed by default: none of it is required to generate, and having three
 * optional controls sitting at the same visual weight as the prompt was the main
 * source of confusion in the old flat layout.
 */
export default function QuickOptionsPanel({
  genreOptions, selectedGenre, onGenre,
  voicePersonas = [], selectedPersona, onPersona,
  customTitle, onTitle,
  language, onLanguage,
}) {
  const [open, setOpen] = useState(false);
  const activeCount = [
    selectedGenre,
    selectedPersona !== 'auto' ? 'voice' : '',
    customTitle?.trim(),
    isEnglishLanguage(language) ? '' : 'language',
  ].filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-border bg-card/40">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 rounded-2xl transition-colors">
        <span className="w-6 h-6 rounded-full bg-muted text-foreground text-xs font-black flex items-center justify-center flex-shrink-0">2</span>
        <h3 className="text-sm font-bold text-foreground">Fine-tune</h3>
        <span className="text-xs text-muted-foreground">optional — AI fills these in</span>
        {activeCount > 0 && (
          <span className="text-xs font-bold text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded-full px-2 py-0.5">
            {activeCount} set
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-muted-foreground ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="px-4 pb-4 pt-1 space-y-5 border-t border-border">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                  Genre
                  <InfoTip text="Picking a genre locks the AI to that style. Leave blank to let the AI choose based on your prompt." />
                </p>
                <ChipSelector
                  chipType="genre"
                  defaults={genreOptions}
                  selected={selectedGenre}
                  onSelect={onGenre}
                  activeClass="bg-blue-600 text-white"
                  allowAny
                  anyLabel="Let AI Decide"
                />
                {selectedGenre && <p className="text-xs text-blue-300 mt-1.5">✓ AI will respect "{selectedGenre}" and tailor lyrics accordingly.</p>}
              </div>

              {voicePersonas.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                    Voice
                    <InfoTip text="Pick a saved Voice Persona for consistent artist identity across tracks. Or let the AI choose the best fit for your prompt." />
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => onPersona('auto')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${selectedPersona === 'auto' ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                      <Sparkles className="w-3 h-3" /> Best AI Voice
                    </button>
                    {voicePersonas.map(p => (
                      <button key={p.id} onClick={() => onPersona(p.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${selectedPersona === p.id ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                        <Mic2 className="w-3 h-3" /> {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Language drives both the auto-written lyrics and the sung vocal */}
              {onLanguage && <LanguageSelect value={language} onChange={onLanguage} />}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                  Track Title
                  <InfoTip text="Let the AI name your track, or type your own title here — it overrides the AI's title everywhere: library, ID3 tags, and Community Buzz." />
                </p>
                <input
                  type="text"
                  value={customTitle}
                  onChange={e => onTitle(e.target.value)}
                  placeholder="Leave blank to let the AI name it"
                  maxLength={80}
                  className="w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}