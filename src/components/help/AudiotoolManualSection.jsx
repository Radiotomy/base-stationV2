import React from 'react';
import { ExternalLink } from 'lucide-react';
import { MANUAL_DEVICES, MANUAL_GUIDES, MANUAL_HOME } from '@/lib/audiotool/audiotoolManual';

const CATS = ['Synthesizers', 'Drums', 'Effects', 'Tools'];
const unique = Object.values(MANUAL_DEVICES).filter((d, i, all) => all.findIndex((x) => x.name === d.name) === i);

const Entry = ({ item }) => (
  <li>
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline inline-flex items-center gap-1">
      {item.name} <ExternalLink className="w-3 h-3" />
    </a>{' '}— {item.summary}
    {item.bridge && <span className="text-emerald-300"> · In BASE Station: {item.bridge}</span>}
  </li>
);

export default function AudiotoolManualSection() {
  return (
    <>
      <p>Audiotool's <a href={MANUAL_HOME} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">official manual</a> is the full reference for every device. Below is a short summary of each, plus where BASE Station uses it. Every device listed shows up in the Bridge's Session Explorer with a <strong>Manual</strong> link, can be bypassed from there, and can be linked in Foundry Remote.</p>
      <p className="font-semibold text-foreground">Get started & workflows</p>
      <ul className="list-disc pl-5 space-y-1">{MANUAL_GUIDES.map((g) => <Entry key={g.name} item={g} />)}</ul>
      {CATS.map((cat) => (
        <div key={cat}>
          <p className="font-semibold text-foreground mt-2">{cat}</p>
          <ul className="list-disc pl-5 space-y-1">{unique.filter((d) => d.cat === cat).map((d) => <Entry key={d.name} item={d} />)}</ul>
        </div>
      ))}
      <p className="text-xs">VST3 plugins run on your computer through Audiotool's VST Bridge helper. BASE Station can't install them or open their windows — do that in Audiotool — but once the device is in your project we list it and can map the knobs Audiotool exposes.</p>
    </>
  );
}