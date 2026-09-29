/** Recessed glass display strip: icon + mono title readout, live LED on the right. */
export default function MercuryDisplayHeader({ icon: Icon, title, status, live = false, extra }) {
  return (
    <div className="rack-display">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="w-4 h-4 text-[#FFC98A] shrink-0" />}
        <span className="rack-readout text-xs sm:text-sm font-semibold truncate">{title}</span>
        {extra}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {status && <span className="rack-readout text-[10px] opacity-80 hidden sm:inline">{status}</span>}
        <span className={`rack-led ${live ? 'rack-led-on' : ''}`} aria-label={live ? 'Live' : 'Offline'} />
      </div>
    </div>
  );
}