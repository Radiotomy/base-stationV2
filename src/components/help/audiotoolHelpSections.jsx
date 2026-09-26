import React from 'react';
import { Link } from 'react-router-dom';
import { Link2, FolderOpen, Wand2, Rocket, SlidersHorizontal, ShieldCheck, Headphones, Wrench } from 'lucide-react';

const Box = ({ tone = 'amber', title, children }) => (
  <div className={`p-3 rounded-xl border ${tone === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
    <p className={`font-bold text-sm mb-1 ${tone === 'emerald' ? 'text-emerald-300' : 'text-amber-300'}`}>{title}</p>
    {children}
  </div>
);

/** Audiotool Bridge + Audius help content, same pattern as the Foundry sections. */
const AUDIOTOOL_HELP_SECTIONS = [
  {
    id: 'audiotool-bridge',
    title: 'Audiotool Bridge — connect & get started',
    icon: Link2,
    keywords: 'audiotool bridge connect sign in login nexus daw live sync account disconnect session key scope beta preview',
    body: (
      <>
        <p>The <Link to="/audiotool" className="text-orange-400 hover:underline">Audiotool Bridge</Link> opens your <strong className="text-foreground">Audiotool</strong> projects live inside BASE Station. Everything syncs both ways in real time: change something in Audiotool and it shows up here; send something from a Bridge tool and it appears on your Audiotool desktop or timeline.</p>
        <p><strong className="text-foreground">Getting connected:</strong></p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Open the Bridge (Studios hub → Audiotool Bridge). It's a beta feature, so request access if you see the gate.</li>
          <li>Press <strong>Connect Audiotool</strong> and approve access in the Audiotool window.</li>
          <li>Your account card shows your name, project count, and the access you granted (read/edit projects, samples, presets).</li>
        </ol>
        <Box title="⚠️ Sign in from the live app">
          <p>Audiotool only returns sign-ins to the published BASE Station address. In the editor preview the Connect button is disabled, and a link takes you to the live app instead.</p>
        </Box>
        <p>Your session key renews by itself. Press <strong>Disconnect</strong> any time to revoke access.</p>
      </>
    ),
  },
  {
    id: 'audiotool-projects',
    title: 'Audiotool projects — open, create, templates, properties & collaborators',
    icon: FolderOpen,
    keywords: 'audiotool project open sync new blank template songstarter paste link properties bpm tags license remix download collaborators invite role session explorer mute bypass deep link counts',
    body: (
      <>
        <p><strong className="text-foreground">Opening a project.</strong> Click any project in "Your Audiotool projects", or paste a <code>beta.audiotool.com/studio?project=…</code> link and press <strong>Open & sync</strong>. Press Refresh if a project you just made isn't listed yet.</p>
        <p><strong className="text-foreground">New Project</strong> creates a blank project, or one from the <strong>BASE Songstarter template</strong> (mixer, drums and an audio track ready for loops). It opens in a new Audiotool tab and syncs in the Bridge at the same time.</p>
        <Box title="📄 Audiotool's public templates">
          <p>Audiotool doesn't let outside apps copy its public templates (audiotool.com/template/…). Open the template on Audiotool, save it into your own projects, then pick it from your list here.</p>
        </Box>
        <p><strong className="text-foreground">Once a project is open:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Project Properties</strong> — title, BPM, description, tags, license, and the "allow copy/remix" and "allow download" switches save straight to Audiotool. You can only change cover art inside Audiotool.</li>
          <li><strong>Collaborators</strong> — invite Audiotool users by username and pick a role. Editors work on the session with you live.</li>
          <li><strong>Live counts</strong> — notes, tracks, automation points and cables, updated as the project changes.</li>
          <li><strong>Session Explorer</strong> — every track and device. Mute tracks or bypass devices without leaving BASE Station. The link icon copies a URL that reopens the Bridge focused on that exact item.</li>
          <li><strong>Send session state to BASE Engines</strong> — sends a read-only snapshot of the session for analysis. Your project isn't changed.</li>
        </ul>
        <p>If you see "Connection to Audiotool lost", hold off on edits until it reconnects.</p>
      </>
    ),
  },
  {
    id: 'audiotool-ai-tools',
    title: 'Bridge creative tools — Co-Producer, drums, synths & automation',
    icon: Wand2,
    keywords: 'audiotool co-producer midi region rewrite undo drum machine beatbox 8 pattern bassline tonematrix automation lane curve shape filter sweep ai human',
    body: (
      <>
        <p>Every tool writes straight into your live project. Each one can be driven by AI or by hand, and the ownership meter always knows which was which.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Nexus Co-Producer</strong> — pick a MIDI region, describe a change ("syncopated arpeggio up an octave") or tap a quick prompt. The new version goes <em>after</em> the original or onto a <em>layered</em> track; your original is never overwritten. Undo any rewrite from the history list.</li>
          <li><strong>Drum Machine</strong> — describe a beat or tap the 1- or 2-bar step grid, add accents, then <strong>Send to Audiotool</strong> to create a new Beatbox 8.</li>
          <li><strong>Pattern Synths</strong> — write a <strong>Bassline</strong> (acid-style mono line) or a <strong>Tonematrix</strong> melody, edit the grid, and send it to a new device.</li>
          <li><strong>Automation Lanes</strong> — choose a device, a parameter and a shape (rise, fall, pulse… or AI from a description), set start bar and length, and it lands as an automation region.</li>
        </ul>
        <Box tone="emerald" title="💚 Hand-made counts as yours">
          <p>Patterns you tap in, preset curve shapes, and anything you build in Audiotool itself count as human. Only AI-generated output is logged as AI, and undoing it removes it from the log.</p>
        </Box>
      </>
    ),
  },
  {
    id: 'audiotool-songstarter',
    title: 'Songstarter — loops, sound FX & instrument chains',
    icon: Rocket,
    keywords: 'songstarter instrument chain preset forge loop sound fx sfx elevenlabs search by sound semantic freesound community library send to audiotool timeline sample',
    body: (
      <>
        <p>Songstarter gathers sounds in one place. Preview anything here, then press <strong>Send to Audiotool</strong> to drop it on a new audio track at the end of your timeline.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Instrument Chain</strong> — describe a sound; we match community presets and wire synth → effects → a new mixer channel.</li>
          <li><strong>BASE Forge Loops</strong> — generate a tempo-matched loop.</li>
          <li><strong>Sound FX</strong> — generate a sound effect from text.</li>
          <li><strong>Search by Sound</strong> — describe a vibe and find matching loops in the library.</li>
          <li><strong>Discover Free Loops</strong> — Freesound loops. The Creative Commons credit travels with the region name.</li>
          <li><strong>Community Library</strong> — loops other creators have shared.</li>
          <li><strong>Audius Contests</strong> — see the Audius section below.</li>
        </ul>
        <p className="text-xs">Generated loops, SFX and AI library samples are logged as AI material. Freesound and human-made community loops are not.</p>
      </>
    ),
  },
  {
    id: 'audiotool-remote-coop',
    title: 'Foundry Remote & Audience Co-Op',
    icon: SlidersHorizontal,
    keywords: 'foundry remote patch control surface link device map parameter range mirror cables bypass audience co-op venue chat generate command sfx loop midi',
    body: (
      <>
        <p><strong className="text-foreground">Foundry Remote</strong> turns a <Link to="/foundry" className="text-orange-400 hover:underline">BASE Foundry</Link> patch into a control surface. Pick a patch, link each module to an Audiotool device, and map each Foundry parameter onto a device knob with its own range. Turning a knob here moves the real knob in your session.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Send all values</strong> pushes every mapped value at once. <strong>Save to patch</strong> stores the knob positions back on your patch.</li>
          <li><strong>Mirror patch routing to cables</strong> rewires audio cables between linked devices to follow the patch's signal flow.</li>
          <li>If Audiotool rejects a value, narrow that mapping's range.</li>
        </ul>
        <p><strong className="text-foreground">Audience Co-Op</strong> lets fans in your <Link to="/live-venues" className="text-orange-400 hover:underline">3D venue</Link> shape the track by typing <code>/generate sfx …</code>, <code>/generate loop …</code> or <code>/generate midi …</code> in venue chat.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Choose a venue, set the loop BPM, pick which request types to allow, then switch on <strong>Accept audience commands</strong>.</li>
          <li>Requests run one at a time <strong>on your credits</strong> and land after the end of your timeline, so playback keeps going.</li>
          <li>Only one Bridge tab can handle a venue at a time.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'audiotool-protect',
    title: 'Protect & Register an Audiotool export',
    icon: ShieldCheck,
    keywords: 'audiotool export protect register wav watermark base mark c2pa seal anchor on chain creative ownership score 40mb size limit contest genre pipeline',
    body: (
      <>
        <p>When your mix is ready, export it from Audiotool (WAV is best), then use <strong>Protect & Register Export</strong> at the bottom of the Bridge:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Pick the export from your Audiotool samples (new renders are detected on their own), or upload a file from your computer.</li>
          <li>Check the title (defaults to the project name) and genre (suggested from project tags).</li>
          <li>Press <strong>Protect & register</strong>.</li>
        </ol>
        <p>A status tracker shows each step: ownership scoring from this session's telemetry → <strong>BASE Mark</strong> watermark → <strong>C2PA</strong> manifest sealed over the watermarked audio → on-chain anchor on Base (if <strong>auto-anchoring</strong> is on). The anchor always covers the file you actually deliver, never the raw export.</p>
        <Box title="📦 File limits">
          <p>Exports must be under <strong className="text-foreground">40 MB</strong>. For long songs, export 16-bit or split the track. MP3s are accepted, but only lossless audio gets the strongest watermark.</p>
        </Box>
        <p>Download the protected file from your <Link to="/asset-gallery" className="text-purple-400 hover:underline">library</Link> and view its chain record in <Link to="/creator-dashboard?tab=proof" className="text-blue-400 hover:underline">Proof of Ownership</Link>.</p>
      </>
    ),
  },
  {
    id: 'audius',
    title: 'Audius — distribute, remix contests, browse & cross-links',
    icon: Headphones,
    keywords: 'audius distribute publish release upload popup sign in remix contest trending search artist track cross link on audius genre chart playlist sweep resemblance oauth',
    body: (
      <>
        <p><strong className="text-foreground">Distribute from the Bridge.</strong> Once a protected export is watermarked and sealed, <strong>Distribute to Audius</strong> unlocks. It uploads the watermarked WAV to <em>your own</em> Audius account with the project name, cover and BPM. The description includes your ownership score and the Base anchor link. You sign in to Audius in a popup, so your live Audiotool session stays open.</p>
        <p><strong className="text-foreground">Remix contests.</strong> The Songstarter's Audius Contests tab lists active Audius remix contests that come with stems from the contest host. Send a stem to your timeline, and when you distribute this project's protected export to Audius, it goes in as a remix of the contest track. A notice above the export panel confirms the entry, and you can switch it off.</p>
        <p><strong className="text-foreground">Publishing from anywhere else.</strong> Any finished audio asset can be published with <strong>Publish to Audius</strong>. Placeholder or unfinished tracks are blocked, and the genre is mapped to Audius's official genre list.</p>
        <p><strong className="text-foreground">Browsing Audius.</strong> <Link to="/audius-trending" className="text-emerald-400 hover:underline">Trending</Link>, <Link to="/audius-search" className="text-emerald-400 hover:underline">Search</Link>, artist and track pages stream straight from the Audius network, and Audius tracks mix into <Link to="/radio" className="text-emerald-400 hover:underline">Radio</Link>.</p>
        <p><strong className="text-foreground">Cross-links.</strong> Chart rows and playlist tracks with a confirmed Audius release show an <strong>On Audius</strong> link. Audius track pages show where the track sits on BASE Station. A release is linked only after Audius confirms it.</p>
        <p className="text-xs">Audius releases also link to the on-chain anchor where one exists. An anchor made before the release is labelled as an off-chain back-link, the weaker of the two kinds of proof.</p>
      </>
    ),
  },
  {
    id: 'audiotool-troubleshooting',
    title: 'Audiotool & Audius troubleshooting',
    icon: Wrench,
    keywords: 'audiotool error troubleshooting 403 forbidden insufficient rights cors notsamesite thumbnail connection lost rejected sign in popup blocked audius upload failed',
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Connect button is greyed out</strong> — you're in the editor preview; open the live app.</li>
        <li><strong>403 / "insufficient rights" opening a link</strong> — it's a template or someone else's project. Save a copy to your own projects in Audiotool first, or ask the owner to invite you as a collaborator.</li>
        <li><strong>"ERR_BLOCKED_BY_RESPONSE" in the console</strong> — Audiotool blocking a cover thumbnail from loading on another site. It's harmless.</li>
        <li><strong>"Audiotool rejected…"</strong> — a value was out of range, or the connection dropped. Check the connection banner and try again.</li>
        <li><strong>A new project or export isn't listed</strong> — press Refresh; syncing can take a few seconds.</li>
        <li><strong>Export too large</strong> — stay under 40 MB (export 16-bit or shorter).</li>
        <li><strong>Audius popup didn't open</strong> — allow popups for BASE Station and press Distribute again.</li>
        <li><strong>Distribute to Audius stays locked</strong> — it waits for watermarking and C2PA sealing to finish. Watch the status tracker.</li>
      </ul>
    ),
  },
];

export default AUDIOTOOL_HELP_SECTIONS;