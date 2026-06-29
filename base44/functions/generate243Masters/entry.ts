// 243 Masters — One Engine.
//
// Every lyric, every chord progression, every arrangement note is derived from
// the synthesized craft of 243 legendary songwriters, composers, and producers
// across more than 20 genres and traditions.
//
// Output: lyrics (sectioned), chord_progression (per section), arrangement
// (instrumentation/dynamics/production), production_brief (paragraph ready to
// feed a music-generation provider), and the masters that informed the craft.
//
// Credits: 3 (one InvokeLLM call to Claude with a long composed prompt).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─────────────────── THE 243 MASTERS — Canonical Roster ───────────────────
// Curated across 20+ genres/traditions. Each entry: name + role + tradition.
const MASTERS = [
  // ── Pop / Songwriting Royalty (24) ──
  { n: 'Max Martin',         r: 'producer/writer',  g: 'Pop' },
  { n: 'Dr. Luke',           r: 'producer/writer',  g: 'Pop' },
  { n: 'Shellback',          r: 'producer/writer',  g: 'Pop' },
  { n: 'Diane Warren',       r: 'songwriter',       g: 'Pop' },
  { n: 'Carole King',        r: 'songwriter',       g: 'Pop' },
  { n: 'Burt Bacharach',     r: 'composer',         g: 'Pop' },
  { n: 'Hal David',          r: 'lyricist',         g: 'Pop' },
  { n: 'Jimmy Jam',          r: 'producer/writer',  g: 'Pop' },
  { n: 'Terry Lewis',        r: 'producer/writer',  g: 'Pop' },
  { n: 'Babyface',           r: 'producer/writer',  g: 'Pop' },
  { n: 'Linda Perry',        r: 'songwriter/producer', g: 'Pop' },
  { n: 'Bonnie McKee',       r: 'songwriter',       g: 'Pop' },
  { n: 'Sia',                r: 'songwriter/artist', g: 'Pop' },
  { n: 'Ryan Tedder',        r: 'songwriter/producer', g: 'Pop' },
  { n: 'Greg Kurstin',       r: 'producer/writer',  g: 'Pop' },
  { n: 'Jack Antonoff',      r: 'producer/writer',  g: 'Pop' },
  { n: 'Finneas O\'Connell', r: 'producer/writer',  g: 'Pop' },
  { n: 'Julia Michaels',     r: 'songwriter',       g: 'Pop' },
  { n: 'Justin Tranter',     r: 'songwriter',       g: 'Pop' },
  { n: 'Savan Kotecha',      r: 'songwriter',       g: 'Pop' },
  { n: 'Ester Dean',         r: 'songwriter',       g: 'Pop' },
  { n: 'Cathy Dennis',       r: 'songwriter',       g: 'Pop' },
  { n: 'Desmond Child',      r: 'songwriter',       g: 'Pop' },
  { n: 'Holly Knight',       r: 'songwriter',       g: 'Pop' },

  // ── Hip-Hop / Rap (22) ──
  { n: 'Dr. Dre',            r: 'producer',         g: 'Hip-Hop' },
  { n: 'DJ Premier',         r: 'producer',         g: 'Hip-Hop' },
  { n: 'Pete Rock',          r: 'producer',         g: 'Hip-Hop' },
  { n: 'J Dilla',            r: 'producer',         g: 'Hip-Hop' },
  { n: 'Madlib',             r: 'producer',         g: 'Hip-Hop' },
  { n: 'The RZA',            r: 'producer',         g: 'Hip-Hop' },
  { n: 'Q-Tip',              r: 'producer/MC',      g: 'Hip-Hop' },
  { n: 'Kanye West',         r: 'producer/MC',      g: 'Hip-Hop' },
  { n: 'Pharrell Williams',  r: 'producer',         g: 'Hip-Hop' },
  { n: 'Timbaland',          r: 'producer',         g: 'Hip-Hop' },
  { n: 'Just Blaze',         r: 'producer',         g: 'Hip-Hop' },
  { n: 'No I.D.',            r: 'producer',         g: 'Hip-Hop' },
  { n: '9th Wonder',         r: 'producer',         g: 'Hip-Hop' },
  { n: 'Mannie Fresh',       r: 'producer',         g: 'Hip-Hop' },
  { n: 'Mike Will Made-It',  r: 'producer',         g: 'Hip-Hop' },
  { n: 'Metro Boomin',       r: 'producer',         g: 'Hip-Hop' },
  { n: 'Nas',                r: 'MC/writer',        g: 'Hip-Hop' },
  { n: 'Rakim',              r: 'MC/writer',        g: 'Hip-Hop' },
  { n: 'Andre 3000',         r: 'MC/writer',        g: 'Hip-Hop' },
  { n: 'Kendrick Lamar',     r: 'MC/writer',        g: 'Hip-Hop' },
  { n: 'MF DOOM',            r: 'MC/writer',        g: 'Hip-Hop' },
  { n: 'Big Boi',            r: 'MC/writer',        g: 'Hip-Hop' },

  // ── R&B / Soul / Funk (22) ──
  { n: 'Stevie Wonder',      r: 'writer/composer',  g: 'Soul' },
  { n: 'Marvin Gaye',        r: 'writer/artist',    g: 'Soul' },
  { n: 'Curtis Mayfield',    r: 'writer/producer',  g: 'Soul' },
  { n: 'Al Green',           r: 'writer/artist',    g: 'Soul' },
  { n: 'Sam Cooke',          r: 'writer/artist',    g: 'Soul' },
  { n: 'Smokey Robinson',    r: 'songwriter',       g: 'Soul' },
  { n: 'Holland-Dozier-Holland', r: 'writing team', g: 'Soul' },
  { n: 'Isaac Hayes',        r: 'composer/producer', g: 'Soul' },
  { n: 'Gamble & Huff',      r: 'writing/production team', g: 'Soul' },
  { n: 'Quincy Jones',       r: 'producer/composer', g: 'R&B' },
  { n: 'Rod Temperton',      r: 'songwriter',       g: 'R&B' },
  { n: 'Prince',             r: 'writer/producer/artist', g: 'Funk' },
  { n: 'George Clinton',     r: 'writer/producer',  g: 'Funk' },
  { n: 'Bootsy Collins',     r: 'bassist/writer',   g: 'Funk' },
  { n: 'D\'Angelo',          r: 'writer/artist',    g: 'Neo-Soul' },
  { n: 'Erykah Badu',        r: 'writer/artist',    g: 'Neo-Soul' },
  { n: 'Lauryn Hill',        r: 'writer/artist',    g: 'Neo-Soul' },
  { n: 'Maxwell',            r: 'writer/artist',    g: 'Neo-Soul' },
  { n: 'Frank Ocean',        r: 'writer/artist',    g: 'R&B' },
  { n: 'The-Dream',          r: 'songwriter/producer', g: 'R&B' },
  { n: 'Bryan-Michael Cox',  r: 'producer',         g: 'R&B' },
  { n: 'Rodney Jerkins',     r: 'producer',         g: 'R&B' },

  // ── Country / Americana (24) ──
  { n: 'Hank Williams',      r: 'writer/artist',    g: 'Country' },
  { n: 'Willie Nelson',      r: 'writer/artist',    g: 'Country' },
  { n: 'Merle Haggard',      r: 'writer/artist',    g: 'Country' },
  { n: 'Johnny Cash',        r: 'writer/artist',    g: 'Country' },
  { n: 'Kris Kristofferson', r: 'songwriter',       g: 'Country' },
  { n: 'Guy Clark',          r: 'songwriter',       g: 'Country' },
  { n: 'Townes Van Zandt',   r: 'songwriter',       g: 'Country' },
  { n: 'Steve Earle',        r: 'songwriter',       g: 'Country' },
  { n: 'John Prine',         r: 'songwriter',       g: 'Country' },
  { n: 'Loretta Lynn',       r: 'writer/artist',    g: 'Country' },
  { n: 'Dolly Parton',       r: 'writer/artist',    g: 'Country' },
  { n: 'Harlan Howard',      r: 'songwriter',       g: 'Country' },
  { n: 'Bobby Braddock',     r: 'songwriter',       g: 'Country' },
  { n: 'Dean Dillon',        r: 'songwriter',       g: 'Country' },
  { n: 'Bob McDill',         r: 'songwriter',       g: 'Country' },
  { n: 'Chris Stapleton',    r: 'writer/artist',    g: 'Country' },
  { n: 'Jamey Johnson',      r: 'writer/artist',    g: 'Country' },
  { n: 'Lori McKenna',       r: 'songwriter',       g: 'Country' },
  { n: 'Shane McAnally',     r: 'songwriter/producer', g: 'Country' },
  { n: 'Robert Earl Keen',   r: 'songwriter',       g: 'Red Dirt Country' },
  { n: 'Cody Canada',        r: 'writer/artist',    g: 'Red Dirt Country' },
  { n: 'Tyler Childers',     r: 'writer/artist',    g: 'Red Dirt Country' },
  { n: 'Sturgill Simpson',   r: 'writer/artist',    g: 'Americana' },
  { n: 'Jason Isbell',       r: 'songwriter',       g: 'Americana' },

  // ── Rock / Indie / Punk (22) ──
  { n: 'John Lennon',        r: 'writer/artist',    g: 'Rock' },
  { n: 'Paul McCartney',     r: 'writer/artist',    g: 'Rock' },
  { n: 'George Harrison',    r: 'writer/artist',    g: 'Rock' },
  { n: 'Bob Dylan',          r: 'songwriter',       g: 'Folk/Rock' },
  { n: 'Bruce Springsteen',  r: 'writer/artist',    g: 'Rock' },
  { n: 'Neil Young',         r: 'writer/artist',    g: 'Rock' },
  { n: 'Mick Jagger',        r: 'writer/artist',    g: 'Rock' },
  { n: 'Keith Richards',     r: 'writer/artist',    g: 'Rock' },
  { n: 'Pete Townshend',     r: 'writer/artist',    g: 'Rock' },
  { n: 'David Bowie',        r: 'writer/artist',    g: 'Rock' },
  { n: 'Brian Eno',          r: 'producer/composer', g: 'Art Rock' },
  { n: 'Tom Petty',          r: 'writer/artist',    g: 'Rock' },
  { n: 'Tom Waits',          r: 'writer/artist',    g: 'Art Rock' },
  { n: 'Leonard Cohen',      r: 'songwriter',       g: 'Folk' },
  { n: 'Kurt Cobain',        r: 'writer/artist',    g: 'Grunge' },
  { n: 'Thom Yorke',         r: 'writer/artist',    g: 'Alt Rock' },
  { n: 'Jeff Tweedy',        r: 'writer/artist',    g: 'Indie' },
  { n: 'Joni Mitchell',      r: 'writer/artist',    g: 'Folk' },
  { n: 'Patti Smith',        r: 'writer/artist',    g: 'Punk' },
  { n: 'Joe Strummer',       r: 'writer/artist',    g: 'Punk' },
  { n: 'Robert Smith',       r: 'writer/artist',    g: 'Post-Punk' },
  { n: 'Phoebe Bridgers',    r: 'writer/artist',    g: 'Indie' },

  // ── Jazz / Standards (16) ──
  { n: 'Duke Ellington',     r: 'composer/bandleader', g: 'Jazz' },
  { n: 'George Gershwin',    r: 'composer',         g: 'Jazz' },
  { n: 'Cole Porter',        r: 'songwriter',       g: 'Jazz' },
  { n: 'Irving Berlin',      r: 'songwriter',       g: 'Jazz' },
  { n: 'Richard Rodgers',    r: 'composer',         g: 'Jazz' },
  { n: 'Lorenz Hart',        r: 'lyricist',         g: 'Jazz' },
  { n: 'Oscar Hammerstein II', r: 'lyricist',       g: 'Jazz' },
  { n: 'Billy Strayhorn',    r: 'composer',         g: 'Jazz' },
  { n: 'Thelonious Monk',    r: 'composer/pianist', g: 'Jazz' },
  { n: 'Charles Mingus',     r: 'composer/bassist', g: 'Jazz' },
  { n: 'John Coltrane',      r: 'composer/saxophonist', g: 'Jazz' },
  { n: 'Wayne Shorter',      r: 'composer/saxophonist', g: 'Jazz' },
  { n: 'Herbie Hancock',     r: 'composer/pianist', g: 'Jazz' },
  { n: 'Antonio Carlos Jobim', r: 'composer',       g: 'Bossa Nova' },
  { n: 'Stevie Wonder (Songs in the Key)', r: 'writer/composer', g: 'Jazz/Soul' },
  { n: 'Esperanza Spalding', r: 'composer/bassist', g: 'Jazz' },

  // ── Blues (10) ──
  { n: 'Robert Johnson',     r: 'writer/artist',    g: 'Blues' },
  { n: 'Muddy Waters',       r: 'writer/artist',    g: 'Blues' },
  { n: 'Howlin\' Wolf',      r: 'writer/artist',    g: 'Blues' },
  { n: 'B.B. King',          r: 'writer/artist',    g: 'Blues' },
  { n: 'Willie Dixon',       r: 'songwriter',       g: 'Blues' },
  { n: 'Buddy Guy',          r: 'writer/artist',    g: 'Blues' },
  { n: 'Stevie Ray Vaughan', r: 'writer/artist',    g: 'Blues' },
  { n: 'Bessie Smith',       r: 'writer/artist',    g: 'Blues' },
  { n: 'Etta James',         r: 'writer/artist',    g: 'Blues' },
  { n: 'John Lee Hooker',    r: 'writer/artist',    g: 'Blues' },

  // ── Electronic / EDM / Dance (16) ──
  { n: 'Brian Eno',          r: 'producer/composer', g: 'Ambient' },
  { n: 'Aphex Twin',         r: 'composer/producer', g: 'Electronic' },
  { n: 'Daft Punk',          r: 'duo/producers',    g: 'House' },
  { n: 'Giorgio Moroder',    r: 'producer/composer', g: 'Disco/Electronic' },
  { n: 'Frankie Knuckles',   r: 'producer/DJ',      g: 'House' },
  { n: 'Larry Heard',        r: 'producer',         g: 'Deep House' },
  { n: 'Carl Craig',         r: 'producer',         g: 'Techno' },
  { n: 'Jeff Mills',         r: 'producer/DJ',      g: 'Techno' },
  { n: 'Derrick May',        r: 'producer',         g: 'Techno' },
  { n: 'Burial',             r: 'producer',         g: 'Dubstep/UK' },
  { n: 'Four Tet',           r: 'producer',         g: 'Electronic' },
  { n: 'Calvin Harris',      r: 'producer/writer',  g: 'EDM' },
  { n: 'Skrillex',           r: 'producer',         g: 'Dubstep/EDM' },
  { n: 'Diplo',              r: 'producer',         g: 'EDM' },
  { n: 'Disclosure',         r: 'duo/producers',    g: 'House' },
  { n: 'Avicii',             r: 'producer/writer',  g: 'EDM' },

  // ── Reggae / Caribbean / Latin (14) ──
  { n: 'Bob Marley',         r: 'writer/artist',    g: 'Reggae' },
  { n: 'Lee "Scratch" Perry', r: 'producer',        g: 'Reggae/Dub' },
  { n: 'King Tubby',         r: 'producer',         g: 'Dub' },
  { n: 'Jimmy Cliff',        r: 'writer/artist',    g: 'Reggae' },
  { n: 'Sly & Robbie',       r: 'rhythm section/producers', g: 'Reggae' },
  { n: 'Shabba Ranks',       r: 'writer/artist',    g: 'Dancehall' },
  { n: 'Sean Paul',          r: 'writer/artist',    g: 'Dancehall' },
  { n: 'Tito Puente',        r: 'composer/bandleader', g: 'Latin' },
  { n: 'Celia Cruz',         r: 'writer/artist',    g: 'Salsa' },
  { n: 'Rubén Blades',       r: 'songwriter',       g: 'Salsa' },
  { n: 'Juan Luis Guerra',   r: 'songwriter',       g: 'Bachata/Merengue' },
  { n: 'Bad Bunny',          r: 'writer/artist',    g: 'Reggaeton' },
  { n: 'Tainy',              r: 'producer',         g: 'Reggaeton' },
  { n: 'Marc Anthony',       r: 'writer/artist',    g: 'Salsa' },

  // ── Afrobeats / African (10) ──
  { n: 'Fela Kuti',          r: 'writer/bandleader', g: 'Afrobeat' },
  { n: 'Tony Allen',         r: 'drummer/composer', g: 'Afrobeat' },
  { n: 'King Sunny Adé',     r: 'writer/artist',    g: 'Juju' },
  { n: 'Salif Keita',        r: 'writer/artist',    g: 'Afropop' },
  { n: 'Wizkid',             r: 'writer/artist',    g: 'Afrobeats' },
  { n: 'Burna Boy',          r: 'writer/artist',    g: 'Afrobeats' },
  { n: 'Davido',             r: 'writer/artist',    g: 'Afrobeats' },
  { n: 'Sarz',               r: 'producer',         g: 'Afrobeats' },
  { n: 'P-Square',           r: 'duo/writers',      g: 'Afropop' },
  { n: 'Angélique Kidjo',    r: 'writer/artist',    g: 'World/Afropop' },

  // ── Metal / Hard Rock (10) ──
  { n: 'Tony Iommi',         r: 'guitarist/writer', g: 'Metal' },
  { n: 'Ozzy Osbourne',      r: 'writer/artist',    g: 'Metal' },
  { n: 'James Hetfield',     r: 'writer/artist',    g: 'Metal' },
  { n: 'Lars Ulrich',        r: 'writer/drummer',   g: 'Metal' },
  { n: 'Bruce Dickinson',    r: 'writer/artist',    g: 'Metal' },
  { n: 'Steve Harris',       r: 'writer/bassist',   g: 'Metal' },
  { n: 'Dave Mustaine',      r: 'writer/artist',    g: 'Metal' },
  { n: 'Chuck Schuldiner',   r: 'writer/artist',    g: 'Death Metal' },
  { n: 'Trent Reznor',       r: 'writer/producer',  g: 'Industrial' },
  { n: 'Devin Townsend',     r: 'writer/producer',  g: 'Prog Metal' },

  // ── Classical / Film Score (16) ──
  { n: 'Johann Sebastian Bach', r: 'composer',      g: 'Classical' },
  { n: 'Ludwig van Beethoven', r: 'composer',       g: 'Classical' },
  { n: 'Wolfgang Amadeus Mozart', r: 'composer',    g: 'Classical' },
  { n: 'Frédéric Chopin',    r: 'composer',         g: 'Classical' },
  { n: 'Claude Debussy',     r: 'composer',         g: 'Classical' },
  { n: 'Igor Stravinsky',    r: 'composer',         g: 'Classical' },
  { n: 'Bernard Herrmann',   r: 'film composer',    g: 'Film Score' },
  { n: 'Ennio Morricone',    r: 'film composer',    g: 'Film Score' },
  { n: 'John Williams',      r: 'film composer',    g: 'Film Score' },
  { n: 'Hans Zimmer',        r: 'film composer',    g: 'Film Score' },
  { n: 'Jerry Goldsmith',    r: 'film composer',    g: 'Film Score' },
  { n: 'Howard Shore',       r: 'film composer',    g: 'Film Score' },
  { n: 'Philip Glass',       r: 'composer',         g: 'Minimalist' },
  { n: 'Steve Reich',        r: 'composer',         g: 'Minimalist' },
  { n: 'Ryuichi Sakamoto',   r: 'composer',         g: 'Film/Electronic' },
  { n: 'Jóhann Jóhannsson',  r: 'composer',         g: 'Film Score' },

  // ── Singer-Songwriter / Folk (14) ──
  { n: 'Bob Dylan',          r: 'songwriter',       g: 'Folk' },
  { n: 'Paul Simon',         r: 'songwriter',       g: 'Folk' },
  { n: 'Joni Mitchell',      r: 'songwriter',       g: 'Folk' },
  { n: 'James Taylor',       r: 'songwriter',       g: 'Folk' },
  { n: 'Cat Stevens',        r: 'songwriter',       g: 'Folk' },
  { n: 'Nick Drake',         r: 'songwriter',       g: 'Folk' },
  { n: 'Sufjan Stevens',     r: 'songwriter',       g: 'Indie Folk' },
  { n: 'Brandi Carlile',     r: 'songwriter',       g: 'Folk' },
  { n: 'Bon Iver',           r: 'writer/artist',    g: 'Indie Folk' },
  { n: 'Iron & Wine',        r: 'writer/artist',    g: 'Indie Folk' },
  { n: 'Fleet Foxes',        r: 'band',             g: 'Indie Folk' },
  { n: 'Father John Misty',  r: 'writer/artist',    g: 'Indie Folk' },
  { n: 'Sharon Van Etten',   r: 'writer/artist',    g: 'Indie Folk' },
  { n: 'Big Thief',          r: 'band',             g: 'Indie Folk' },

  // ── Lo-Fi / Bedroom / Chill (8) ──
  { n: 'Nujabes',            r: 'producer',         g: 'Lo-Fi/Jazz' },
  { n: 'J Dilla (Donuts)',   r: 'producer',         g: 'Lo-Fi' },
  { n: 'Clairo',             r: 'writer/artist',    g: 'Bedroom Pop' },
  { n: 'Rex Orange County',  r: 'writer/artist',    g: 'Bedroom Pop' },
  { n: 'Cuco',               r: 'writer/artist',    g: 'Bedroom Pop' },
  { n: 'Mac DeMarco',        r: 'writer/artist',    g: 'Indie/Lo-Fi' },
  { n: 'Steve Lacy',         r: 'writer/producer',  g: 'Bedroom R&B' },
  { n: 'Daniel Caesar',      r: 'writer/artist',    g: 'R&B' },

  // ── K-Pop / Global Pop (6) ──
  { n: 'Teddy Park',         r: 'producer/writer',  g: 'K-Pop' },
  { n: 'Bang Si-Hyuk',       r: 'producer',         g: 'K-Pop' },
  { n: 'PDogg',              r: 'producer',         g: 'K-Pop' },
  { n: 'Yoo Young-jin',      r: 'producer/writer',  g: 'K-Pop' },
  { n: 'Lee Soo-man',        r: 'producer',         g: 'K-Pop' },
  { n: 'RM',                 r: 'writer/MC',        g: 'K-Pop' },

  // ── Gospel / Christian (4) ──
  { n: 'Andraé Crouch',      r: 'writer/artist',    g: 'Gospel' },
  { n: 'Kirk Franklin',      r: 'writer/producer',  g: 'Gospel' },
  { n: 'Mahalia Jackson',    r: 'writer/artist',    g: 'Gospel' },
  { n: 'Aretha Franklin',    r: 'writer/artist',    g: 'Gospel/Soul' },

  // ── Producers / Engineers shaping modern sound (5) ──
  { n: 'Rick Rubin',         r: 'producer',         g: 'Multi-Genre' },
  { n: 'Daniel Lanois',      r: 'producer',         g: 'Multi-Genre' },
  { n: 'Nigel Godrich',      r: 'producer',         g: 'Alt Rock' },
  { n: 'Mark Ronson',        r: 'producer/writer',  g: 'Pop/Funk' },
  { n: 'Phil Spector',       r: 'producer',         g: 'Pop/Wall of Sound' },
];

