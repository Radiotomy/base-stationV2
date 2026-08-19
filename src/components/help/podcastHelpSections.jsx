import { Link } from 'react-router-dom';
import { Mic, Podcast, ShieldCheck } from 'lucide-react';

/**
 * ORVO Podcast Studio help content. Kept in its own module so the /help
 * reference list stays readable as the podcast module grows.
 */
const PODCAST_HELP_SECTIONS = [
  {
    id: 'orvo',
    title: 'ORVO Podcast Studio — start a show & publish episodes',
    icon: Podcast,
    keywords: 'podcast orvo studio show episode upload publish ipfs pinata season episode number thumbnail draft premium chapters transcript listen directory',
    body: (
      <>
        <p><strong className="text-foreground">ORVO Studio</strong> is BASE Station's podcast module — create a show, publish episodes, and carry the same provenance guarantees your music gets. Open it at <Link to="/studios/orvo" className="text-amber-400 hover:underline">Studios → ORVO</Link>.</p>
        <p><strong className="text-foreground">The flow, start to finish:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>1 · Create a podcast</strong> — title, description, category, and cover art. This is the "show" container; every episode belongs to one.</li>
          <li><strong>2 · Upload an episode</strong> — pick the show, add your audio file, title, description, season and episode number. Optionally attach a per-episode thumbnail.</li>
          <li><strong>3 · Declare how it was made</strong> — the origin attestation step (see the provenance section below). This is required for an honest disclosure label.</li>
          <li><strong>4 · Save as draft or publish</strong> — drafts stay private to you; published episodes appear on your show page and in the public directory.</li>
        </ul>
        <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
          <p className="text-indigo-300 font-bold text-sm mb-1">📦 Where your audio actually lives</p>
          <p>Every episode is stored <strong className="text-foreground">twice, on purpose</strong>: pinned to <strong className="text-foreground">IPFS</strong> for permanent, content-addressed provenance, and copied to BASE Station storage as the reliable playback and forensic-marking source. Public IPFS gateways are rate-limited, so the second copy is what keeps playback and BASE Mark from failing on a busy day.</p>
        </div>
        <p><strong className="text-foreground">Audio prep tips:</strong> upload the highest-quality file you have — WAV or a high-bitrate MP3. Marking works best on uncompressed audio, and re-compressing an already-compressed file loses quality you can't get back. Normalize speech to roughly <strong className="text-foreground">-16 LUFS</strong> for mono / <strong className="text-foreground">-19 LUFS</strong> stereo (the podcast convention), not the -14 you'd use for music.</p>
        <p><strong className="text-foreground">Broken audio link?</strong> Open the episode and use <strong className="text-foreground">Re-upload audio</strong> — it swaps the file in place on the existing episode, keeping its URL, stats, and comments intact instead of forcing you to republish.</p>
        <p><strong className="text-foreground">Chapters &amp; transcripts:</strong> add chapter markers so listeners can jump between segments, and generate a transcript to make the episode searchable and accessible.</p>
      </>
    ),
  },
  {
    id: 'orvo-voice',
    title: 'Podcast voice & AI narration — voiceovers, personas, live rooms',
    icon: Mic,
    keywords: 'voiceover podcast narration inworld elevenlabs voice persona emotion tags laugh sigh recording guest link collaboration co-host live event room episode intelligence assemblyai summary chapters',
    body: (
      <>
        <p><strong className="text-foreground">🎙️ Recording &amp; guests</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Record in the browser</strong> — capture a take directly, no external DAW needed.</li>
          <li><strong>Guest links</strong> — invite a co-host or guest by email, or send a public guest-recording link. They record their side on their own time; you assemble the episode.</li>
          <li><strong>Roles</strong> — invite collaborators as co-host, guest, or editor from the show's collaborator panel.</li>
        </ul>
        <p><strong className="text-foreground">🗣️ AI voiceover</strong> — the <Link to="/studios/orvo/voiceover" className="text-amber-400 hover:underline">Voiceover Studio</Link> generates narration, intros, and outros from a script. Save a <strong className="text-foreground">voice persona</strong> so every episode opens with the same recognisable voice.</p>
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <p className="text-amber-300 font-bold text-sm mb-1">💡 Steer the performance, not just the words</p>
          <p>Inline emotion tags shape delivery — <code className="text-foreground">[laugh]</code>, <code className="text-foreground">[sigh]</code>, and friends turn flat read-aloud into something that sounds like a conversation. Use them sparingly at natural beats; stacking them reads as parody.</p>
        </div>
        <p><strong className="text-foreground">📡 Live rooms</strong> — schedule a live event, go on air, and take listener turns in real time from <Link to="/studios/orvo/live" className="text-amber-400 hover:underline">ORVO Live</Link>. The session can be recorded and turned into an episode afterward.</p>
        <p><strong className="text-foreground">🧠 Episode Intelligence</strong> — an optional, manually-triggered analysis pass that produces a transcript, summary, key topics, and suggested chapter markers. It only runs when you press <strong className="text-foreground">Run analysis</strong>, so you never spend on it by accident.</p>
        <p><strong className="text-foreground">🔎 Getting found</strong> — published shows and episodes surface on the public <Link to="/podcasts" className="text-purple-400 hover:underline">Podcasts directory</Link> and the site home. Write a real description with the words a listener would actually search for; a strong episode description does more for discovery than a clever title.</p>
      </>
    ),
  },
  {
    id: 'orvo-provenance',
    title: 'Podcast provenance — attestation, BASE Mark & Content Credentials',
    icon: ShieldCheck,
    keywords: 'podcast provenance attestation declared origin human ai assisted generated unverified base mark watermark episode chain anchor base blockchain foreign provenance metadata c2pa content credentials tier 1 tier 2 advisory review disclosure label creative ownership score',
    body: (
      <>
        <p>Podcast episodes get the same provenance stack as music — with one important difference: <strong className="text-foreground">for speech, you declare the origin. We don't guess it.</strong></p>
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <p className="text-emerald-300 font-bold text-sm mb-1">✍️ Why you attest instead of us detecting</p>
          <p>We tried inferring AI use from the audio and it was <em>wrong in the worst direction</em> — genuinely human-recorded episodes were being labelled AI simply because they arrived without in-app telemetry. So origin is now <strong className="text-foreground">declared by you</strong>, the rights holder, exactly as the RIAA/IFPI-style disclosure standard intends. Pick <strong>Human recorded</strong>, <strong>AI assisted</strong>, or <strong>AI generated</strong> when you publish.</p>
          <p className="mt-1.5">If nothing is declared and no AI use was observed, the label stays <strong className="text-foreground">Unverified</strong> — that means "not stated", <em>not</em> an accusation of AI authorship.</p>
        </div>
        <p><strong className="text-foreground">Register provenance</strong> on any episode to run the full cascade:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Creative Ownership Score</strong> — computed from real creative-process signals (in-app recording takes, guest takes, your own script and direction) plus your declared origin.</li>
          <li><strong>BASE Mark</strong> — an inaudible forensic watermark embedded in the episode audio, so the episode stays identifiable even if metadata is stripped and the file is re-encoded. Marking runs in the background; the panel polls until it settles.</li>
          <li><strong>On-chain anchor</strong> — the provenance bundle is pinned to IPFS and its fingerprint anchored on the <strong className="text-foreground">Base</strong> blockchain. No wallet or gas needed.</li>
        </ul>
        <p><strong className="text-foreground">Correcting a published anchor:</strong> a blockchain record can't be edited or deleted. If a label was wrong, publish a <strong className="text-foreground">correction anchor</strong> — a new transaction that explicitly names the one it supersedes, so anyone reading the old record is led to the authoritative one. Nothing is hidden; the trail stays honest.</p>
        <p className="pt-1"><strong className="text-foreground">Scanning episodes you made elsewhere</strong> — outside uploads carry no BASE Station telemetry, so two read-only scans report what the <em>file itself</em> declares:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Tier 1 · Container metadata</strong> — the originating workstation, encoder software, and coding history that your DAW or recorder wrote into the file. An empty result means the metadata was stripped or never written — it is not a finding against you.</li>
          <li><strong>Tier 2 · Content Credentials (C2PA)</strong> — any manifest a writing tool deliberately attached, including its claim generator, the actions it recorded, and the chain of earlier files it drew from.</li>
        </ul>
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-foreground font-bold text-sm mb-1">🕰️ Tier 2 describes the <em>original upload</em></p>
          <p>BASE Mark rewrites the audio when it embeds, so a scan taken after marking can only describe <strong className="text-foreground">our</strong> output copy — not the file you supplied. Tier 2 is therefore captured on the pristine file at registration and kept: every result is stamped <strong className="text-foreground">"read from the original upload"</strong> or <strong className="text-foreground">"read from a processed copy"</strong>, and a pristine scan is never overwritten by a later one.</p>
        </div>
        <p><strong className="text-foreground">Advisory review</strong> — the panel can also compare your attestation against records we already hold (synthetic voices used, recording takes, your own prior episodes) and against an external provider's check for its own generated speech. Both are <strong className="text-foreground">advisory only</strong>: they surface a discrepancy for a human to look at, and can never change your disclosure label or your score.</p>
        <p>Background reading: <Link to="/transparency" className="text-amber-400 hover:underline">AI Transparency</Link> · <Link to="/creative-ownership" className="text-emerald-400 hover:underline">Creative Ownership</Link> · <Link to="/trust" className="text-purple-400 hover:underline">Trust Center</Link></p>
      </>
    ),
  },
];

export default PODCAST_HELP_SECTIONS;