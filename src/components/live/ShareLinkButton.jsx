import { useState } from 'react';
import { Copy, ExternalLink, Check } from 'lucide-react';

export default function ShareLinkButton({ sessionId }) {
  const [copied, setCopied] = useState(false);
  if (!sessionId) return null;

  const url = `${window.location.origin}/live-watch?roomId=${sessionId}`;

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase">Fan Watch Link</p>
      <div className="flex items-center gap-2">
        <p className="text-xs font-mono text-muted-foreground truncate flex-1 bg-muted/50 px-2 py-1.5 rounded-lg">
          {url}
        </p>
        <button
          onClick={copy}
          className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all flex-shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all flex-shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}