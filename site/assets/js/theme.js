/* Light by default; remember an explicit choice across pages and visits. */
(() => {
  "use strict";
  const key = "infrathon-theme";
  let saved;
  try { saved = localStorage.getItem(key); } catch (_) { /* Storage may be disabled. */ }
  function setTheme(value) {
    const theme = value === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#060709" : "#fafbfd");
    const button = document.querySelector("#theme-toggle");
    if (button) {
      button.setAttribute("aria-pressed", String(theme === "dark"));
      button.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
      button.textContent = theme === "dark" ? "☀ Light" : "☾ Dark";
    }
  }
  setTheme(saved);
  window.InfrathonTheme = {
    sync: () => setTheme(document.documentElement.dataset.theme),
    toggle: () => {
      const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      setTheme(theme);
      try { localStorage.setItem(key, theme); } catch (_) { /* Keep the in-page choice. */ }
    },
  };
})();
