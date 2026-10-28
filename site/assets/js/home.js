/* Homepage citation, scoring notes, and links from previous layouts. */
(() => {
  "use strict";
  const citation = document.getElementById("cite");
  const legacy = {
    architecture: "framework.html#overview", framework: "framework.html#overview",
    protocol: "framework.html#protocol", execution: "framework.html#execution",
    "task-definition": "framework.html#definition", "task-execution": "framework.html#execution"
  };
  function followHomeHash() {
    const hash = location.hash.slice(1);
    const target = legacy[hash];
    if (target) {
      const url = new URL(target, location.href);
      url.search = location.search;
      location.replace(url.href);
      return;
    }
    if (hash === "cite") citation.open = true;
    if (hash === "score-notes") document.getElementById("score-notes").open = true;
    const alias = { introduction: "overview", findings: "leaderboard", "figure-2": "leaderboard", "figure-3": "results" }[hash];
    if (alias) {
      history.replaceState(null, "", `${location.pathname}${location.search}#${alias}`);
      document.getElementById(alias).scrollIntoView();
    }
  }
  followHomeHash();
  window.addEventListener("hashchange", followHomeHash);
  document.querySelectorAll('a[href="index.html#cite"], a[href="#cite"]').forEach((link) => {
    link.addEventListener("click", () => { citation.open = true; });
  });
})();
