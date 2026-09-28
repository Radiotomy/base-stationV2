import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import HelpSectionList from '@/components/help/HelpSectionList';
import AUDIOTOOL_HELP_SECTIONS from '@/components/help/audiotoolHelpSections';

export default function AudiotoolGuide() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <Link to="/audiotool" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to the Bridge
        </Link>
        <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-tight flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-accent" /> How the Bridge works
        </h1>
        <p className="mt-3 mb-8 text-muted-foreground max-w-2xl">
          Everything about using Audiotool with BASE Station — connecting, workspaces, Songstarter, devices, protecting exports, Audius distribution and troubleshooting.
        </p>
        <HelpSectionList sections={AUDIOTOOL_HELP_SECTIONS} placeholder="Search the Bridge guide (e.g. export, drums, contests)…" />
        <p className="mt-10 text-sm text-muted-foreground">
          Looking for something outside Audiotool? <Link to="/help" className="text-accent hover:underline">Open the main Help & How-To</Link>.
        </p>
      </div>
    </div>
  );
}