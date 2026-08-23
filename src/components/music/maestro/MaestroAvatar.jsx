// Song Maestro character art — the face of the conversational craft engine.
const MAESTRO_IMG = 'https://media.base44.com/images/public/69f37db5a0cc60c31a7afc80/047e63837_logo.png';

export default function MaestroAvatar({ size = 28, className = '' }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-flex items-center justify-center rounded-full overflow-hidden bg-amber-500/15 border border-amber-500/40 flex-shrink-0 ${className}`}
    >
      <img src={MAESTRO_IMG} alt="Song Maestro" className="w-full h-full object-contain object-top" />
    </span>
  );
}