/* Preserve links to notes that now live beside the results. */
(() => {
  "use strict";
  const targets = { ranking: "index.html#score-notes", tokens: "index.html#score-notes", configs: "index.html#leaderboard", cite: "index.html#cite" };
  const redirect = () => {
    const target = targets[location.hash.slice(1)];
    if (target) location.replace(target);
  };
  redirect();
  window.addEventListener("hashchange", redirect);
})();
