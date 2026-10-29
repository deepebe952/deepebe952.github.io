/* Framework: the paper's task inventory, backed by the shared task data. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, STAGES, LEVELS, h, $, cap } = X;
  const table = $("#framework-inventory");
  for (const stage of STAGES) {
    const tasks = D.tasks.filter((task) => task.stage === stage);
    const body = h("tbody", { "data-stage": stage });
    body.append(h("tr", { class: "inventory-stage" }, h("th", { scope: "rowgroup", colspan: 4, text: `${cap(stage)} · ${tasks.length} tasks` })));
    for (const level of LEVELS) {
      const group = tasks.filter((task) => task.level === level);
      group.forEach((task, i) => {
        body.append(h("tr", { class: `inventory-task${i === 0 ? " inventory-level-start" : ""}`, "data-task": task.key, "data-level": level },
          h("td", { class: "inventory-level", text: cap(level) }),
          h("td", {}, h("a", { class: "link", href: X.taskHref(task.key), text: task.name })),
          h("td", { class: "inventory-target", text: task.target }),
          h("td", { class: "n", text: `${task.budget_h} h` })));
      });
    }
    table.append(body);
  }
  document.querySelectorAll("[data-framework-level-count]").forEach((label) => {
    label.textContent = D.tasks.filter((task) => task.level === label.dataset.frameworkLevelCount).length;
  });
  $("#inventory-summary").textContent = `${D.tasks.length} tasks grouped by application stage and optimization level.`;

  window.InfrathonSectionTabs();
})();
