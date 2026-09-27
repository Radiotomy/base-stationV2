import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Presentation, Download, Link2, Loader2, Check } from 'lucide-react';
import CategoryCard from '@/components/hackathon/CategoryCard';
import { CATEGORIES, HIGHLIGHTS, IMAGES, INTRO, TAGLINE, LINKS, APP_URL } from '@/lib/hackathon/content';
import { exportPromoPdf } from '@/lib/hackathon/exportPromoPdf';

export default function Hackathon() {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const download = async () => {
    setBusy(true);
    await exportPromoPdf().finally(() => setBusy(false));
  };
  const copy = async () => {
    await navigator.clipboard.writeText(`${APP_URL}/hackathon`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 pt-24 pb-20">
      <section className="relative overflow-hidden rounded-3xl merc-card">
        <img src={IMAGES.hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="relative p-10 md:p-16">
          <p className="text-xs uppercase tracking-[0.25em] text-accent">Audiotool · Let's Build submission</p>
          <h1 className="mt-4 max-w-4xl text-4xl md:text-5xl font-display leading-tight">{TAGLINE}</h1>
          <p className="mt-5 max-w-2xl text-muted-foreground">{INTRO}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/hackathon/deck" className="merc-button inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold">
              <Presentation className="h-4 w-4" /> Open the deck
            </Link>
            <button onClick={download} disabled={busy} className="merc-button-dark inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download promotional PDF
            </button>
            <button onClick={copy} className="merc-button-dark inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold">
              {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied ? 'Copied' : 'Copy share link'}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-3xl font-display">Six categories, one studio</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => <CategoryCard key={c.num} c={c} />)}
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-2">
        <div className="merc-card rounded-2xl p-8">
          <h2 className="text-2xl font-display">How it works</h2>
          <ol className="mt-4 space-y-3 text-sm text-foreground/85 list-decimal pl-5">
            <li>Sign into Audiotool from the Bridge hub.</li>
            <li>Open a project or start a Vibe → Session starter.</li>
            <li>Open Beat & Pattern, Harmony & Arrangement or Vocal Lab.</li>
            <li>Generate or find a sound — Send to Audiotool lands it live.</li>
            <li>Protect & Register the export: watermark, score, anchor, distribute.</li>
          </ol>
        </div>
        <div className="merc-card rounded-2xl p-8">
          <h2 className="text-2xl font-display">Technical highlights</h2>
          <ul className="mt-4 space-y-3 text-sm text-foreground/85">
            {HIGHLIGHTS.map((h) => <li key={h} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />{h}</li>)}
          </ul>
        </div>
      </section>

      <section className="mt-16 flex flex-wrap gap-3">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="merc-button-dark rounded-full px-5 py-2.5 text-sm">{l.label}</Link>
        ))}
      </section>
    </div>
  );
}