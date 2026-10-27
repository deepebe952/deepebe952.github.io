/* Homepage section links and folded citation. */
(() => {
  "use strict";
  const citation = document.getElementById("cite");
  const sectionLinks = document.querySelectorAll('.subnav[aria-label="Homepage sections"] a');
  function followHomeHash() {
    if (location.hash === "#architecture") {
      const url = new URL(location.href);
      url.hash = "framework";
      history.replaceState(history.state, "", url.href);
      document.getElementById("framework").scrollIntoView();
    }
    if (location.hash === "#cite") citation.open = true;
    const hash = location.hash || "#overview";
    const sectionHash = hash === "#score-notes" ? "#leaderboard"
      : /^#results(?:-|$)/.test(hash) ? "#results"
      : ["#protocol", "#execution"].includes(hash) ? "#framework" : hash;
    sectionLinks.forEach((link) => {
      if (link.getAttribute("href") === sectionHash) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  followHomeHash();
  window.addEventListener("hashchange", followHomeHash);
  document.querySelectorAll('a[href="index.html#cite"], a[href="#cite"]').forEach((link) => {
    link.addEventListener("click", () => { citation.open = true; });
  });
})();
