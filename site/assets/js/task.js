/* Task detail page: task.html#<key>. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODELS, MODEL, COLOR, TASK, h, $, cap, fmt, withUnit, metricLabel, ordinal } = X;

  $("#task-back").addEventListener("click", () => {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    const cameFromSite = referrer?.origin === location.origin;
    const cameFromLog = /\/(?:trajectories|runs)\.html$/.test(referrer?.pathname || "");
    if (cameFromSite && !cameFromLog && history.length > 1) history.back();
    else location.assign("index.html#results");
  });

  function render() {
    const key = decodeURIComponent(location.hash.slice(1)) || D.tasks[0].key;
    const t = TASK[key] || D.tasks[0];
    document.title = `${t.name} · Infrathon`;
    $("#t-group").textContent = `${cap(t.stage)} · ${cap(t.level)}`;
    $("#t-name").textContent = t.name;
    $("#t-summary").textContent = t.summary;
    $("#t-metric").textContent = `${metricLabel(t)}, higher is better. Best valid score each configuration reached during its run.`;

    const facts = h("dl", { class: "facts" },
      h("dt", { text: "Target" }), h("dd", { text: t.target }),
      h("dt", { text: "Metric" }), h("dd", { text: `${metricLabel(t)}, higher is better` }),
      h("dt", { text: "Budget" }), h("dd", { text: `${t.budget_h} hours wall-clock, including tool runs and judge waits` }),
      h("dt", { text: "Hardware" }), h("dd", { text: t.gpus }),
      h("dt", { text: "Start" }), h("dd", { text: t.start === "seed" ? "Seed: a working baseline to improve" : "Scratch: an empty file or stub" }),
      h("dt", { text: "Category" }), h("dd", { text: `${cap(t.stage)}, ${t.level}-level` }),
      h("dt", { text: "Cohort" }), h("dd", { class: "mono", style: "font-size:12px", text: t.cohort }));
    const box = $("#t-facts");
    box.replaceChildren(facts);
    if (t.note) box.append(h("div", { class: "note-box" }, h("b", { text: "Note" }), t.note));

    const info = t.metric_info;
    const metricDetails = $("#t-metric-details");
    metricDetails.replaceChildren();
    $("#metric-calculation").hidden = !info;
    if (info) {
      metricDetails.append(
        h("p", { class: "metric-intro", text: `${info.label} · higher is better` }),
        h("div", { class: "metric-formula", text: info.formula }),
        ...info.details.map((text) => h("p", { text })));
      if (info.example) metricDetails.append(h("p", { class: "metric-example", text: info.example }));
      if (info.conditions.length) metricDetails.append(
        h("h4", { text: "Scoring conditions" }),
        h("ul", {}, info.conditions.map((text) => h("li", { text }))));
    }

    const bars = $("#t-bars");
    bars.replaceChildren();
    const max = Math.max(...MODELS.map((m) => t.results[m]?.best ?? 0), 1e-9);
    const order = [...MODELS].sort((a, b) => (t.results[b]?.best ?? -1) - (t.results[a]?.best ?? -1));
    for (const m of order) {
      const r = t.results[m], v = r?.best;
      const label = v == null ? (!r ? "no run in this cohort" : "no valid scored submission")
        : `${withUnit(t, v)}${r.flag ? `  [${r.flag}]` : ""}${t.winner === m ? "  · top" : ""}`;
      bars.append(h("div", { class: "bar-row" }, X.who(m, MODEL[m].short), X.hbar(COLOR[m], v == null ? 0 : v / max, label, { max: 62, faded: !!r?.flag, muted: v == null })));
    }

    const leg = $("#t-legend");
    leg.replaceChildren();
    X.makeLegend(leg);
    $("#t-traj").replaceChildren(X.trajChart(t, { W: 640, H: 300, compact: false, dots: true, rug: true }));
    $("#t-trace").replaceChildren(X.traceChart(t, true));

    const tbl = $("#t-table");
    tbl.replaceChildren(h("thead", {}, h("tr", {}, ["Configuration", "Effort", "Best during run", "Rank", "Best reached at", "First valid score", "Scored / failed / rejected / infra", "Run length", ""].map((x, i) => h("th", { scope: "col", class: i > 1 && i < 8 ? "n" : null, text: x })))));
    const tb = h("tbody");
    for (const m of MODELS) {
      const r = t.results[m];
      if (!r) { tb.append(h("tr", {}, h("td", {}, X.who(m)), h("td", { colspan: 8, class: "muted", text: "No run in this cohort" }))); continue; }
      const c = r.counts;
      tb.append(h("tr", {},
        h("td", {}, X.who(m), r.flag ? h("span", { class: "chip", style: "margin-left:8px", text: r.flag }) : null),
        h("td", { class: "muted", text: r.effort }),
        h("td", { class: "n", text: fmt(r.best) }),
        h("td", { class: "n", text: t.ranks[m] ? ordinal(Math.round(t.ranks[m])) : "—" }),
        h("td", { class: "n", text: r.best_at_h == null ? "—" : `${fmt(r.best_at_h, 2)} h` }),
        h("td", { class: "n", text: r.first_valid_h == null ? "none" : `${fmt(r.first_valid_h, 2)} h` }),
        h("td", { class: "n", text: `${c.valid} / ${c.invalid} / ${c.rejected} / ${c.infrastructure + c.waiting}` }),
        h("td", { class: "n", text: `${fmt(r.elapsed_h, 1)} h` }),
        h("td", {}, h("a", { class: "link", href: X.runHref(t.key, m), text: "Run log" }))));
    }
    tbl.append(tb);
    const flags = [...new Set(Object.values(t.flags))];
    $("#t-flags").textContent = flags.length ? flags.map((f) => `${f}: ${D.flag_legend[f]}`).join(" · ") : "No flagged results on this task.";

    const i = D.tasks.indexOf(t), prev = D.tasks[(i + D.tasks.length - 1) % D.tasks.length], next = D.tasks[(i + 1) % D.tasks.length];
    $("#t-pager").replaceChildren(
      h("a", { href: X.taskHref(prev.key) }, h("small", { text: "Previous task" }), prev.name),
      h("a", { class: "next", href: X.taskHref(next.key) }, h("small", { text: "Next task" }), next.name));
  }
  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
  render();
})();
