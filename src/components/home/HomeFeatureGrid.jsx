import { useState } from "react";
import { Link } from "react-router-dom";

// Features organized by type — slide-rule tuner: one band's keys visible at a time
const CATEGORIES = [
  {
    id: "create",
    label: "Create",
    accent: "#86d99b",
    items: [
      { to: "/music-studio", title: "Music Studio", desc: "Generate full AI tracks from a text prompt" },
      { to: "/lyrics-studio", title: "Lyrics Studio", desc: "Write lyrics, rhyme schemes & production briefs" },
      { to: "/voice-creator", title: "Voice Creator", desc: "Build a reusable synthetic voice persona" },
      { to: "/sfx-studio", title: "Sound FX", desc: "Generate custom sound effects from text" },
      { to: "/templates", title: "Templates", desc: "Community prompt templates to jumpstart a session" },
    ],
  },
  {
    id: "enhance",
    label: "Enhance & Master",
    accent: "#ff9655",
    items: [
      { to: "/mastering-studio", title: "AI Mastering", desc: "Loudness & EQ targeting Spotify, club or vinyl" },
      { to: "/stem-creator", title: "Stem Creator", desc: "Split a track into vocals, drums, bass & instruments" },
      { to: "/mashup-studio", title: "Mashup Studio", desc: "Blend two tracks into a new arrangement" },
      { to: "/vocal-harmonizer", title: "Vocal Harmonizer", desc: "Layer AI harmonies onto an existing vocal" },
      { to: "/cover-song-studio", title: "Cover & Extend", desc: "Reimagine a track in a new genre or extend it" },
      { to: "/audio-remix-studio", title: "Audio Remix", desc: "Edit, trim & apply effects to any audio file" },
    ],
  },
  {
    id: "visuals",
    label: "Visuals & Video",
    accent: "#d5b8ff",
    items: [
      { to: "/cover-art-studio", title: "Cover Art", desc: "Generate album/track artwork from a prompt" },
      { to: "/video-studio", title: "Video Studio", desc: "AI music videos (beta — request access)" },
      { to: "/visualizer-studio", title: "Visualizer", desc: "Audio-reactive visuals for your tracks" },
    ],
  },
  {
    id: "live",
    label: "Live & Discover",
    accent: "#6fd3e8",
    items: [
      { to: "/live-studio", title: "Live Studio", desc: "Live co-listening sessions with chat & drops (beta)" },
      { to: "/radio", title: "Radio", desc: "24/7 curated channels of community + Audius tracks" },
      { to: "/charts", title: "Charts", desc: "Weekly, monthly & all-time community rankings" },
      { to: "/playlists", title: "Playlists", desc: "Curated and user-built playlists" },
      { to: "/featured-artists", title: "Featured Artists", desc: "Hand-picked creators spotlighted by the team" },
      { to: "/audius-trending", title: "Audius Network", desc: "Trending tracks from the Audius decentralized network" },
    ],
  },
  {
    id: "publish",
    label: "Publish & Promote",
    accent: "#f3cf70",
    items: [
      { to: "/submit", title: "Submit Track", desc: "Enter the public charts & radio with a finished track" },
      { to: "/promo-studio", title: "Promo Package", desc: "Build shareable social cards & promo bundles" },
      { to: "/id3-studio", title: "ID3 Tags", desc: "Write compliant metadata & AI-disclosure tags" },
      { to: "/ai-studio/history", title: "Studio History", desc: "Every generation you've run, with status & credits" },
    ],
  },
];

