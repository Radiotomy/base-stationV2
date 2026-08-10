import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Mic, RotateCcw } from 'lucide-react';

// Outlet-based error boundary wrapping all ORVO routes.
// An unhandled error inside any ORVO page renders an ORVO-branded fallback
// without crashing the rest of BASE Station.
class OrvoErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#14100C' }}>
          <div className="merc-card rounded-2xl p-10 max-w-md text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center bg-[#FF9A4D]/15 border border-[#FF9A4D]/30">
              <Mic className="w-7 h-7 text-[#FF9A4D]" />
            </div>
            <h1 className="font-display text-xl text-white mb-2">Something went wrong in ORVO Studio</h1>
            <p className="text-sm text-white/60 mb-6">
              The rest of BASE Station is unaffected. Try reloading, or head back to the studio home.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
                className="merc-button rounded-full px-5 py-2 text-sm font-bold flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Reload
              </button>
              <Link to="/studios" className="merc-button-dark rounded-full px-5 py-2 text-sm font-bold">
                Studio Hub
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function StudioLayoutBoundary() {
  return (
    <OrvoErrorBoundary>
      <Outlet />
    </OrvoErrorBoundary>
  );
}