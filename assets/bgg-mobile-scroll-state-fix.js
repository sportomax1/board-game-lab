/* Mobile navigation scroll-state QA fix — 2026-09-01
   The app's tabs share the document scroller. If a user opens a fixed contact detail
   while the underlying page is deeply scrolled, then changes tabs, Safari preserves
   that old document offset and shows a large blank area. Reset only on mobile tab
   navigation / detail close; desktop scroll behavior remains untouched. */
(() => {
  'use strict';
  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
  const reset = () => {
    if (!isMobile()) return;
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      const scroller = document.querySelector('.modernScroll');
      if (scroller) scroller.scrollTop = 0;
    });
  };

  document.addEventListener('click', (event) => {
    if (!isMobile()) return;
    if (event.target.closest('.tabs [data-tab]')) {
      // Run after the legacy tab handler has hidden/shown sections.
      setTimeout(reset, 0);
      setTimeout(reset, 80);
      return;
    }
    if (event.target.closest('#mobileDetailClose')) {
      setTimeout(reset, 0);
    }
  }, true);

  // iOS can restore an obsolete scroll offset after history/page restoration.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && isMobile()) reset();
  });
})();
