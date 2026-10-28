/* Experimental Results: paper Section 4, Figures 2–8. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODELS, MODEL, COLOR, C, STAGES, LEVELS, s, st, h, $, fmt, withUnit, unitOf, cap } = X;

  // Scoring details stay with the results; citation belongs to the homepage.
  if (document.body.dataset.page !== "index" && location.hash === "#cite") {
    const url = new URL("index.html#cite", location.href);
    url.search = location.search;
    location.replace(url.href);
    return;
  }
  function openLinkedNotes() {
    if (location.hash === "#score-notes" && $("#score-notes")) $("#score-notes").open = true;
  }
  openLinkedNotes();
  window.addEventListener("hashchange", openLinkedNotes);

  /* ---------------- leaderboard ---------------- */
  const state = { stage: "all", level: "all" };
  const TK = D.tokens.models;
  function drawSegs() {
    X.seg($("#seg-stage"), [["all", "All", X.filterTasks(D.tasks, "all", state.level).length], ...STAGES.map((g) => [g, cap(g), X.filterTasks(D.tasks, g, state.level).length])], state.stage, (v) => { state.stage = v; drawSegs(); render(); });
    X.seg($("#seg-level"), [["all", "All"], ...LEVELS.map((l) => [l, cap(l), X.filterTasks(D.tasks, state.stage, l).length])], state.level, (v) => { state.level = v; drawSegs(); render(); });
  }
  function scoreBar(m, v, ci) {
    const svg = s("svg", { "aria-hidden": "true" });
    for (const g of [0, 25, 50, 75, 100]) s("line", { x1: `${g}%`, x2: `${g}%`, y1: 3, y2: 25, stroke: g === 0 ? C.hair2 : C.hair, "stroke-width": 1 }, svg);
    if (v > 0) {
      s("rect", { x: 0, y: 9, width: `${v}%`, height: 10, rx: 5, fill: COLOR[m] }, svg);
      s("rect", { x: 0, y: 9, width: `${Math.min(v, 3)}%`, height: 10, fill: COLOR[m] }, svg);
    }
    if (ci && ci.lo != null) {
      s("line", { x1: `${ci.lo}%`, x2: `${ci.hi}%`, y1: 14, y2: 14, stroke: C.ink, "stroke-width": 1.5 }, svg);
      for (const x of [ci.lo, ci.hi]) s("line", { x1: `${x}%`, x2: `${x}%`, y1: 9, y2: 19, stroke: C.ink, "stroke-width": 1.5 }, svg);
    }
    return svg;
  }
  function render() {
    const ts = X.filterTasks(D.tasks, state.stage, state.level);
    const rows = X.standings(ts);
    const tb = $("#lb tbody");
    tb.replaceChildren();
    rows.forEach((r) => {
      const pos = 1 + rows.filter((o) => (o.score ?? -1) > (r.score ?? -1)).length;
      const fullSuite = ts.length === D.tasks.length;
      const first = ts.map((t) => t.results[r.m]?.first_valid_h).filter((v) => v != null).sort((a, b) => a - b);
      const mid = (first.length - 1) / 2;
      const firstMedian = first.length ? (first[Math.floor(mid)] + first[Math.ceil(mid)]) / 2 : null;
      const tokenK = ts.reduce((sum, t) => sum + D.tokens.per_task[t.key][r.m].visible_output_k, 0);
      const tokens = fullSuite ? `${fmt(TK[r.m].visible_output_m, 2)}M` : tokenK >= 1000 ? `≈${fmt(tokenK / 1000, 2)}M` : `≈${fmt(tokenK, 0)}k`;
      tb.append(h("tr", {},
        h("td", { class: "rk", text: r.score == null ? "–" : String(pos) }),
        h("td", {}, h("div", { class: "model" }, h("span", { class: "badge" }, X.swatch(r.m, 14)), h("div", {}, h("b", { text: MODEL[r.m].name }), h("small", { text: `${X.PROVIDER[r.m]} · ${X.effortNote(r.m)}` })))),
        h("td", {}, h("div", { class: "score" }, r.score == null ? "—" : fmt(r.score, 1), h("small", { text: r.ci.lo == null ? "" : `${fmt(r.ci.lo, 1)}–${fmt(r.ci.hi, 1)}` }))),
        h("td", { class: "barcell" }, scoreBar(r.m, r.score ?? 0, r.ci)),
        h("td", { class: "n" }, `${r.wins}`, h("small", { text: `of ${r.cov}` })),
        h("td", { class: "n mean-relative" }, r.rel == null ? "—" : `${fmt(r.rel * 100, 1)}%`),
        h("td", { class: "n first-time" }, firstMedian == null ? "—" : `${fmt(firstMedian, 2)} h`, h("small", { text: `median · ${first.length} runs` })),
        h("td", { class: "n visible-tokens" }, tokens, h("small", { text: `total · ${ts.length} task${ts.length === 1 ? "" : "s"}` }))));
    });
    const scope = [state.stage !== "all" ? state.stage : null, state.level !== "all" ? `${state.level}-level` : null].filter(Boolean).join(" ");
    $("#lb-sub").textContent = `Rank score across ${ts.length} ${scope ? scope + " " : ""}task${ts.length === 1 ? "" : "s"}.`;
  }
  if ($("#lb")) { drawSegs(); render(); }

  /* ---------------- paper Figure 3 ---------------- */
  const selected = {
    training: ["attn-qat", "orpo", "opcd", "flux-moe", "gkd", "alfworld"],
    inference: ["sageattention", "kvzip", "eagle3", "flash-kmeans", "qvg", "llada"],
  };

  // This figure ends each curve at its recorded endpoint, as the paper specifies.
  // The full task pages separately carry best-known scores through the budget.
  function paperTrajectory(task) {
    const W = 360, H = 205, L = 42, R = W - 12, T = 12, B = H - 26;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Best valid score over time: ${task.name}` });
    const values = MODELS.flatMap((m) => task.results[m]?.traj.map((p) => p[1]) || []);
    if (!values.length) return svg;
    const vmin = Math.min(...values), vmax = Math.max(...values), log = task.key === "flash-kmeans";
    const extra = (vmax - vmin) * .08 || 1;
    const ticks = log ? [20, 50, 100, 200, 500, 1000].filter((v) => v >= vmin * .85 && v <= vmax * 1.15) : X.niceTicks(Math.max(0, vmin - extra), vmax + extra, 3);
    const low = log ? vmin * .85 : ticks[0], high = log ? vmax * 1.15 : ticks.at(-1);
    const xs = (v) => L + Math.min(v, task.budget_h) / task.budget_h * (R - L);
    const ys = (v) => B - (log ? Math.log(v / low) / Math.log(high / low) : (v - low) / (high - low)) * (B - T);
    for (const value of ticks) {
      s("line", { x1: L, x2: R, y1: ys(value), y2: ys(value), stroke: C.hair }, svg);
      st(svg, L - 7, ys(value) + 3, fmt(value, high - low < 5 ? 1 : 0), { fill: C.ink3, "font-size": 10, "text-anchor": "end" });
    }
    s("line", { x1: L, x2: R, y1: B, y2: B, stroke: C.hair2 }, svg);
    for (let v = 0; v <= task.budget_h; v += task.budget_h / 3) st(svg, xs(v), B + 17, `${v}h`, { fill: C.ink3, "font-size": 10, "text-anchor": "middle" });
    for (const model of MODELS) {
      const run = task.results[model];
      if (!run?.traj.length) continue;
      const group = s("g", { "data-series": model }, svg);
      const points = run.traj.filter(([time]) => time <= task.budget_h);
      if (!points.length) continue;
      const last = points.at(-1);
      const end = Math.min(task.budget_h, Math.max(run.elapsed_h ?? task.budget_h, last[0]));
      let path = `M${xs(points[0][0])},${ys(points[0][1])}`;
      for (const [time, value] of points.slice(1)) path += `H${xs(time)}V${ys(value)}`;
      path += `H${xs(end)}`;
      s("path", { d: path, fill: "none", stroke: COLOR[model], "stroke-width": 1.7, "stroke-linejoin": "round" }, group);
      X.marker(group, model, xs(end), ys(last[1]), 3.5, { ring: C.panel });
    }
    const cursor = s("line", { x1: 0, x2: 0, y1: T, y2: B, stroke: C.ink3, visibility: "hidden" }, svg);
    s("rect", { x: L, y: T, width: R - L, height: B - T, fill: "transparent" }, svg);
    svg.addEventListener("pointermove", (event) => {
      const bounds = svg.getBoundingClientRect(), x = (event.clientX - bounds.left) / bounds.width * W;
      if (x < L || x > R) { cursor.setAttribute("visibility", "hidden"); X.hideTip(); return; }
      const time = (x - L) / (R - L) * task.budget_h;
      cursor.setAttribute("x1", x); cursor.setAttribute("x2", x); cursor.setAttribute("visibility", "visible");
      const rows = MODELS.map((m) => ({ m, value: X.bestAt(task.results[m]?.traj || [], time) }))
        .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
        .map(({ m, value }) => ({ color: COLOR[m], label: MODEL[m].name, value: value == null ? "—" : withUnit(task, value) }));
      X.showTip(event.clientX, event.clientY, `${task.name} · ${fmt(time, 1)} h`, rows, "Best valid score available by this time");
    });
    svg.addEventListener("pointerleave", () => { cursor.setAttribute("visibility", "hidden"); X.hideTip(); });
    return svg;
  }
  const results = $("#task-results"), resultLegend = $("#results-legend");
  if (results && resultLegend) {
    X.makeLegend(resultLegend);
    let panel = 0;
    for (const stage of STAGES) {
      const group = h("div", { class: "selected-task-stage", id: `results-${stage}` }, h("h4", { class: "selected-task-stage-title", text: cap(stage) }));
      const grid = h("div", { class: "selected-task-grid" });
      for (const key of selected[stage]) {
        const task = X.TASK[key];
        grid.append(h("a", { class: "card mult selected-task", href: X.taskHref(key), "data-task": key },
          h("div", { class: "selected-task-title" }, h("span", { class: "label", text: `${String.fromCharCode(97 + panel++)} · ${cap(task.level)}` }), h("h5", { text: task.name })),
          h("div", { class: "chart-unit", text: `${unitOf(task) || "score"} ↑${key === "flash-kmeans" ? " · log scale" : ""}` }), paperTrajectory(task)));
      }
      group.append(grid); results.append(group);
    }
    resultLegend.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-m]");
      if (!button) return;
      const active = button.getAttribute("aria-pressed") === "true" ? button.dataset.m : null;
      results.querySelectorAll("[data-series]").forEach((series) => series.setAttribute("opacity", !active || active === series.dataset.series ? 1 : .13));
    });
  }

  /* ---------------- expanded original figures ---------------- */
  const dialog = $("#figure-dialog"), dialogImage = $("#figure-dialog-image");
  if (dialog && dialogImage) {
    document.querySelectorAll("[data-expand-figure]").forEach((button) => button.addEventListener("click", () => {
      const figure = button.closest("figure"), img = figure.querySelector("img");
      $("#figure-dialog-title").textContent = `${figure.querySelector(".label").textContent} · ${figure.querySelector("h3").textContent}`;
      dialogImage.src = img.src; dialogImage.alt = img.alt;
      dialog.showModal();
    }));
    $("#figure-dialog-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  }

  function legacyAnchor() {
    if (location.hash === "#map") {
      const url = new URL("framework.html#task-inventory", location.href);
      url.search = location.search;
      location.replace(url.href);
      return;
    }
    if (/^#results-(training|inference)-(operator|module|system)$/.test(location.hash)) {
      history.replaceState(null, "", `${location.pathname}${location.search}#results`);
      $("#results")?.scrollIntoView();
    }
  }
  legacyAnchor();
  window.addEventListener("hashchange", legacyAnchor);

  function markSection() {
    const section = ["leaderboard", "results", "long-vs-short", "ranking-budget", "first-score", "second-half", "interactions"];
    const hash = location.hash.slice(1);
    const active = section.includes(hash) ? hash : hash.startsWith("results-") ? "results" : "leaderboard";
    document.querySelectorAll(".subnav a").forEach((link) => {
      if (link.hash === `#${active}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  markSection();
  window.addEventListener("hashchange", markSection);
})();
