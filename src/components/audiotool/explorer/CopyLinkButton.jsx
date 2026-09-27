import { Link2 } from 'lucide-react';

export default function CopyLinkButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Copy link" className="at-copy-btn">
      <Link2 className="w-[15px] h-[15px]" strokeWidth={1.6} />
    </button>
  );
}