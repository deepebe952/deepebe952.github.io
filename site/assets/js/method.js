/* Method page: flags and configuration tables. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODELS, MODEL, h, $ } = X;

  const ft = $("#flag-table");
  ft.append(h("thead", {}, h("tr", {}, ["Flag", "Meaning", "Where"].map((x) => h("th", { scope: "col", text: x })))));
  const fb = h("tbody");
  for (const [f, text] of Object.entries(D.flag_legend)) {
    const where = D.tasks.flatMap((t) => Object.entries(t.flags).filter(([, v]) => v === f).map(([m]) => `${t.name} · ${MODEL[m].short}`));
    fb.append(h("tr", {}, h("td", {}, h("span", { class: "chip", text: f })), h("td", { text }), h("td", { class: "muted", text: where.join(", ") || "—" })));
  }
  ft.append(fb);

  const ct = $("#cfg-table");
  ct.append(h("thead", {}, h("tr", {}, ["Configuration", "Provider", "Reasoning effort", "Tasks with a run", "Tasks with a valid score", "Rank score"].map((x, i) => h("th", { scope: "col", class: i > 2 ? "n" : null, text: x })))));
  const cb = h("tbody");
  for (const m of MODELS) {
    const runs = D.tasks.filter((t) => t.results[m]).length, valid = D.tasks.filter((t) => t.results[m]?.best != null).length;
    cb.append(h("tr", {}, h("td", {}, X.who(m)), h("td", { class: "muted", text: X.PROVIDER[m] }),
      h("td", { class: "muted", text: X.xhighTasks(m).length ? `max; xhigh on ${X.xhighTasks(m).map((t) => t.name).join(", ")}` : "max" }),
      h("td", { class: "n", text: runs }), h("td", { class: "n", text: valid }),
      h("td", { class: "n", text: X.fmt(D.ranking.rank_score[m], 1) })));
  }
  ct.append(cb);
})();
