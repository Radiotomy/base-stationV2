import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// React Router keeps the window's scroll position across route changes, so
// navigating from halfway down one page lands you halfway down the next one.
// Reset to the top on every forward navigation. Two deliberate exceptions:
//  - a hash in the URL means the page is targeting an anchor, so leave it alone
//  - POP (browser back/forward) keeps the position the user is returning to
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (hash) return;
    if (navigationType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return null;
}