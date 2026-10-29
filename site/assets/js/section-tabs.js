/* One section at a time, with shareable links and browser history. */
"use strict";
window.InfrathonSectionTabs = (beforeRoute = () => false) => {
  const nav = document.querySelector(".subnav"), list = nav.querySelector(".wrap");
  const tabs = [...list.querySelectorAll("a")];
  const panels = tabs.map(tab => document.getElementById(tab.hash.slice(1)));
  const main = nav.closest("main"), header = main.querySelector(".page-head");
  main.dataset.sectionTabs = "";
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", nav.getAttribute("aria-label"));
  tabs.forEach((tab, index) => {
    tab.id = `section-tab-${panels[index].id}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panels[index].id);
    tab.removeAttribute("aria-current");
    panels[index].setAttribute("role", "tabpanel");
    panels[index].setAttribute("aria-labelledby", tab.id);
    panels[index].tabIndex = 0;
  });

  let activePanel = null, frame;
  function render({ scroll = false, top } = {}) {
    if (beforeRoute()) return;
    let hash;
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { hash = ""; }
    const target = document.getElementById(hash);
    const parent = target?.closest("section.sec");
    const panel = panels.includes(parent) ? parent : panels[0];
    const activeTab = tabs[panels.indexOf(panel)];
    if (activePanel && activePanel !== panel) {
      document.querySelector("dialog[open]")?.close();
      if (activePanel.contains(document.activeElement)) activeTab.focus({ preventScroll: true });
    }
    panels.forEach((item, index) => {
      const selected = item === panel;
      item.hidden = !selected;
      tabs[index].setAttribute("aria-selected", String(selected));
      tabs[index].tabIndex = selected ? 0 : -1;
    });
    activePanel = panel;
    // Reveal the selected tab without changing the document's scroll position.
    const bounds = list.getBoundingClientRect(), tabBounds = activeTab.getBoundingClientRect();
    if (tabBounds.left < bounds.left) list.scrollLeft += tabBounds.left - bounds.left;
    else if (tabBounds.right > bounds.right) list.scrollLeft += tabBounds.right - bounds.right;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (top !== undefined) window.scrollTo({ top, behavior: "instant" });
      else if (scroll && panels.includes(parent)) target.scrollIntoView({ block: "start", behavior: "instant" });
      else if (scroll && !hash) window.scrollTo({ top: 0, behavior: "instant" });
    });
  }

  function activate(tab) {
    const navHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-height")) || 0;
    const tabsTop = header.getBoundingClientRect().bottom + window.scrollY;
    const top = Math.min(window.scrollY, Math.max(0, tabsTop - navHeight));
    if (location.hash !== tab.hash) history.pushState(null, "", tab.href);
    render({ top });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      activate(tab);
    });
    tab.addEventListener("keydown", event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End", " "];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
        : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
        : event.key === "ArrowRight" ? (index + 1) % tabs.length : index;
      tabs[next].focus({ preventScroll: true });
      activate(tabs[next]);
    });
  });
  window.addEventListener("hashchange", () => render({ scroll: true }));
  render({ scroll: !!location.hash });
};
