// Genre-specific professional songwriting craft sheets.
// Used by generateLyricsPro to tailor rhyme, prosody, vocabulary, and structure
// per genre. Kept inline (no local imports allowed across functions).

export const GENRE_CRAFT = {
  'Hip-Hop': {
    bpm_range: '70–100 (half-time feel often)',
    rhyme: 'AABB couplets dominant; chain multisyllabic rhymes (3–5 syllables); internal rhymes every line; bar-end punchlines.',
    prosody: '4-bar phrasing; pocket on the 2 & 4; syncopation over the snare; vary cadence between triplet and straight-eighth flows.',
    line_length: '10–16 syllables per bar; verses 16 bars, hook 8 bars.',
    vocabulary: 'Concrete imagery, brand names, neighborhoods, code-switching; avoid abstraction in verses.',
    sections: '[Intro] [Verse 1 — 16 bars] [Hook — 8] [Verse 2 — 16] [Hook] [Verse 3 — 16] [Outro]',
    avoid: 'Singsong nursery rhymes, generic "yeah yeah" filler, abstract metaphors that break flow.',
  },
  'Drill': {
    bpm_range: '140–150 (half-time)',
    rhyme: 'AABB hard couplets; aggressive multisyllabic chains; end-stop on the kick.',
    prosody: 'Triplet flows; aggressive stop-start cadence; punch line lands on the 4.',
    line_length: '8–12 syllables; sharp, percussive.',
    vocabulary: 'Concrete, regional slang, gritty street imagery; sparse and percussive.',
    sections: '[Intro] [Verse 1] [Hook] [Verse 2] [Hook] [Bridge] [Hook] [Outro]',
    avoid: 'Sentimental phrasing, long abstract lines, polysyllabic words that overflow the bar.',
  },
  'Pop': {
    bpm_range: '95–120',
    rhyme: 'ABAB in verses; AABB or AAAA in choruses for sing-along punch; perfect rhymes in hook.',
    prosody: '4 & 8 bar phrases; melodic stress on title word; chorus repeats title 2–3×.',
    line_length: '6–10 syllables; balanced and breathy.',
    vocabulary: 'Universal emotions; one striking image per verse; second-person ("you") drives connection.',
    sections: '[Intro] [Verse 1] [Pre-Chorus] [Chorus] [Verse 2] [Pre-Chorus] [Chorus] [Bridge] [Chorus] [Outro]',
    avoid: 'Niche references, complex internal rhymes that obscure the hook, more than 2 ideas per verse.',
  },
  'R&B': {
    bpm_range: '60–90',
    rhyme: 'ABAB or ABCB; slant rhymes preferred for smoothness; melisma-friendly open vowels at line ends.',
    prosody: 'Long phrases with held vowels; syncopation against half-time drums; conversational verses, soaring chorus.',
    line_length: '8–14 syllables; flexible to allow melisma.',
    vocabulary: 'Sensual, tactile, late-night imagery; intimate second-person.',
    sections: '[Intro] [Verse 1] [Chorus] [Verse 2] [Chorus] [Bridge] [Vamp/Outro]',
    avoid: 'Closed consonant line endings, rigid syllable counts, abstract concepts.',
  },
  'Soul': {
    bpm_range: '70–100',
    rhyme: 'ABAB; perfect rhymes; call-and-response in chorus.',
    prosody: 'Gospel cadence; emphasis on the 1 & 3; ad-lib space in the outro.',
    line_length: '8–12 syllables.',
    vocabulary: 'Spiritual imagery, hands/heart/soul language, testimonial first-person.',
    sections: '[Intro] [Verse 1] [Chorus] [Verse 2] [Chorus] [Ad-lib Break] [Bridge] [Chorus] [Outro]',
    avoid: 'Cynicism, ironic distance, rapid-fire delivery.',
  },
  'Rock': {
    bpm_range: '110–150',
    rhyme: 'ABAB or AABB; perfect rhymes; anthemic chorus with title.',
    prosody: 'Driving 8th-note pulse; chorus on the downbeats; verse builds tension into pre-chorus lift.',
    line_length: '8–12 syllables; declarative.',
    vocabulary: 'Defiance, freedom, rebellion, fire/road/blood imagery.',
    sections: '[Intro riff] [Verse 1] [Pre-Chorus] [Chorus] [Verse 2] [Pre-Chorus] [Chorus] [Guitar Solo] [Bridge] [Chorus x2] [Outro]',
    avoid: 'Whispered subtlety, dense internal rhyme, third-person narration.',
  },
  'Country': {
    bpm_range: '75–130',
    rhyme: 'ABCB (classic narrative) or ABAB; perfect rhymes; story-driven detail.',
    prosody: 'Conversational; honor natural Southern speech stress; chorus repeats title hook.',
    line_length: '8–12 syllables; storytelling pace.',
    vocabulary: 'Concrete nouns: trucks, dirt roads, screen doors, mama, whiskey, river, Friday night; specific brand & place names.',
    sections: '[Intro] [Verse 1] [Chorus] [Verse 2] [Chorus] [Verse 3] [Chorus] [Tag]',
    avoid: 'Urban references, abstract emotion without an image to anchor it, hip-hop cadence.',
  },
  'Red Dirt Country': {
    bpm_range: '85–130',
    rhyme: 'ABCB or ABAB; honest slant rhymes preferred over forced perfect rhymes.',
    prosody: '16-bar verses for deep storytelling; chorus 8–16 bars anthemic; "middle-eight" bridge.',
    line_length: '10–14 syllables; conversational drawl.',
    vocabulary: 'Oklahoma/Texas plains, Stillwater, oilfield, honkytonk, two-step, Bob Wills, working class, heartache without cliché.',
    sections: '[Intro] [Verse 1 — 16 bars] [Chorus] [Verse 2 — 16 bars] [Chorus] [Instrumental Break] [Verse 3] [Chorus] [Outro]',
    avoid: 'Bro-country tropes (party trucks/red Solo cups), Nashville polish, hip-hop cadence.',
  },
  'Texas Country': {
    bpm_range: '90–130',
    rhyme: 'ABCB; slant rhymes; storytelling verses.',
    prosody: 'Two-step pocket; Western swing phrasing; chorus on the 1.',
    line_length: '10–14 syllables.',
    vocabulary: 'Dancehalls, Luckenbach, Hill Country, beer joints, fiddles, longneck, mesquite.',
    sections: '[Intro] [Verse 1] [Chorus] [Verse 2] [Chorus] [Guitar Break] [Verse 3] [Chorus] [Tag]',
    avoid: 'Pop-country gloss, EDM influences, urban slang.',
  },
  'EDM': {
    bpm_range: '120–140',
    rhyme: 'AABB or AAAA in topline; chant-friendly perfect rhymes.',
    prosody: 'Short, repetitive phrases; topline lands on the build & drop; chant sections of 4–8 syllables.',
    line_length: '4–8 syllables; vowel-heavy and chantable.',
    vocabulary: 'Light, body, night, fire, lose-yourself imagery; second-person.',
    sections: '[Intro] [Build-Up] [Drop] [Breakdown] [Build-Up 2] [Drop 2] [Outro]',
    avoid: 'Long narrative verses, third-person POV, dense imagery.',
  },
  'Lo-Fi': {
    bpm_range: '70–90',
    rhyme: 'ABAB or XAXA; soft slant rhymes; understated.',
    prosody: 'Laid-back, behind-the-beat phrasing; minimal repetition.',
    line_length: '6–10 syllables; gentle and observational.',
    vocabulary: 'Coffee, rain, study, late hours, small rooms, soft light.',
    sections: '[Intro] [Verse 1] [Chorus] [Verse 2] [Chorus] [Outro]',
    avoid: 'Anthemic gestures, big climaxes, aggressive cadence.',
  },
  'Indie': {
    bpm_range: '90–130',
    rhyme: 'XAXA or ABCB; conversational slant rhymes; literary phrasing.',
    prosody: 'Asymmetric line lengths; speak-sung verses; soaring chorus.',
    line_length: '6–14 syllables; varied.',
    vocabulary: 'Literary, idiosyncratic imagery; specific small details; unusual metaphors.',
    sections: '[Intro] [Verse 1] [Chorus] [Verse 2] [Chorus] [Bridge] [Chorus] [Outro]',
    avoid: 'Overused pop tropes, predictable rhymes.',
  },
  'Jazz': {
    bpm_range: '60–180 (wide)',
    rhyme: 'AABA (classic standard form); perfect rhymes; witty turns.',
    prosody: 'Swing phrasing; phrases push and pull against the bar; conversational sophistication.',
    line_length: '8–14 syllables.',
    vocabulary: 'Sophisticated, urbane, gentle wit; cocktail, dusk, perfume, telegram imagery.',
    sections: '[Intro/Head] [A] [A] [B] [A] [Solos] [Head Out]',
    avoid: 'Modern slang, rigid 4-bar phrasing, simple monosyllabic vocabulary.',
  },
  'Blues': {
    bpm_range: '60–120',
    rhyme: 'AAB (12-bar blues): line 1 repeats, line 3 answers and rhymes with 1.',
    prosody: 'Call-and-response; bend notes on the IV chord; loose timing.',
    line_length: '8–12 syllables.',
    vocabulary: 'Trouble, woman/man done me wrong, crossroads, train, whiskey, devil.',
    sections: '[Intro] [Verse 1 — AAB] [Verse 2 — AAB] [Solo] [Verse 3 — AAB] [Outro]',
    avoid: 'Major-key optimism, pop polish, complex multi-syllabic rhymes.',
  },
  'Metal': {
    bpm_range: '130–200',
    rhyme: 'AABB; perfect rhymes; aggressive end-stops.',
    prosody: 'Pummeling 16th-note delivery; chorus screamed on the downbeat; gang vocals.',
    line_length: '6–12 syllables; punchy.',
    vocabulary: 'Mythic, apocalyptic, fire/blood/steel imagery; defiance.',
    sections: '[Intro] [Verse 1] [Chorus] [Verse 2] [Chorus] [Solo] [Breakdown] [Chorus] [Outro]',
    avoid: 'Soft sentimentality, pop-radio polish, third-person quiet narration.',
  },
  'Afrobeats': {
    bpm_range: '95–115',
    rhyme: 'AABB or ABAB; perfect rhymes; pidgin-friendly slant rhymes.',
    prosody: 'Polyrhythmic pocket; melodic verses, chant-heavy chorus; call-and-response.',
    line_length: '6–10 syllables.',
    vocabulary: 'Body movement, joy, romance, pidgin English phrasing, "baby/wahala/sweet" vocabulary.',
    sections: '[Intro] [Verse 1] [Chorus] [Verse 2] [Chorus] [Dance Break] [Chorus] [Outro]',
    avoid: 'Heavy/dark imagery, dense narrative verses, rigid Western phrasing.',
  },
};

// Pick the most specific genre key from a comma-list, falling back gracefully.
export function pickGenreCraft(genreString = '') {
  const list = genreString.split(/[,/]/).map(s => s.trim()).filter(Boolean);
  // Match longest first so "Red Dirt Country" beats "Country"
  const keys = Object.keys(GENRE_CRAFT).sort((a, b) => b.length - a.length);
  for (const g of list) {
    const exact = keys.find(k => k.toLowerCase() === g.toLowerCase());
    if (exact) return { key: exact, craft: GENRE_CRAFT[exact] };
    const partial = keys.find(k => g.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(g.toLowerCase()));
    if (partial) return { key: partial, craft: GENRE_CRAFT[partial] };
  }
  return { key: 'Pop', craft: GENRE_CRAFT['Pop'] };
}