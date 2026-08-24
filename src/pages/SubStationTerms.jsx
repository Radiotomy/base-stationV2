import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TERMS = [
  {
    title: '1. What this module is',
    body: 'SUB-Station Studio is an arrangement and documentation tool inside BASE Station. It renders audio in your browser and produces a manifest describing what you arranged and who you say owns it.',
  },
  {
    title: '2. Your content stays yours',
    body: 'Importing an asset places a reference to it on the timeline. SUB-Station never overwrites, re-encodes or deletes a source file in your library. Bounces are new files you download.',
  },
  {
    title: '3. Split sheets are declarations, not adjudications',
    body: 'The split sheet records what you and your collaborators state about ownership. BASE Station does not verify, arbitrate or enforce these shares, and a balanced manifest is not a legal determination of rights.',
  },
  {
    title: '4. Provenance and disclosure',
    body: 'The AI disclosure label you select is your own attestation. The manifest carries it forward to the Content Ownership System; it is evidence of what you declared, not proof of how the audio was made.',
  },
  {
    title: '5. Local storage',
    body: 'Sessions persist in this browser only. They are not backed up, synced across devices, or recoverable by BASE Station support if cleared. Export anything you need to keep.',
  },
  {
    title: '6. Third-party material',
    body: 'You are responsible for holding the rights to any audio you import or arrange, including samples, stems and recordings you did not generate on this platform.',
  },
  {
    title: '7. Availability',
    body: 'Browser audio performance varies by device. Long arrangements and large stem counts may exceed what a given browser can render, and no particular render time or capacity is guaranteed.',
  },
];

export default function SubStationTerms() {
  return (
    <div className="min-h-screen" style={{ background: '#09090b' }}>
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link to="/sub-station" className="inline-flex items-center gap-1.5 text-[11px] text-white/45 hover:text-white mb-5">
          <ArrowLeft className="w-3 h-3" /> Back to SUB-Station
        </Link>
        <h1 className="text-2xl font-display text-white mb-1">SUB-Station terms of service</h1>
        <p className="text-xs text-white/45 mb-8">
          These terms cover the SUB-Station module specifically and sit alongside the{' '}
          <Link to="/terms" className="underline hover:text-white/70">BASE Station platform terms</Link>.
        </p>

        <div className="space-y-4">
          {TERMS.map(t => (
            <div key={t.title}>
              <p className="text-xs font-semibold text-white/85 mb-1">{t.title}</p>
              <p className="text-[12px] text-white/50 leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}