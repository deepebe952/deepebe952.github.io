/* Preserve old URLs and their section links as the site structure evolves. */
(() => {
  "use strict";
  const script = document.currentScript;
  const maps = {
    architecture: {
      ranking: "experimental-results.html#score-notes", tokens: "experimental-results.html#score-notes",
      configs: "experimental-results.html#leaderboard", cite: "index.html#cite", architecture: "framework.html#overview"
    },
    results: { cite: "index.html#cite" }
  };
  const mapped = maps[script.dataset.redirectGroup]?.[location.hash.slice(1)];
  const url = new URL(mapped || script.dataset.target, location.href);
  url.search = location.search;
  if (!mapped && location.hash) url.hash = location.hash;
  location.replace(url.href);
})();
