/* Task documentation directory and compatibility for old task deep links. */
(() => {
  "use strict";
  const X = window.IX, { D, h, $, cap } = X;
  const taskKeys = new Set(D.tasks.map(task => task.key));

  function redirectTaskHash() {
    let key;
    try { key = decodeURIComponent(location.hash.slice(1)).split("/")[0]; }
    catch { return false; }
    if (!taskKeys.has(key)) return false;
    const destination = new URL(X.taskHref(key), location.href);
    destination.search = location.search;
    destination.hash = location.hash;
    location.replace(destination.href);
    return true;
  }
  if (redirectTaskHash()) return;
  window.addEventListener("hashchange", redirectTaskHash);

  for (const stage of ["training", "inference"]) {
    const container = $(`#${stage}-tasks`);
    for (const level of ["operator", "module", "system"]) {
      const headingId = `${stage}-${level}s`;
      const tasks = D.tasks.filter(task => task.stage === stage && task.level === level);
      const list = h("ul", { class: "task-directory-list", "aria-labelledby": headingId },
        ...tasks.map(task => h("li", {}, h("a", { class: "task-directory-link", href: X.taskHref(task.key) },
          h("span", { class: "task-directory-name", text: task.name }),
          h("span", { class: "task-directory-target", text: task.target }),
          h("span", { class: "task-directory-arrow", "aria-hidden": "true", text: "→" })
        )))
      );
      container.append(h("div", { class: "task-directory-group" }, h("h3", { id: headingId, text: `${cap(level)}s` }), list));
    }
  }
})();
