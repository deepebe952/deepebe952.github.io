/* Preserve old URLs and their section links as the site structure evolves. */
(() => {
  "use strict";
  const script = document.currentScript;
  const maps = {
    architecture: {
      ranking: "index.html#score-notes", tokens: "index.html#score-notes",
      configs: "index.html#leaderboard", cite: "index.html#overview", architecture: "framework.html#overview"
    },
    results: { cite: "index.html#overview", "score-notes": "index.html#score-notes", map: "index.html#map" }
  };
  const mapped = maps[script.dataset.redirectGroup]?.[location.hash.slice(1)];
  const url = new URL(mapped || script.dataset.target, location.href);
  url.search = location.search;
  if (!mapped && location.hash) url.hash = location.hash;
  location.replace(url.href);
})();
