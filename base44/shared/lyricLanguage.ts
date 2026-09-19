// Multilingual lyric + music conditioning.
//
// Every lyric engine here used to write English by default because nothing in the
// prompt ever said otherwise — the model's own default language won. Language is
// therefore passed EXPLICITLY, as an instruction the model cannot ignore, and the
// same value is echoed into the music prompt so the singer performs in the
// language the words were written in. Writing Spanish lyrics and then handing a
// music model an English-shaped prompt is what produced accented mismatches.
//
// The catalog is guidance, not a whitelist: any language or regional tradition a
// creator types through is honoured verbatim, so coverage is not limited to the
// entries below.

export interface LanguageSpec {
  label: string;       // English name used in prompts
  native?: string;     // how speakers write it, given to the model as a spelling cue
  guidance?: string;   // dialect/idiom notes that keep a translation from sounding translated
}

export const LANGUAGE_GUIDE: Record<string, LanguageSpec> = {
  english: { label: 'English' },
  spanish: { label: 'Spanish', native: 'Español', guidance: 'Neutral Latin American Spanish unless a regional tradition is named; keep syllable stress singable.' },
  'spanish (tejano)': { label: 'Spanish (Tejano / Tex-Mex)', native: 'Español tejano', guidance: 'Tejano/Tex-Mex border Spanish with natural English code-switching, conjunto and norteño idiom, accordion-era vocabulary.' },
  'spanish (mexican)': { label: 'Spanish (Mexican / Regional)', native: 'Español mexicano', guidance: 'Mexican regional Spanish — corridos, banda and mariachi idiom, rancho and frontera imagery.' },
  'spanish (caribbean)': { label: 'Spanish (Caribbean / Reggaetón)', native: 'Español caribeño', guidance: 'Puerto Rican / Dominican Caribbean Spanish, reggaetón and dembow cadence, clipped consonants.' },
  portuguese: { label: 'Portuguese', native: 'Português', guidance: 'Brazilian Portuguese unless European is asked for; bossa/MPB/funk carioca phrasing.' },
  french: { label: 'French', native: 'Français', guidance: 'Modern French with chanson-grade prosody; elide mute vowels as singers actually do.' },
  german: { label: 'German', native: 'Deutsch', guidance: 'Contemporary German; keep compound words short enough to stay singable.' },
  italian: { label: 'Italian', native: 'Italiano' },
  dutch: { label: 'Dutch', native: 'Nederlands' },
  swedish: { label: 'Swedish', native: 'Svenska', guidance: 'Scandinavian pop phrasing — open vowels, melodic stress on the first syllable.' },
  norwegian: { label: 'Norwegian', native: 'Norsk (Bokmål)' },
  danish: { label: 'Danish', native: 'Dansk' },
  finnish: { label: 'Finnish', native: 'Suomi' },
  icelandic: { label: 'Icelandic', native: 'Íslenska' },
  polish: { label: 'Polish', native: 'Polski' },
  ukrainian: { label: 'Ukrainian', native: 'Українська' },
  russian: { label: 'Russian', native: 'Русский' },
  greek: { label: 'Greek', native: 'Ελληνικά' },
  turkish: { label: 'Turkish', native: 'Türkçe' },
  arabic: { label: 'Arabic', native: 'العربية', guidance: 'Modern Standard Arabic unless a dialect is named; melisma-friendly open vowels.' },
  'arabic (egyptian)': { label: 'Arabic (Egyptian)', native: 'مصري' },
  hebrew: { label: 'Hebrew', native: 'עברית' },
  hindi: { label: 'Hindi', native: 'हिन्दी', guidance: 'Filmi/Bollywood lyric register; Hinglish code-switching is idiomatic.' },
  punjabi: { label: 'Punjabi', native: 'ਪੰਜਾਬੀ', guidance: 'Punjabi with bhangra cadence; Gurmukhi script.' },
  urdu: { label: 'Urdu', native: 'اردو', guidance: 'Ghazal-grade imagery and metre where the mood allows.' },
  tamil: { label: 'Tamil', native: 'தமிழ்' },
  bengali: { label: 'Bengali', native: 'বাংলা' },
  japanese: { label: 'Japanese', native: '日本語', guidance: 'J-pop lyric register; mora-count phrasing, occasional English hook lines.' },
  korean: { label: 'Korean', native: '한국어', guidance: 'K-pop register — Korean verses with short English hook phrases where idiomatic.' },
  'chinese (mandarin)': { label: 'Mandarin Chinese', native: '普通话 / 简体中文', guidance: 'Mandopop phrasing; respect tone contour against the melody.' },
  'chinese (cantonese)': { label: 'Cantonese', native: '粵語 / 廣東話', guidance: 'Cantopop conventions, traditional characters.' },
  thai: { label: 'Thai', native: 'ไทย' },
  vietnamese: { label: 'Vietnamese', native: 'Tiếng Việt' },
  indonesian: { label: 'Indonesian', native: 'Bahasa Indonesia' },
  tagalog: { label: 'Tagalog / Filipino', native: 'Tagalog', guidance: 'OPM register; Taglish code-switching is idiomatic.' },
  yoruba: { label: 'Yoruba', native: 'Yorùbá', guidance: 'Nigerian Yoruba with tonal diacritics; afrobeats call-and-response idiom.' },
  igbo: { label: 'Igbo', native: 'Igbo' },
  hausa: { label: 'Hausa', native: 'Harshen Hausa' },
  'nigerian pidgin': { label: 'Nigerian Pidgin', native: 'Naija Pidgin', guidance: 'Naija Pidgin as Burna Boy/Wizkid write it — street-level, chant-friendly, mixed with light English.' },
  swahili: { label: 'Swahili', native: 'Kiswahili', guidance: 'East African Kiswahili; bongo flava phrasing.' },
  amharic: { label: 'Amharic', native: 'አማርኛ' },
  zulu: { label: 'Zulu', native: 'isiZulu', guidance: 'South African isiZulu; amapiano/gqom chant phrasing.' },
  afrikaans: { label: 'Afrikaans', native: 'Afrikaans' },
  'french (west african)': { label: 'French (West African)', native: 'Français d’Afrique de l’Ouest', guidance: 'Abidjan/Dakar French with nouchi and wolof loanwords, coupé-décalé cadence.' },
  'haitian creole': { label: 'Haitian Creole', native: 'Kreyòl ayisyen' },
  'jamaican patois': { label: 'Jamaican Patois', native: 'Patwa', guidance: 'Authentic Patois orthography; reggae/dancehall riddim phrasing.' },
  romanian: { label: 'Romanian', native: 'Română' },
  hungarian: { label: 'Hungarian', native: 'Magyar' },
  czech: { label: 'Czech', native: 'Čeština' },
  serbian: { label: 'Serbian', native: 'Српски / Srpski' },
  croatian: { label: 'Croatian', native: 'Hrvatski' },
  persian: { label: 'Persian (Farsi)', native: 'فارسی' },
  irish: { label: 'Irish Gaelic', native: 'Gaeilge' },
  welsh: { label: 'Welsh', native: 'Cymraeg' },
  catalan: { label: 'Catalan', native: 'Català' },
  basque: { label: 'Basque', native: 'Euskara' },
  quechua: { label: 'Quechua', native: 'Runa Simi' },
  maori: { label: 'Māori', native: 'Te Reo Māori' },
  hawaiian: { label: 'Hawaiian', native: 'ʻŌlelo Hawaiʻi' },
};

