import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, GitFork } from 'lucide-react';

/**
 * BASE Foundry help content. Kept in its own file so the main Help section list
 * stays legible, same pattern as the ORVO podcast sections.
 */
const FOUNDRY_HELP_SECTIONS = [
  {
    id: 'foundry',
    title: 'BASE Foundry — design your own DSP tools',
    icon: Cpu,
    keywords: 'foundry dsp plugin patch synth effect node canvas graph lfo envelope adsr filter delay reverb saturation preset audition modulation visualizer insert voice chain reference profile design score',
    body: (
      <>
        <p><strong className="text-foreground">BASE Foundry</strong> (<Link to="/foundry" className="text-orange-400 hover:underline">/foundry</Link>) is a modular studio for building the <em>tools</em>, not the tracks. Describe the processor you want, rewire it on the canvas, and audition it live.</p>

        <p><strong className="text-foreground">How a patch works:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Prompt it</strong> — describe the sound you're after and the architect lays out a starting signal chain.</li>
          <li><strong>Start from a template</strong> — the Starter Templates shelf (when curated patches exist) forks a reference patch into your workspace so you can learn from a working chain.</li>
          <li><strong>Rewire it</strong> — drag modules from the palette and patch cables between them, including cables into a parameter for modulation:
            <ul className="list-[circle] pl-5 mt-1 space-y-0.5">
              <li><em>Generators</em> — Oscillator, Noise, Sample Player, Drone Texture</li>
              <li><em>Processors</em> — State Variable Filter, Stereo Delay, Reverb, Saturation, 3-Band EQ, Gain</li>
              <li><em>Modulators</em> — LFO (BPM sync), ADSR Envelope</li>
              <li><em>I/O</em> — Insert Input, Output</li>
            </ul>
          </li>
          <li><strong>Ask the assistant</strong> — the assistant pane in the workspace can suggest or rebuild parts of the graph from a description.</li>
          <li><strong>Audition it</strong> — an internal test pulse, your microphone, or a track from your library runs through the chain in real time; meters show level as you tweak.</li>
          <li><strong>Save presets</strong> — a preset stores parameter <em>values</em> only, never topology, so loading one can't quietly turn your patch into a different plugin.</li>
        </ul>

        <p><strong className="text-foreground">Four categories:</strong> Effect · Instrument · Utility · Modulator. Utility patches also appear as <strong className="text-foreground">Voice Chains</strong> in ORVO Studio, where they can be applied to spoken-word audio without destroying the original take.</p>

        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <p className="text-emerald-300 font-bold text-sm mb-1">🎖️ Patches carry their own design score</p>
          <p>Every patch gets a <strong className="text-foreground">0–100 design Creative Ownership Score</strong> based on what you actually authored — manual module edits, rewiring, parameter customisation, and how much came from prompting. It is a <em>tool design</em> score and is deliberately kept separate from a track's audio COS; the two are never blended, and a patch never enters the forensic attribution path for a recording.</p>
        </div>

        <p><strong className="text-foreground">Reference profiling.</strong> Point the Foundry at a reference track and it profiles the tonal balance in your browser to help you shape a patch toward that sound — no credits spent and no audio leaves your machine.</p>

        <p><strong className="text-foreground">Where patches show up:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Mastering Studio</strong> — load a patch into the Foundry insert slot to hear it in a mastering chain.</li>
          <li><strong>Live Studio</strong> — the live patch rack applies patches to a running set.</li>
          <li><strong>Visualizer Studio</strong> — tap a patch's LFO/envelope as a modulation source so visuals move with the processing (see the Visualizer Studio section).</li>
          <li><strong>ORVO Studio</strong> — utility patches as non-destructive Voice Chains.</li>
          <li><strong>Audiotool Bridge</strong> — map a patch's modules onto devices in a live Audiotool project so the Foundry acts as a control surface (the Foundry audio itself never plays inside Audiotool).</li>
        </ul>
      </>
    ),
  },
  {
    id: 'foundry-community',
    title: 'Foundry community — forking, collections & patch challenges',
    icon: GitFork,
    keywords: 'foundry community hub fork forking lineage pedigree collections patch playlist featured most forked trending sort public private showcase artist profile patch design challenge leaderboard',
    body: (
      <>
        <p>Everything social about patches lives at the bottom of the <Link to="/foundry" className="text-orange-400 hover:underline">Foundry page</Link> — there's no separate hub URL. Scroll past "My patches".</p>

        <p><strong className="text-foreground">Community hub.</strong> Public patches are listed with their module count, fork count and design score. Filter by category, and sort by <strong>Newest</strong>, <strong>Most forked</strong>, or <strong>Design score</strong>. A <strong className="text-foreground">Most forked</strong> shelf highlights the designs the community actually reuses.</p>

        <p><strong className="text-foreground">Forking is the sharing mechanism.</strong> Forking copies a public patch into your own workspace so you can take it further. Two things are true by design:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>A fork <strong>inherits the graph but not the parent's design score</strong> — your score starts from what <em>you</em> change.</li>
          <li>Lineage is <strong>shown, not hidden</strong>. A fork is a legitimate entry anywhere on the platform; it simply isn't presented as an original.</li>
        </ul>

        <p><strong className="text-foreground">Collections</strong> are patch playlists: name a shelf, pick any public patches, and publish it. A collection stores <em>pointers</em> only — collecting a patch never forks it, copies its graph, or detaches it from its author, and if a patch later disappears the rest of the shelf is unaffected.</p>

        <p><strong className="text-foreground">Patch Design challenges.</strong> On the <Link to="/challenges" className="text-purple-400 hover:underline">Challenges</Link> page, the Patch Design category judges the graph you designed rather than a recording. Your entry is the live patch itself, with its design score snapshotted at submission time — so you can keep editing afterwards without changing what was judged. The patch-lineage leaderboard shows which entries are originals and which are forks, and how deep each lineage runs.</p>

        <p><strong className="text-foreground">Showcase.</strong> Your public patches appear automatically in a Foundry Patches section on your artist profile. Private patches stay private — work in progress is never published for you.</p>
      </>
    ),
  },
];

export default FOUNDRY_HELP_SECTIONS;