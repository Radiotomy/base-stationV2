// ORVO Studio manifest — registers the podcast studio module with BASE Station.
import { Mic } from 'lucide-react';

export const ORVO_MANIFEST = {
  id: 'orvo',
  label: 'ORVO Podcast Studio',
  rootPath: '/studios/orvo',
  icon: Mic,
  featureFlags: {
    recording: true,        // browser recording (Phase 4)
    asyncCollab: true,      // guest links & collaboration (Phase 5)
    liveEvents: true,       // live/AI-hosted events (Phase 4+)
    monetization: true,     // fiat tips (v2.0)
    subscriptions: true,    // fiat premium subscriptions (v2.0)
    analytics: true,
    social: true,
  },
  voiceProviders: ['elevenlabs', 'inworld'],
  // Music model selection is deferred to runtime — resolved against BASE
  // Station's provider router when ORVO needs music beds (Phase 4).
  musicModels: 'deferred-to-runtime',
};

export const ORVO_CATEGORIES = [
  'music', 'technology', 'culture', 'comedy', 'news', 'education',
  'business', 'arts', 'sports', 'health', 'true_crime', 'other',
];

export default ORVO_MANIFEST;