/** Normalizes whatever the UI sent — a catalog key, an English name, or free text. */
export function resolveLanguage(input?: string | null): LanguageSpec | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (LANGUAGE_GUIDE[key]) return LANGUAGE_GUIDE[key];
  const byLabel = Object.values(LANGUAGE_GUIDE).find(s => s.label.toLowerCase() === key);
  if (byLabel) return byLabel;
  // Unknown language or regional tradition — honour it verbatim rather than
  // silently falling back to English, which is the bug this module exists to fix.
  return { label: raw };
}

export function isEnglish(input?: string | null): boolean {
  const spec = resolveLanguage(input);
  return !spec || /^english$/i.test(spec.label);
}

/** Prompt block for a lyric engine. Placed last in a prompt so it outranks style text. */
export function languageDirective(input?: string | null, genre?: string): string {
  const spec = resolveLanguage(input);
  if (!spec) return '';
  const lines = [
    `LANGUAGE — NON-NEGOTIABLE: Write ALL lyrics in ${spec.label}${spec.native ? ` (${spec.native})` : ''}.`,
    `Write as a native ${spec.label} songwriter would, in that language's own script and orthography — never translate English lines word-for-word, and never output an English version alongside.`,
    'Section tags ([Verse], [Chorus], …) stay in English so the music model can read the structure.',
  ];
  if (spec.guidance) lines.push(`Dialect & idiom: ${spec.guidance}`);
  if (genre) lines.push(`Blend the language naturally with the ${genre} tradition — rhyme, stress and vowel placement must follow ${spec.label} prosody, not English prosody.`);
  return lines.join('\n');
}

/** Short phrase appended to a music-generation prompt so the VOCAL is in-language. */
export function languageMusicPhrase(input?: string | null): string {
  const spec = resolveLanguage(input);
  if (!spec || isEnglish(spec.label)) return '';
  return `Vocals sung entirely in ${spec.label}${spec.guidance ? ` — ${spec.guidance}` : ''}`;
}

/** Tag-channel value (Sonic/ACE-style comma tags). */
export function languageTag(input?: string | null): string {
  const spec = resolveLanguage(input);
  if (!spec || isEnglish(spec.label)) return '';
  return `${spec.label} vocals`;
}