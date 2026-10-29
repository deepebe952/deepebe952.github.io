/* Shared documentation navigation and code examples. */
window.InfrathonDocs = (() => {
  "use strict";
  const X = window.IX, { D, h, $, cap } = X;
  const isTask = document.body.dataset.page === "task";
  const sidebar = $("#docs-nav");
  const getStarted = [["requirements", "Requirements"], ["installation", "Installation"], ["assets", "Models and data"], ["containers", "Docker images"], ["history", "Candidate history"], ["run", "Run a task"], ["outputs", "Results and logs"]];
  sidebar.append(h("div", { class: "docs-nav-heading", text: "Get started" }), h("a", { href: "docs.html", text: "Setup guide", "data-doc-home": "" }));
  sidebar.append(h("div", { class: "docs-nav-heading", text: "Tasks" }));
  for (const stage of ["training", "inference"]) for (const level of ["operator", "module", "system"]) {
    const group = h("details", { open: true, "data-task-group": "" }, h("summary", { text: `${cap(stage)} · ${cap(level)}s` }));
    for (const task of D.tasks.filter(t => t.stage === stage && t.level === level)) group.append(h("a", { href: X.taskHref(task.key), text: task.name, "data-doc-task": task.key }));
    sidebar.append(group);
  }
  const empty = h("p", { class: "docs-empty", hidden: true, text: "No matching tasks." });
  sidebar.append(empty);
  $("#docs-search").addEventListener("input", event => {
    const query = event.target.value.trim().toLowerCase();
    let matches = 0;
    sidebar.querySelectorAll("[data-task-group]").forEach(group => {
      let count = 0;
      group.querySelectorAll("a").forEach(link => { const found = link.textContent.toLowerCase().includes(query); link.hidden = !found; if (found) count++; });
      group.hidden = count === 0;
      if (query && count) group.open = true;
      matches += count;
    });
    empty.hidden = matches > 0;
  });
  $("#docs-menu").addEventListener("click", () => {
    const open = document.body.classList.toggle("docs-nav-open");
    $("#docs-menu").setAttribute("aria-expanded", String(open));
  });
  sidebar.addEventListener("click", event => {
    if (!event.target.closest("a")) return;
    document.body.classList.remove("docs-nav-open");
    $("#docs-menu").setAttribute("aria-expanded", "false");
  });
  let observer;
  function refresh(key) {
    sidebar.querySelectorAll("[data-doc-task]").forEach(link => {
      if (link.dataset.docTask === key) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (!isTask) $("[data-doc-home]").setAttribute("aria-current", "page");
    const entries = isTask ? [["overview", "Overview"], ["workspace", "Workspace"], ["resources", "Requirements"], ["run", "Run this task"], ["metric", "Evaluation"], ["results", "Results"]] : getStarted;
    const toc = $("#docs-toc-links");
    toc.replaceChildren(...entries.map(([id, title]) => h("a", { href: isTask ? `#${key}/${id}` : `#${id}`, "data-section": isTask ? `task-${id}` : id, text: title })));
    const mobileToc = $("#docs-mobile-toc");
    mobileToc?.replaceChildren(...[...toc.children].map(link => link.cloneNode(true)));
    observer?.disconnect();
    observer = new IntersectionObserver(items => {
      const visible = items.filter(item => item.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (!visible.length) return;
      document.querySelectorAll("#docs-toc-links a, #docs-mobile-toc a").forEach(link => {
        if (link.dataset.section === visible[0].target.id) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-140px 0px -50% 0px", threshold: 0 });
    entries.forEach(([id]) => { const target = document.getElementById(isTask ? `task-${id}` : id); if (target) observer.observe(target); });
    wireCopyButtons();
  }
  function wireCopyButtons() {
    document.querySelectorAll(".doc-code:not([data-copy-ready])").forEach(box => {
      box.dataset.copyReady = "true";
      const button = h("button", { class: "copy-code", type: "button", text: "Copy", "aria-label": "Copy command" });
      const status = h("span", { class: "sr-only", role: "status" });
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(box.querySelector("code").textContent);
          button.textContent = "Copied"; status.textContent = "Command copied";
          setTimeout(() => { button.textContent = "Copy"; }, 1600);
        } catch { button.textContent = "Select to copy"; status.textContent = "Select the command to copy it"; }
      });
      box.prepend(button, status);
    });
  }
  const code = text => h("div", { class: "doc-code" }, h("pre", {}, h("code", { text })));
  if (!isTask) refresh();
  return { refresh, code };
})();
