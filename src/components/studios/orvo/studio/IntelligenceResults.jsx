const fmt = (s) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;

const Block = ({ title, children }) => (
  <div>
    <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">{title}</p>
    {children}
  </div>
);

export default function IntelligenceResults({ analysis }) {
  const { speakers = [], sentiment = {}, topics = [], highlights = [] } = analysis;

  return (
    <div className="grid md:grid-cols-2 gap-5 mt-5 pt-5 border-t border-white/10">
      {speakers.length > 0 && (
        <Block title="Speaking time">
          <ul className="space-y-1">
            {speakers.map((s) => (
              <li key={s.speaker} className="text-sm text-white/70 flex justify-between gap-3">
                <span>Speaker {s.speaker}</span>
                <span className="text-white/40">{fmt(s.seconds)}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title="Sentiment">
        <div className="flex gap-3 text-sm text-white/70">
          <span>Positive <b className="text-white">{sentiment.POSITIVE || 0}</b></span>
          <span>Neutral <b className="text-white">{sentiment.NEUTRAL || 0}</b></span>
          <span>Negative <b className="text-white">{sentiment.NEGATIVE || 0}</b></span>
        </div>
      </Block>

      {topics.length > 0 && (
        <Block title="Topics">
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <span key={t.label} className="text-xs px-2 py-1 rounded-md bg-white/[0.06] text-white/70">
                {t.label.split('>').pop()}
              </span>
            ))}
          </div>
        </Block>
      )}

      {highlights.length > 0 && (
        <Block title="Key phrases">
          <div className="flex flex-wrap gap-1.5">
            {highlights.map((h) => (
              <span key={h.text} className="text-xs px-2 py-1 rounded-md bg-[#FF9A4D]/10 text-[#FF9A4D] border border-[#FF9A4D]/25">
                {h.text}
              </span>
            ))}
          </div>
        </Block>
      )}
    </div>
  );
}