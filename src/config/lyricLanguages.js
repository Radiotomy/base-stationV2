// Languages & regional traditions offered across every lyrics engine and music
// generator. Grouped only for findability — any value typed into the "Other"
// box is passed through and honoured, so coverage is not capped by this list.

export const LANGUAGE_GROUPS = [
  {
    group: 'Popular',
    items: ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Japanese', 'Korean', 'Mandarin Chinese'],
  },
  {
    group: 'Latin & Iberian',
    items: ['Spanish (Tejano / Tex-Mex)', 'Spanish (Mexican / Regional)', 'Spanish (Caribbean / Reggaetón)', 'Portuguese', 'Catalan', 'Basque', 'Quechua'],
  },
  {
    group: 'Nordic & Baltic',
    items: ['Swedish', 'Norwegian', 'Danish', 'Finnish', 'Icelandic'],
  },
  {
    group: 'Western Europe',
    items: ['French', 'German', 'Dutch', 'Italian', 'Irish Gaelic', 'Welsh', 'Greek'],
  },
  {
    group: 'Central & Eastern Europe',
    items: ['Polish', 'Ukrainian', 'Russian', 'Czech', 'Hungarian', 'Romanian', 'Serbian', 'Croatian'],
  },
  {
    group: 'Africa',
    items: ['Yoruba', 'Igbo', 'Hausa', 'Nigerian Pidgin', 'Swahili', 'Amharic', 'Zulu', 'Afrikaans', 'French (West African)'],
  },
  {
    group: 'Middle East & South Asia',
    items: ['Arabic', 'Arabic (Egyptian)', 'Hebrew', 'Turkish', 'Persian (Farsi)', 'Hindi', 'Punjabi', 'Urdu', 'Tamil', 'Bengali'],
  },
  {
    group: 'East & Southeast Asia',
    items: ['Japanese', 'Korean', 'Mandarin Chinese', 'Cantonese', 'Thai', 'Vietnamese', 'Indonesian', 'Tagalog / Filipino'],
  },
  {
    group: 'Caribbean & Pacific',
    items: ['Jamaican Patois', 'Haitian Creole', 'Māori', 'Hawaiian'],
  },
];

export const DEFAULT_LANGUAGE = 'English';

export const isEnglishLanguage = (lang) => !lang || /^english$/i.test(String(lang).trim());