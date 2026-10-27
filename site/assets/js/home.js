/* Home: open the folded citation when linked directly. */
(() => {
  "use strict";
  const hash = location.hash.slice(1);
  if (["leaderboard", "score-notes", "map"].includes(hash) || /^results(?:-|$)/.test(hash)) {
    const url = new URL("experimental-results.html" + location.hash, location.href);
    url.search = location.search;
    location.replace(url.href);
    return;
  }
  const citation = document.getElementById("cite");
  const openLinkedCitation = () => {
    if (location.hash === "#cite") citation.open = true;
  };
  openLinkedCitation();
  window.addEventListener("hashchange", openLinkedCitation);
  document.querySelectorAll('a[href="index.html#cite"], a[href="#cite"]').forEach((link) => {
    link.addEventListener("click", () => { citation.open = true; });
  });
})();
