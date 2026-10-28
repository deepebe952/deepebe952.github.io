/* Homepage scoring notes and links from previous layouts. */
(() => {
  "use strict";
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
    if (hash === "score-notes") document.getElementById("score-notes").open = true;
    const alias = { cite: "overview", introduction: "overview", findings: "leaderboard", "figure-2": "leaderboard", "figure-3": "results" }[hash] || (/^results-/.test(hash) ? "results" : null);
    if (alias) {
      history.replaceState(history.state, "", `${location.pathname}${location.search}#${alias}`);
      document.getElementById(alias).scrollIntoView();
    }
  }
  followHomeHash();
  window.addEventListener("hashchange", followHomeHash);
})();
