export default function AppFooter() {
  return (
    <footer className="px-4 py-4 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-1.5 text-[11px] text-white/40 font-semibold border-t border-white/5">
      <p>© {new Date().getFullYear()} BASE Station. All rights reserved.</p>
      <p>Developed with <span className="text-[#FF6B4A]">❤️</span> by Radiotomy</p>
    </footer>
  );
}