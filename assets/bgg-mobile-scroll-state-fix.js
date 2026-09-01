/* Mobile navigation + unlock scroll-state QA fix — 2026-09-01 */
(() => {
  'use strict';
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
  const reset = () => {
    if (!isMobile()) return;
    const doReset = () => {
      window.scrollTo({left:0, top:0, behavior:'instant'});
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.scrollingElement && (document.scrollingElement.scrollTop = 0);
      const scroller = document.querySelector('.modernScroll');
      if (scroller) scroller.scrollTop = 0;
    };
    doReset();
    requestAnimationFrame(doReset);
  };
  const resetBurst = () => [0,16,80,180,350,700].forEach(ms => setTimeout(reset, ms));

  document.addEventListener('click', (event) => {
    if (!isMobile()) return;
    if (event.target.closest('.tabs [data-tab]') || event.target.closest('#mobileDetailClose')) {
      resetBurst();
      return;
    }
    /* The recording showed the real failure occurs after Unlock Dashboard: Safari
       retains the gate/form scroll offset while the much taller dashboard is revealed. */
    if (event.target.closest('#unlock') || event.target.closest('#promptUnlock')) {
      resetBurst();
    }
  }, true);

  /* Observe the actual gate -> dashboard visibility transition too, so this works
     whether unlock came from the button, Enter key, prompt, or restored credentials. */
  const dashboard = document.getElementById('dashboardApp');
  if (dashboard) {
    new MutationObserver(() => {
      if (isMobile() && !dashboard.classList.contains('hidden')) resetBurst();
    }).observe(dashboard, {attributes:true, attributeFilter:['class']});
  }

  window.addEventListener('pageshow', () => { if (isMobile()) resetBurst(); });
  window.addEventListener('load', () => { if (isMobile()) resetBurst(); });
})();
