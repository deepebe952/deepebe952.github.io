/* Agent Behavior: original paper Figures 9–12 and Section 5 navigation. */
(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const oldLinks = { trajectories: "experimental-results.html#results", ranking: "experimental-results.html#leaderboard", stability: "experimental-results.html#leaderboard", efficiency: "experimental-results.html#leaderboard", behavior: "#improvement" };
  function redirectMovedSection() {
    const target = oldLinks[location.hash.slice(1)];
    if (!target) return false;
    const url = new URL(target, location.href);
    url.search = location.search;
    const leavesPage = url.pathname !== location.pathname;
    location.replace(url.href);
    return leavesPage;
  }
  if (redirectMovedSection()) return;

  const dialog = $("#figure-dialog"), dialogImage = $("#figure-dialog-image");
  document.querySelectorAll("[data-expand-figure]").forEach((button) => button.addEventListener("click", () => {
    const figure = button.closest("figure"), img = figure.querySelector("img");
    $("#figure-dialog-title").textContent = `${figure.querySelector(".label").textContent} · ${figure.querySelector("h3").textContent}`;
    dialogImage.src = img.src;
    dialogImage.alt = img.alt;
    dialog.showModal();
  }));
  $("#figure-dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

  function markSection() {
    const hash = location.hash.slice(1);
    const sections = ["requirements", "validation", "improvement", "overall-answer"];
    const figure = document.getElementById(hash)?.closest("section");
    const active = sections.includes(hash) ? hash : figure?.id || "requirements";
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
