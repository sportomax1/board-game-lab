/* Contacts UX: entering the Contacts tab should show the list, not auto-open a record. */
(() => {
  'use strict';
  document.addEventListener('click', (event) => {
    const tab = event.target.closest('.tabs [data-tab="contacts"]');
    if (!tab) return;
    // Run after both legacy and modern tab handlers/rendering.
    requestAnimationFrame(() => {
      const pane = document.getElementById('modernContactDetail');
      if (!pane) return;
      pane.classList.remove('open');
      pane.innerHTML = '<div class="detailEmpty"><div class="detailEmptyIcon"><i class="fa-solid fa-address-card" aria-hidden="true"></i></div><h2>Select a contact</h2><p>Choose someone from the list to see contact methods, outreach details, notes and quick actions without leaving the page.</p></div>';
      document.querySelectorAll('[data-contact-id].selected').forEach(el => el.classList.remove('selected'));
    });
  }, true);
})();
