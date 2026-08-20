/**
 * Starter worlds a creator can pick when spinning up a 3D venue.
 *
 * `portalTemplate` is the template name passed to Portals' room-create call.
 * We keep our own key + copy on top of it so the picker speaks in music terms
 * ("listening room") rather than Portals' internal template names, and so a
 * template rename on their side only touches one line here.
 */
export const VENUE_TEMPLATES = [
  {
    key: 'club',
    portalTemplate: 'blank',
    name: 'Night Club',
    tagline: 'Dance floor, raised stage, big screens',
    description: 'A dark room built for a set — stage, video wall, side screens and a bar at the back.',
    icon: 'Disc3',
  },
  {
    key: 'listening_room',
    portalTemplate: 'blank',
    name: 'Listening Room',
    tagline: 'Intimate, seated, conversation-friendly',
    description: 'A small warm space for premieres and playback sessions where the track is the focus.',
    icon: 'Armchair',
  },
  {
    key: 'festival_stage',
    portalTemplate: 'blank',
    name: 'Festival Stage',
    tagline: 'Open air, huge screen, big crowd',
    description: 'A wide outdoor mainstage with a towering screen for larger drops and showcases.',
    icon: 'Tent',
  },
  {
    key: 'blank',
    portalTemplate: 'blank',
    name: 'Empty Space',
    tagline: 'Build it yourself',
    description: 'A bare room with no stage furniture — start from nothing and design it your way.',
    icon: 'Square',
  },
];

export function getVenueTemplate(key) {
  return VENUE_TEMPLATES.find((t) => t.key === key) || VENUE_TEMPLATES[0];
}