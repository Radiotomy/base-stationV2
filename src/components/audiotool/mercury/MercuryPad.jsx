/** Backlit step pad — glows amber when on. */
export default function MercuryPad({ on, beat, dim, className = '', ...props }) {
  return (
    <button type="button" {...props}
      className={`rack-pad ${beat ? 'rack-pad-beat' : ''} ${on ? 'rack-pad-on' : ''} ${on && dim ? 'rack-pad-dim' : ''} ${className}`} />
  );
}