import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Transport & tempo',
    body: [
      'Play resumes from the playhead; Stop returns to bar 1. Click anywhere on the ruler to move the playhead.',
      'Loop repeats the highlighted region — set its bounds by dragging on the ruler region while Loop is on.',
      'The BPM slider (60–180) re-times the grid, the metronome and every bounce. The CPU meter reflects the browser audio thread load.',
    ],
  },
  {
    title: 'Tracks & mixer',
    body: [
      '+ Add Track creates a Synth/MIDI, Audio/Sampler or Aux Bus lane. Use the arrows to reorder, the trash to remove.',
      'M mutes, S solos (any solo mutes everything unsoloed), R arms the track for recorded notes.',
      'Volume, pan and output routing apply live and are rendered identically in the bounce.',
    ],
  },
  {
    title: 'Timeline editing',
    body: [
      'Double-click an empty lane to place a clip at the grid position.',
      'Drag a clip to move it; drag its right edge to trim. Snap can be 1/4, 1/8, 1/16 or off.',
      'Switch to the Slice tool and click a clip to cut it at the grid. Use the Clip Inspector to set gain, pitch or audio start offset.',
      'The automation drawer under the lanes draws volume automation for the selected track — click to add points, clear to reset.',
    ],
  },
  {
    title: 'Importing from other studios',
    body: [
      'The Cross-Studio Import browser in the left sidebar lists every audio asset in your library — tracks, stems, masters, loops and SFX from Music Studio, Quick/Advanced Generate, Song Maestro and TemPolor.',
      'Clicking an asset places it as an audio clip on the selected track. Your source file is never modified.',
    ],
  },
  {
    title: 'Foundry patches',
    body: [
      'Any patch card in BASE Foundry — and the patch editor itself — has a "Send to SUB-Station" action that creates a track carrying that patch.',
      'The patch is attached to the track as its sound-design reference and travels into the export manifest.',
    ],
  },
  {
    title: 'Split sheet & COS handoff',
    body: [
      'Add a row per collaborator with a role and a percentage. The panel enforces an exact 100% total.',
      'The COS tab lists everything the ownership pipeline needs. Once all checks pass, the manifest is ingestible.',
      'Master Export bounces the arrangement offline into a master WAV plus per-track stems, and lets you download the JSON manifest.',
    ],
  },
  {
    title: 'Saving',
    body: [
      'Sessions autosave to this browser. Clearing site data clears the session, so bounce anything you want to keep.',
    ],
  },
];

export default function SubStationHelp() {
  return (
    <div className="min-h-screen" style={{ background: '#09090b' }}>
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link to="/sub-station" className="inline-flex items-center gap-1.5 text-[11px] text-white/45 hover:text-white mb-5">
          <ArrowLeft className="w-3 h-3" /> Back to SUB-Station
        </Link>
        <h1 className="text-2xl font-display text-white mb-1">SUB-Station Studio guide</h1>
        <p className="text-xs text-white/45 mb-8">Everything the workstation does, in order of use.</p>

        <div className="space-y-5">
          {SECTIONS.map(s => (
            <div key={s.title} className="rounded-xl border border-white/10 bg-black/40 p-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#14b8a6] mb-2">{s.title}</p>
              <ul className="space-y-1.5">
                {s.body.map((b, i) => (
                  <li key={i} className="text-[12px] text-white/60 leading-relaxed">— {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Link to="/sub-station/terms" className="inline-block mt-6 text-[11px] text-[#FFC98A] hover:text-white">
          SUB-Station terms of service →
        </Link>
      </div>
    </div>
  );
}