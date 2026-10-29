/* Experimental Results: paper Section 4, Figures 2–8. */
(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);

  // Interactive results and legacy overview links belong to the homepage.
  function redirectMovedSection() {
    const hash = location.hash.slice(1);
    const moved = { "score-notes": "score-notes", map: "map", cite: "overview" };
    const anchor = moved[hash] || (/^results-/.test(hash) ? "results" : null);
    if (!anchor) return false;
    const url = new URL(`index.html#${anchor}`, location.href);
    url.search = location.search;
    location.replace(url.href);
    return true;
  }
  if (redirectMovedSection()) return;

  /* ---------------- expanded original figures ---------------- */
  const dialog = $("#figure-dialog"), dialogImage = $("#figure-dialog-image");
  if (dialog && dialogImage) {
    document.querySelectorAll("[data-expand-figure]").forEach((button) => button.addEventListener("click", () => {
      const figure = button.closest("figure"), img = figure.querySelector("img");
      $("#figure-dialog-title").textContent = figure.querySelector("h3").textContent;
      dialogImage.src = img.src; dialogImage.alt = img.alt;
      dialog.showModal();
    }));
    $("#figure-dialog-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  }

  window.InfrathonSectionTabs(redirectMovedSection);
})();
