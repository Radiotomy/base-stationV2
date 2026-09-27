import { CATEGORIES, IMAGES, TAGLINE, INTRO, HIGHLIGHTS } from './content';

const catImages = [IMAGES.studio, IMAGES.stage];

export const DECK_SLIDES = [
  { kind: 'hero', image: IMAGES.hero, title: TAGLINE },
  { kind: 'visual', image: IMAGES.studio, eyebrow: 'The idea', title: 'A live peer inside Audiotool', body: INTRO },
  { kind: 'overview', eyebrow: "Let's Build", title: 'Six categories, one studio', items: CATEGORIES },
  ...CATEGORIES.map((c, i) => ({
    kind: 'visual', image: catImages[i % 2], eyebrow: `${c.num} · ${c.title}`,
    title: c.short, body: c.blurb, bullets: c.features,
  })),
  { kind: 'visual', image: IMAGES.stage, eyebrow: 'The differentiator', title: 'Provenance that travels with the export', bullets: HIGHLIGHTS },
  { kind: 'hero', image: IMAGES.hero, title: 'Try it live — base-station.base44.app/hackathon' },
];