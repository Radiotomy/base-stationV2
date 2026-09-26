// Tiny SVG preview of a normalized 0–1 automation curve.
export default function CurvePreview({ values }) {
  if (!values?.length) return null;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${(1 - v) * 40}`).join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-20 rounded-xl bg-secondary/40">
      <polyline points={pts} fill="none" stroke="hsl(var(--accent))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}