import { Link2 } from 'lucide-react';

export default function CopyLinkButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Copy link"
      className="text-muted-foreground hover:text-foreground p-1 rounded-md">
      <Link2 className="w-3.5 h-3.5" />
    </button>
  );
}