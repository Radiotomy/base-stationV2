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
          <li>Open the Bridge (Studios hub → Audiotool Bridge) while signed in to BASE Station.</li>
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
          <p>Templates belong to Audiotool, so they can't be opened live directly. When you paste a template link, the Bridge first copies it into your own projects and opens that copy. If Audiotool refuses the copy, open the template on audiotool.com, save it to your projects, then pick it from your list here.</p>
        </Box>
        <p><strong className="text-foreground">Once a project is open:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Project Properties</strong> — title, BPM, description, tags, license, and the "allow copy/remix" and "allow download" switches save straight to Audiotool. You can only change cover art inside Audiotool.</li>
          <li><strong>Collaborators</strong> — invite Audiotool users by username and pick a role. Editors work on the session with you live.</li>
          <li><strong>Live counts</strong> — notes, tracks, automation points and cables, updated as the project changes.</li>
          <li><strong>Session Explorer</strong> — every track and device. Mute tracks or bypass devices without leaving BASE Station. The link icon copies a URL that reopens the Bridge focused on that exact item.</li>
          <li><strong>Create in a workspace</strong> — opens the same live project in one of the full-screen workspaces (see below).</li>
        </ul>
        <p>If you see "Connection to Audiotool lost", hold off on edits until it reconnects.</p>
      </>
    ),
  },
  {
    id: 'audiotool-workspaces',
    title: 'Audiotool workspaces — Beat & Pattern, Harmony & Arrangement, Vocal Lab',
    icon: Wand2,
    keywords: 'audiotool workspace full screen beat pattern studio harmony arrangement vocal lab chord pads progression notes harmonyeditor companion cadence bed cantor vocal take record harmony layer song structure sections',
    body: (
      <>
        <p>Once a project is open in the Bridge, the <strong>Create in a workspace</strong> cards reopen it in a full-screen BASE Station instrument. Each workspace edits the same live project, so changes sync both ways with Audiotool and with the Bridge. You can switch between workspaces without closing the session.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Beat & Pattern Studio</strong> — step-sequence drums (Beatbox 8), basslines and Tonematrix melodies, by hand or from a description.</li>
          <li><strong>Harmony & Arrangement</strong> — write chord progressions on the chord pads or import them from a Lead Sheet, rework MIDI with the Co-Producer, and see your song sections. Audiotool's own <strong>NOTES</strong> editor sits alongside as a companion. <strong>Cadence beds</strong> (instrumentals rendered from your Lead Sheet chords) can be placed on the timeline.</li>
          <li><strong>Vocal Lab</strong> — record vocal takes, add harmony layers, and place <strong>Cantor</strong> vocals (your Lead Sheet melodies, sung) on the vocal timeline.</li>
        </ul>
        <Box tone="emerald" title="💚 What counts as yours">
          <p>Chord progressions you write, takes you record and patterns you tap count as human. Cadence beds, Cantor vocals, AI harmony layers and AI-written patterns are logged as AI in the ownership meter shown in each workspace.</p>
        </Box>
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
          <li><strong>Vibe → Session</strong> — pick a mood and it writes your first bars: a tempo-locked Forge loop plus a transition riser, both placed on the timeline in one click (5 credits).</li>
          <li><strong>Instrument Chain</strong> — describe a sound; we match community presets and wire synth → effects → a new mixer channel.</li>
          <li><strong>BASE Forge Loops</strong> — generate a tempo-matched loop.</li>
          <li><strong>Sound FX</strong> — generate a sound effect from text.</li>
          <li><strong>Search by Sound</strong> — describe a vibe and find matching loops in the library.</li>
          <li><strong>Discover Free Loops</strong> — Freesound loops. The Creative Commons credit travels with the region name.</li>
          <li><strong>Community Library</strong> — loops other creators have shared.</li>
          <li><strong>Audius Contests</strong> — see the Audius section below.</li>
          <li><strong>Remix from Audius</strong> — search Audius and drop a Creative Commons or open-remix release onto your timeline. All Rights Reserved tracks stay locked, and every import is licence-checked and saved to your library first.</li>
        </ul>
        <p className="text-xs">Generated loops, SFX and AI library samples are logged as AI material. Freesound and human-made community loops are not. Audius material is third-party and is never counted as your own work.</p>
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
        <Box tone="emerald" title="🕰️ Bringing in older Audiotool tracks">
          <p>Work made before you connected the Bridge can be protected too: open the old project from your list and export a fresh mixdown, or pick an earlier bounce from the <strong>My library</strong> tab of the picker. Audiotool doesn't let apps read its published-track catalog or a-radio, so a track only comes over if its project or a saved bounce still exists in your account.</p>
        </Box>
        <p>A status tracker shows each step: ownership scoring from this session's telemetry → <strong>BASE Mark</strong> watermark → <strong>C2PA</strong> manifest sealed over the watermarked audio → on-chain anchor on Base (if <strong>auto-anchoring</strong> is on). The anchor always covers the file you actually deliver, never the raw export.</p>
        <p><strong className="text-foreground">After anchoring</strong>, the track is added to BASE Station <Link to="/charts" className="text-orange-400 hover:underline">Charts</Link>, the featured "Fresh from the Audiotool Bridge" playlist, and <Link to="/radio" className="text-orange-400 hover:underline">Radio</Link> automatically. If auto-anchoring is off, the export is still watermarked and sealed, but isn't placed there.</p>
        <Box title="📦 File limits">
          <p>Exports must be under <strong className="text-foreground">40 MB</strong>. For long songs, export as <strong>FLAC</strong> (same quality, about half the size) or register shorter sections. MP3s are accepted, but only lossless audio gets the strongest watermark.</p>
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
        <p><strong className="text-foreground">Remix contests.</strong> The Songstarter's Audius Contests tab lists active Audius remix contests that come with stems from the contest host. Send a stem to your timeline, and when you distribute this project's protected export to Audius, it goes in as a remix of the contest track. The contest link is saved to your account, so it's still there if you finish the project on another device or browser. A notice above the export panel confirms the entry, and you can switch it off. The host's stems are credited as third-party material and don't count toward your ownership score.</p>
        <p><strong className="text-foreground">Order of steps.</strong> Protect & Register → watermark → C2PA seal → Base anchor (if on) → Distribute to Audius. Because the release is created last, its description carries your ownership score and anchor link, and chart and playlist entries are linked to the Audius release once Audius confirms it.</p>
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
        <li><strong>Export too large</strong> — stay under 40 MB (export as FLAC, or register shorter sections).</li>
        <li><strong>Contest entry notice missing</strong> — send one of the contest's stems to this project's timeline again while signed in to the same BASE Station account.</li>
        <li><strong>Template link won't open</strong> — Audiotool refused the automatic copy. Save the template to your own projects on audiotool.com, then pick it from your list.</li>
        <li><strong>Audius popup didn't open</strong> — allow popups for BASE Station and press Distribute again.</li>
        <li><strong>Distribute to Audius stays locked</strong> — it waits for watermarking and C2PA sealing to finish. Watch the status tracker.</li>
      </ul>
    ),
  },
];

export default AUDIOTOOL_HELP_SECTIONS;