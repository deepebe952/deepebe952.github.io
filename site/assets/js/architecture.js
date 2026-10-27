/* Preserve links to notes that now live beside the results. */
(() => {
  "use strict";
  const targets = { ranking: "results.html#score-notes", tokens: "results.html#score-notes", configs: "results.html#leaderboard", cite: "results.html#cite" };
  const redirect = () => {
    const target = targets[location.hash.slice(1)];
    if (target) {
      const url = new URL(target, location.href);
      url.search = location.search;
      location.replace(url.href);
    }
  };
  redirect();
  window.addEventListener("hashchange", redirect);
})();
