/* Setup guide: one article per sidebar entry. */
(() => {
  "use strict";
  const panels = [...document.querySelectorAll(".doc-article > .doc-section")];
  const links = [...document.querySelectorAll("#docs-nav a[data-section]")];
  let activePanel, frame;
  function render(scroll = true) {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = ""; }
    const target = document.getElementById(id);
    const parent = target?.closest(".doc-section");
    const selected = panels.includes(parent) ? parent : panels[0];
    const activeLink = links.find(link => link.dataset.section === selected.id);
    if (activePanel && activePanel !== selected && activePanel.contains(document.activeElement)) {
      activeLink.focus({ preventScroll: true });
    }
    for (const panel of panels) panel.hidden = panel !== selected;
    for (const link of links) {
      if (link === activeLink) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    if (target?.matches("details")) target.open = true;
    activePanel = selected;
    document.title = `${activeLink.textContent} · Docs · Infrathon`;
    document.querySelector("#docs-menu").textContent = `☰ ${activeLink.textContent}`;
    cancelAnimationFrame(frame);
    if (scroll) frame = requestAnimationFrame(() => {
      (panels.includes(parent) ? target : selected).scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  document.querySelector("#docs-nav").addEventListener("click", event => {
    const link = event.target.closest("a[data-section]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.hash === location.hash) { event.preventDefault(); render(); }
  });
  window.addEventListener("hashchange", () => render());
  render(!!location.hash && performance.getEntriesByType("navigation")[0]?.type !== "back_forward");
})();