const CSS = `
.bs-tuner{background:linear-gradient(180deg,#1C1712 0%,#14100C 100%);border:2px solid #66747b;border-radius:14px;padding:14px 16px;color:#e4ecec;box-shadow:inset 0 1px 0 #aeb9bb,0 14px 34px rgba(13,18,20,.28);overflow:hidden}
.bs-dial{border:1px solid #526167;border-radius:10px;background:#111719;box-shadow:inset 0 0 0 7px #181f22,inset 0 -14px 26px rgba(0,0,0,.45);padding:16px 18px 12px;position:relative}
.bs-dialtop{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
.bs-readout{font:700 12px/1 monospace;letter-spacing:.22em;color:#b7c4c5;text-transform:uppercase}
.bs-signal{display:flex;align-items:center;gap:8px;font:700 10px monospace;letter-spacing:.18em;color:#86d99b;text-transform:uppercase}
.bs-signal i{width:8px;height:8px;border-radius:50%;background:#86d99b;box-shadow:0 0 10px #86d99b;animation:bs-pulse 2s ease-in-out infinite}
.bs-scale{height:52px;position:relative;border-top:2px solid #637177;border-bottom:1px solid #354247;background:repeating-linear-gradient(90deg,transparent 0,transparent 38px,#7a888b 39px,#7a888b 40px,transparent 41px,transparent 78px,#465257 79px,#465257 80px);display:flex;align-items:flex-end;justify-content:space-between;padding:0 15px 7px;gap:8px}
.bs-scale:before{content:"";position:absolute;left:9%;right:9%;top:0;height:100%;background:repeating-linear-gradient(90deg,transparent 0,transparent 7px,rgba(203,215,214,.45) 8px,rgba(203,215,214,.45) 9px,transparent 10px);opacity:.65}
.bs-station{position:relative;z-index:1;font:700 12px monospace;letter-spacing:.13em;color:#aebbbc;text-transform:uppercase;text-align:center;cursor:pointer;background:none;border:0;padding:0;transition:color .18s ease,text-shadow .18s ease}
.bs-station:before{content:"";display:block;width:2px;height:14px;background:#d3dddd;margin:0 auto 8px}
.bs-station:hover{color:#efffec;text-shadow:0 0 9px #86d99b}
.bs-station:active{color:#ff9655}
.bs-station:focus-visible{outline:2px solid #ff9655;outline-offset:4px}
.bs-station:after{content:"";position:absolute;top:-30px;left:50%;width:3px;height:34px;background:#FF9A4D;box-shadow:0 0 13px #FF9A4D;transform:translateX(-50%);opacity:0;transition:opacity .18s ease}
.bs-station:first-of-type:after{display:none}
.bs-station[data-on="1"]{color:#C6F27E;text-shadow:0 0 10px #86d99b}
.bs-station[data-on="1"]:after{opacity:1}
.bs-rows{margin-top:14px;border:1px solid #56656a;border-radius:10px;background:#111719;padding:16px 16px 14px;box-shadow:inset 0 0 0 7px #192023,inset 0 -18px 28px rgba(0,0,0,.4)}
.bs-row{display:none;align-items:flex-start;gap:24px;min-height:60px}
.bs-row[data-on="1"]{display:flex}
.bs-label{width:170px;flex:0 0 170px;padding-top:11px;font:700 12px monospace;letter-spacing:.14em;text-transform:uppercase;color:#aebbbc;position:relative}
.bs-label:before{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:11px;background:var(--a);box-shadow:0 0 10px var(--a)}
.bs-keys{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.bs-key{display:flex;align-items:center;gap:9px;min-height:38px;padding:0 15px;border:1px solid #526166;border-radius:5px;background:linear-gradient(180deg,#303b3f,#1b2326);color:#d8e2e1;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.015em;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 3px 0 #0b0e0f;cursor:pointer;transition:color .18s ease,border-color .18s ease,box-shadow .18s ease,transform .18s ease;animation:bs-radioIn .45s both}
.bs-key:before{content:"";width:7px;height:7px;border-radius:50%;background:#718083;box-shadow:inset 0 1px 1px #b7c3c4}
.bs-key:hover{border-color:#86d99b;color:#efffec;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 0 12px rgba(134,217,155,.2),0 3px 0 #0b0e0f}
.bs-key:hover:before{background:#86d99b;box-shadow:0 0 7px #86d99b}
.bs-key:active{transform:translateY(2px);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 1px 0 #0b0e0f}
.bs-key:focus-visible{outline:2px solid #ff9655;outline-offset:3px}
.bs-key:nth-child(1){animation-delay:.04s}
.bs-key:nth-child(2){animation-delay:.1s}
.bs-key:nth-child(3){animation-delay:.16s}
.bs-key:nth-child(4){animation-delay:.22s}
.bs-key:nth-child(5){animation-delay:.28s}
.bs-key:nth-child(6){animation-delay:.34s}
@keyframes bs-radioIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
@keyframes bs-pulse{50%{opacity:.45;box-shadow:0 0 3px #86d99b}}
@media (max-width:640px){
.bs-scale{height:auto;flex-wrap:wrap;justify-content:flex-start;gap:12px;padding-bottom:10px}
.bs-station{font-size:11px}
.bs-station:after{display:none}
.bs-row{flex-direction:column;gap:10px}
.bs-label{width:auto;flex:0 0 auto;padding-top:0}
}
`;

export default function HomeFeatureGrid() {
  const [active, setActive] = useState(CATEGORIES[0].id);

  return (
    <div className="bs-tuner">
      <style>{CSS}</style>

      <div className="bs-dial">
        <div className="bs-dialtop">
          <div className="bs-readout">Studio Select</div>
          <div className="bs-signal"><i />Live</div>
        </div>
        <div className="bs-scale">
          {CATEGORIES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="bs-station"
              data-on={active === id ? "1" : "0"}
              aria-pressed={active === id}
              onClick={() => setActive(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bs-rows">
        {CATEGORIES.map(({ id, label, accent, items }) => (
          <div
            key={id}
            className="bs-row"
            data-on={active === id ? "1" : "0"}
            style={{ "--a": accent }}
          >
            <div className="bs-label">{label}</div>
            <div className="bs-keys">
              {items.map(({ to, title, desc }) => (
                <Link key={title} to={to} title={desc || title} className="bs-key">
                  {title}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}