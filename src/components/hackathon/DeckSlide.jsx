export default function DeckSlide({ slide }) {
  if (slide.kind === 'hero') {
    return (
      <section className="hk-slide hk-hero">
        <img src={slide.image} alt="" />
        <h1>{slide.title}</h1>
      </section>
    );
  }
  if (slide.kind === 'overview') {
    return (
      <section className="hk-slide hk-visual flex flex-col justify-center gap-8 !p-16">
        <p className="text-sm uppercase tracking-[0.2em] text-[#e0b39f]">{slide.eyebrow}</p>
        <h2 className="text-5xl font-bold tracking-tight text-[#f8f3ed]">{slide.title}</h2>
        <div className="grid grid-cols-3 gap-5">
          {slide.items.map((c) => (
            <div key={c.num} className="rounded-xl border border-white/15 bg-white/[0.04] p-6">
              <p className="text-2xl font-bold text-[#e0b39f]">{c.num}</p>
              <p className="mt-2 text-2xl font-bold text-[#f8f3ed]">{c.short}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#f8f3ed]/70">{c.blurb}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="hk-slide hk-visual grid grid-cols-[1fr_1.05fr] gap-10 items-center">
      <div className="pl-10">
        <p className="text-sm uppercase tracking-[0.2em] text-[#e0b39f]">{slide.eyebrow}</p>
        <h2 className="mt-4 text-5xl font-bold leading-tight tracking-tight text-[#f8f3ed]">{slide.title}</h2>
        {slide.body && <p className="mt-5 text-xl leading-relaxed text-[#f8f3ed]/75">{slide.body}</p>}
        {slide.bullets && (
          <ul className="mt-6 space-y-3">
            {slide.bullets.map((b) => (
              <li key={b} className="flex gap-3 text-lg text-[#f8f3ed]/85">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e0b39f]" />{b}
              </li>
            ))}
          </ul>
        )}
      </div>
      <img src={slide.image} alt="" />
    </section>
  );
}