/* Paper overview navigation and links from previous homepage layouts. */
(() => {
  "use strict";
  const citation = document.getElementById("cite");
  const sectionLinks = document.querySelectorAll('.subnav[aria-label="Homepage sections"] a');
  const legacy = {
    architecture: "framework.html#overview", framework: "framework.html#overview",
    protocol: "framework.html#protocol", execution: "framework.html#execution",
    map: "framework.html#task-inventory", leaderboard: "experimental-results.html#leaderboard",
    "score-notes": "experimental-results.html#score-notes"
  };
  function followHomeHash() {
    const hash = location.hash.slice(1);
    const target = legacy[hash] || (/^results(?:-|$)/.test(hash) ? "experimental-results.html#results" : null);
    if (target) {
      const url = new URL(target, location.href);
      url.search = location.search;
      location.replace(url.href);
      return;
    }
    if (hash === "cite") citation.open = true;
    sectionLinks.forEach((link) => {
      if (link.getAttribute("href") === "#" + (hash || "overview")) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  followHomeHash();
  window.addEventListener("hashchange", followHomeHash);
  document.querySelectorAll('a[href="index.html#cite"], a[href="#cite"]').forEach((link) => {
    link.addEventListener("click", () => { citation.open = true; });
  });
})();
