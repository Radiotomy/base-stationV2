import { Link } from "react-router-dom";

export default function AppFooter() {
  return (
    <footer className="px-4 py-4 flex flex-col items-center gap-2 text-[11px] text-white/40 font-semibold border-t border-white/5">
      <nav className="flex items-center gap-3 flex-wrap justify-center">
        <Link to="/docs" className="hover:text-white transition-colors">Docs</Link>
        <span className="text-white/15">·</span>
        <Link to="/terms" className="hover:text-white transition-colors">Terms of Use</Link>
        <span className="text-white/15">·</span>
        <Link to="/transparency" className="hover:text-white transition-colors">AI Transparency</Link>
        <span className="text-white/15">·</span>
        <Link to="/creative-ownership" className="hover:text-white transition-colors">Creative Ownership</Link>
        <span className="text-white/15">·</span>
        <a href="mailto:contact@basestation.live" className="text-[#FF9A4D] hover:text-white transition-colors">contact@basestation.live</a>
      </nav>
      <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-4">
        <p>© {new Date().getFullYear()} BASE Station. All rights reserved.</p>
        <p>Developed with <span className="text-[#FF6B4A]">❤️</span> by Radiotomy</p>
      </div>
    </footer>
  );
}