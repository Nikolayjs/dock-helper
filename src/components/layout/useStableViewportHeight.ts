import { useEffect } from 'react';

/**
 * Sets a `--stable-vh` custom property on <html> to the viewport height in px, and only lets it
 * grow back on a genuine resize (viewport width changed) or shrink further at the same width (a
 * keyboard opening). A height-only *growth* at the same width — overwhelmingly the mobile
 * browser's address bar hiding while the page scrolls — is deliberately ignored, so the value
 * never bounces around mid-scroll.
 *
 * CSS's own svh/dvh units are supposed to make this unnecessary, but their real-world behavior
 * turned out inconsistent on at least one tested tablet browser (the fixed sidebar kept resizing
 * with the address bar despite `height: calc(100svh - ...)`), so this recomputes the same
 * guarantee directly from window.innerHeight, which every browser handles the same way.
 */
export function useStableViewportHeight() {
  useEffect(() => {
    let lastWidth = window.innerWidth;
    let minHeight = window.innerHeight;

    const apply = () => {
      document.documentElement.style.setProperty('--stable-vh', `${minHeight}px`);
    };
    apply();

    const handleResize = () => {
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        minHeight = window.innerHeight;
      } else if (window.innerHeight < minHeight) {
        minHeight = window.innerHeight;
      }
      apply();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
}