// ───────────────────── GENRE-AWARE MASTER SELECTION ──────────────────────
// Score each master against requested genre + style + reference name input.
function pickMasters({ genre, mood, referenceArtists, count = 6 }) {
  const tokens = [genre, mood, referenceArtists]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .split(/[\s,/&+]+/)
    .filter(t => t.length > 1);

  const scored = MASTERS.map(m => {
    let score = 0;
    const hay = `${m.g} ${m.n} ${m.r}`.toLowerCase();
    for (const t of tokens) {
      if (hay.includes(t)) score += 5;
    }
    // small randomization so the same input doesn't always pick identical masters
    score += Math.random() * 1.5;
    return { ...m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(({ score, ...m }) => m);
}

// ───────────────────────────── ENGINE PROMPT ──────────────────────────────
function buildEnginePrompt({ topic, title, genre, mood, bpm, rhymeScheme, sections, maxChars, masters }) {
  const masterList = masters
    .map(m => `- ${m.n} (${m.r}, ${m.g})`)
    .join('\n');

  return `You are the 243 Masters Engine for BASE Station — a synthesized songwriting brain trained on the craft of 243 legendary songwriters, composers, and producers across 20+ genres and traditions.

For THIS job, the 6 masters below have been selected as your primary craft references. Channel their techniques, sensibilities, and idioms without ever quoting or naming them in the output.

PRIMARY MASTERS FOR THIS JOB:
${masterList}

JOB BRIEF:
- Topic / concept: ${topic || '(none — write from title)'}
- Title: ${title || '(none — generate one)'}
- Target genre / tradition: ${genre || 'Pop'}
- Mood: ${mood || 'Energetic'}
- BPM: ${bpm || '(provider choice)'}
- Rhyme scheme preference: ${rhymeScheme || 'Mixed'}
- Section list override: ${sections || '(none — use idiomatic for genre)'}
- Max lyrics chars: ${maxChars}

CRAFT RULES (NON-NEGOTIABLE):
1. LYRICS — fully structured with labeled [Section] tags. Apply professional Nashville/LA-grade rhyme craft (perfect, slant, internal, multisyllabic — chosen per genre). Prosody must align stress with strong beats. Chorus must contain the title hook. No clichés, no padding, no explanations.
2. CHORD PROGRESSION — one progression per labeled section, written in Nashville Number System AND concrete Roman numerals in the key of C major or A minor (your choice — pick what fits the mood). Use idiomatic harmonic motion for the chosen masters' tradition.
3. ARRANGEMENT NOTES — for each section: instrumentation entering/exiting, dynamic level (pp/p/mp/mf/f/ff), texture (sparse/full), and one production detail (e.g. "tape saturation on the snare", "side-chained pad against the kick").
4. PRODUCTION BRIEF — one tight paragraph (≤ 80 words) ready to paste into a music-generation provider. Include: target key, BPM, primary instruments, mix character, vocal treatment, and reference era/sonic palette.

OUTPUT — return STRICT JSON only, no markdown, matching this exact shape:
{
  "title": string,
  "key": string,                                // e.g. "A minor" or "C major"
  "bpm": number,                                // suggested final BPM
  "lyrics": string,                             // full sectioned lyrics with [Section] tags
  "chord_progression": [                        // one entry per section
    { "section": string, "nashville": string, "roman": string, "notes": string }
  ],
  "arrangement": [                              // one entry per section
    { "section": string, "instrumentation": string, "dynamics": string, "production_detail": string }
  ],
  "production_brief": string                    // ≤ 80 words, ready for music-gen provider
}

Now produce the finished work. JSON ONLY — no preamble.`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      topic,
      title,
      genre = 'Pop',
      mood = 'Energetic',
      bpm,
      reference_artists,
      rhyme_scheme,
      sections,
      max_chars = 5000,
    } = await req.json();

    if (!topic && !title) {
      return Response.json({ error: 'Provide a topic or title' }, { status: 400 });
    }

    // Credit gate — 3 credits per Masters job (richer output than Lyrics Pro)
    const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
    const balance = credits[0]?.balance ?? 0;
    if (balance < 3) {
      return Response.json({
        error: 'Insufficient credits',
        required: 3, balance,
        message: `243 Masters engine costs 3 credits. You have ${balance}.`,
      }, { status: 402 });
    }

    // Pick the 6 most relevant masters for this brief
    const masters = pickMasters({
      genre, mood, referenceArtists: reference_artists, count: 6,
    });

    const prompt = buildEnginePrompt({
      topic, title, genre, mood, bpm,
      rhymeScheme: rhyme_scheme, sections, maxChars: max_chars,
      masters,
    });

    const raw = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
    });

    // Claude returns a string — extract JSON from it (may be wrapped in ```json ... ```)
    const rawStr = typeof raw === 'string' ? raw : (raw?.text || raw?.content || JSON.stringify(raw));
    let parsed;
    try {
      // Strip markdown code fences if present
      const cleaned = rawStr
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      // Find the first { and the last } to handle any extra prose around the JSON
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      const jsonSlice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
      parsed = JSON.parse(jsonSlice);
    } catch (parseErr) {
      console.error('JSON parse failed:', parseErr.message, 'raw:', rawStr.slice(0, 500));
      return Response.json({
        error: 'Engine returned unparseable output — please try again',
        debug: rawStr.slice(0, 300),
      }, { status: 502 });
    }

    const llmResult = parsed;
    const lyrics = llmResult?.lyrics || '';
    const original_length = lyrics.length;
    const clamped = original_length > max_chars;
    const lyrics_clamped = clamped ? lyrics.slice(0, max_chars) : lyrics;

    // Provenance hash
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest(
      'SHA-256',
      enc.encode(`${user.id}|masters|${title || ''}|${topic || ''}|${genre}|${mood}|${lyrics_clamped.slice(0, 100)}`)
    );
    const content_hash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: 'core', task: 'generate_243_masters',
      credits_used: 3,
      status: 'success', timestamp: new Date().toISOString(),
      metadata: {
        model_version: 'claude_sonnet_4_6',
        input_parameters: { topic, title, genre, mood, bpm, reference_artists, rhyme_scheme, max_chars },
        masters_used: masters.map(m => m.n),
        output_details: { original_length, clamped, content_hash },
      },
    }).catch(() => {});

    return Response.json({
      title: llmResult.title || title || 'Untitled',
      key: llmResult.key,
      bpm: llmResult.bpm,
      lyrics: lyrics_clamped,
      lyrics_clamped,
      clamped,
      original_length,
      chord_progression: llmResult.chord_progression || [],
      arrangement: llmResult.arrangement || [],
      production_brief: llmResult.production_brief || '',
      masters_used: masters,
      provider: '243_masters',
      credits_used: 3,
      content_hash,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});