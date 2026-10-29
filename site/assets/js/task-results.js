/* Results component embedded in task.html. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODELS, MODEL, COLOR, h, $, fmt, withUnit, ordinal } = X;

  function render(t) {
    const bars = $("#t-bars");
    bars.replaceChildren();
    const max = Math.max(...MODELS.map((m) => t.results[m]?.best ?? 0), 1e-9);
    const order = [...MODELS].sort((a, b) => (t.results[b]?.best ?? -1) - (t.results[a]?.best ?? -1));
    for (const m of order) {
      const r = t.results[m], v = r?.best;
      const label = v == null ? (!r ? "no run" : "no valid score")
        : `${withUnit(t, v)}${r.flag ? `  [${r.flag}]` : ""}${t.winner === m ? "  · top" : ""}`;
      bars.append(h("div", { class: "bar-row", "aria-label": `${MODEL[m].name}: ${label}` }, X.who(m, MODEL[m].short), h("span", { class: "task-result-score", "aria-hidden": "true", text: label }), X.hbar(COLOR[m], v == null ? 0 : v / max, label, { max: 62, faded: !!r?.flag, muted: v == null })));
    }

    const leg = $("#t-legend");
    leg.replaceChildren();
    X.makeLegend(leg);
    $("#t-traj").replaceChildren(X.trajChart(t, { W: 640, H: 300, compact: false, dots: true, rug: true }));
    $("#t-trace").replaceChildren(X.traceChart(t, true));
    X.setFocus(null);

    const tbl = $("#t-table");
    tbl.replaceChildren(h("caption", { class: "sr-only", text: `Per-model results for ${t.name}` }), h("thead", {}, h("tr", {}, ["Model", "Score", "Rank", "Time to best", "Submissions", "Run log"].map((x, i) => h("th", { scope: "col", class: i > 0 && i < 5 ? "n" : null, text: x })))));
    const tb = h("tbody");
    for (const m of MODELS) {
      const r = t.results[m];
      if (!r) { tb.append(h("tr", {}, h("td", {}, X.who(m)), h("td", { colspan: 5, class: "muted", text: "No run" }))); continue; }
      tb.append(h("tr", {},
        h("td", {}, X.who(m), r.flag ? h("span", { class: "chip", style: "margin-left:8px", text: r.flag }) : null),
        h("td", { class: "n", text: fmt(r.best) }),
        h("td", { class: "n", text: t.ranks[m] ? ordinal(Math.round(t.ranks[m])) : "—" }),
        h("td", { class: "n", text: r.best_at_h == null ? "—" : `${fmt(r.best_at_h, 2)} h` }),
        h("td", { class: "n", text: r.n_sub }),
        h("td", {}, h("a", { class: "link", href: X.runHref(t.key, m), "aria-label": `${MODEL[m].name} run log for ${t.name}`, text: "Run log" }))));
    }
    tbl.append(tb);
    const flags = [...new Set(Object.values(t.flags))];
    $("#t-flags").hidden = flags.length === 0;
    $("#t-flags").open = false;
    $("#t-flag-text").textContent = flags.map(f => `${f}: ${D.flag_legend[f]}`).join(" · ");
  }

  window.InfrathonTaskResults = { render };
})();
