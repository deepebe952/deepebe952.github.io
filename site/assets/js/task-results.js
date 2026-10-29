/* Individual task results: task-results.html#<key>. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODELS, MODEL, COLOR, TASK, h, $, cap, fmt, withUnit, metricLabel, ordinal } = X;
  let currentKey = null;

  $("#task-back").addEventListener("click", () => {
    let referrer;
    try { referrer = new URL(document.referrer); } catch { referrer = null; }
    const entryPaths = ["index.html", "task.html", "tasks.html", "."].map(path => new URL(path, location.href).pathname);
    if (referrer?.origin === location.origin && entryPaths.includes(referrer.pathname) && history.length > 1) history.back();
    else location.assign("index.html#results");
  });

  function render(t) {
    const guide = window.INFRATHON_DOCS.tasks[t.key];
    document.title = `${t.name} Results · Infrathon`;
    $("#t-group").textContent = `${cap(t.stage)} · ${cap(t.level)}`;
    $("#t-name").textContent = t.name;
    $("#t-summary").textContent = guide.result_intro;
    $("#t-meta").replaceChildren(h("span", { text: `${t.budget_h}-hour budget` }));
    $("#t-documentation").href = X.taskHref(t.key);
    $("#t-metric-name").textContent = `Metric · ${metricLabel(t)}`;
    $("#t-metric-summary").textContent = guide.metric_summary;
    $("#t-metric-link").href = `${X.taskHref(t.key)}/evaluation`;
    $("#t-metric").textContent = metricLabel(t);

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

    const i = D.tasks.indexOf(t), prev = D.tasks[(i + D.tasks.length - 1) % D.tasks.length], next = D.tasks[(i + 1) % D.tasks.length];
    $("#t-pager").replaceChildren(
      h("a", { href: X.taskResultsHref(prev.key) }, h("small", { text: "Previous task" }), prev.name),
      h("a", { class: "next", href: X.taskResultsHref(next.key) }, h("small", { text: "Next task" }), next.name));
  }

  // Keep the entry page in history while browsing adjacent task results.
  $("#t-pager").addEventListener("click", event => {
    const link = event.target.closest("a");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const target = new URL(link.href);
    target.search = location.search;
    location.replace(target.href);
  });

  function route() {
    let key;
    try { key = decodeURIComponent(location.hash.slice(1)).split("/")[0]; }
    catch { key = null; }
    const t = TASK[key] || D.tasks[0];
    if (currentKey !== t.key) { currentKey = t.key; render(t); }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
