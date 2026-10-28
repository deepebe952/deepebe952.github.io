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
      $("#figure-dialog-title").textContent = `${figure.querySelector(".label").textContent} · ${figure.querySelector("h3").textContent}`;
      dialogImage.src = img.src; dialogImage.alt = img.alt;
      dialog.showModal();
    }));
    $("#figure-dialog-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  }

  function markSection() {
    const sections = ["leaderboard", "results", "long-vs-short", "ranking-budget", "first-score", "second-half", "interactions"];
    const hash = location.hash.slice(1);
    const figureSections = { "figure-2": "leaderboard", "figure-3": "results", "figure-4": "long-vs-short", "figure-5": "ranking-budget", "figure-6": "first-score", "figure-7": "second-half", "figure-8": "interactions" };
    const active = sections.includes(hash) ? hash : figureSections[hash] || "leaderboard";
    document.querySelectorAll(".subnav a").forEach((link) => {
      if (link.hash === `#${active}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  markSection();
  window.addEventListener("hashchange", () => {
    if (!redirectMovedSection()) markSection();
  });
})();
