// The dedicated Audiotool creative workspaces. Each is a full-screen BASE Station
// instrument that opens a live Nexus document and writes to it as a peer.
import { Drum, Piano, Mic } from 'lucide-react';

export const WORKSPACES = {
  beat: {
    key: 'beat', to: '/studios/audiotool/beat', icon: Drum, label: 'Beat & Pattern Studio',
    desc: 'Step-sequence drums, basslines and Tonematrix melodies straight into your live project.',
  },
  harmony: {
    key: 'harmony', to: '/studios/audiotool/harmony', icon: Piano, label: 'Harmony & Arrangement',
    desc: 'Write chord progressions, rework MIDI with the co-producer and shape your song sections.',
  },
  vocal: {
    key: 'vocal', to: '/studios/audiotool/vocal', icon: Mic, label: 'Vocal Lab',
    desc: 'Record takes, layer harmonies and place Cantor vocals on the timeline.',
  },
};

export const WORKSPACE_LIST = Object.values(WORKSPACES);

/** Carries the open project across routes so every workspace lands on the same session. */
export const withProject = (to, projectUrl) =>
  projectUrl ? `${to}?open=${encodeURIComponent(projectUrl)}` : to;