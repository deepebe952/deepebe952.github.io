/* Home: leaderboard, task map, and trajectories grouped by stage and level. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODELS, MODEL, COLOR, C, STAGES, LEVELS, s, st, h, $, fmt, withUnit, unitOf, cap } = X;

  // Open the compact notes when reached through a citation or a saved link.
  function openLinkedNotes() {
    const id = location.hash.slice(1);
    if (id === "score-notes" || id === "cite") document.getElementById(id).open = true;
  }
  openLinkedNotes();
  window.addEventListener("hashchange", openLinkedNotes);
  document.querySelector('footer.site a[href="index.html#cite"]').addEventListener("click", () => { $("#cite").open = true; });

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
        h("td", { class: "n first-time" }, firstMedian == null ? "—" : `${fmt(firstMedian, 2)} h`, h("small", { text: `median · ${first.length} runs` })),
        h("td", { class: "n visible-tokens" }, tokens, h("small", { text: `total · ${ts.length} task${ts.length === 1 ? "" : "s"}` }))));
    });
    const scope = [state.stage !== "all" ? state.stage : null, state.level !== "all" ? `${state.level}-level` : null].filter(Boolean).join(" ");
    $("#lb-sub").textContent = `Rank score across ${ts.length} ${scope ? scope + " " : ""}task${ts.length === 1 ? "" : "s"}.`;
  }
  drawSegs();
  render();

  /* ---------------- task map ---------------- */
  (function renderDie() {
    const TW = 56, TH = 40, G = 6, GAP = 16;
    const COLS = { operator: 3, module: 2, system: 3 };
    const span = (lv) => COLS[lv] * TW + (COLS[lv] - 1) * G;
    const X0 = { operator: 46 };
    X0.module = X0.operator + span("operator") + GAP;
    X0.system = X0.module + span("module") + GAP;
    const W = X0.system + span("system") + 34;
    const rowsOf = (stg, lv) => Math.ceil(D.tasks.filter((t) => t.stage === stg && t.level === lv).length / COLS[lv]);
    const maxRows = Object.fromEntries(STAGES.map((stg) => [stg, Math.max(...LEVELS.map((lv) => rowsOf(stg, lv)))]));
    const blockH = (stg) => maxRows[stg] * TH + (maxRows[stg] - 1) * G;
    const Y0 = { training: 62 };
    Y0.inference = Y0.training + blockH("training") + 30;
    const H = Y0.inference + blockH("inference") + 36;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": "Task map: 25 tasks arranged by stage and optimization level, coloured by the configuration with the best score on each task." });
    const defs = s("defs", {}, svg);
    const grad = s("linearGradient", { id: "sweep-g", x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    s("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }, grad);
    s("stop", { offset: 0.5, "stop-color": "#fff", "stop-opacity": 0.07 }, grad);
    s("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 0 }, grad);
    s("clipPath", { id: "die-clip" }, defs).append(s("rect", { x: 12, y: 12, width: W - 24, height: H - 24, rx: 12 }));
    s("rect", { x: 12, y: 12, width: W - 24, height: H - 24, rx: 12, fill: C.panel, stroke: C.hair2 }, svg);
    for (let x = 40; x <= W - 46; x += 16) { s("rect", { x, y: 5, width: 6, height: 4, rx: 1, fill: C.hair2 }, svg); s("rect", { x, y: H - 9, width: 6, height: 4, rx: 1, fill: C.hair2 }, svg); }
    for (let y = 36; y <= H - 42; y += 16) { s("rect", { x: 5, y, width: 4, height: 6, rx: 1, fill: C.hair2 }, svg); s("rect", { x: W - 9, y, width: 4, height: 6, rx: 1, fill: C.hair2 }, svg); }
    for (const lv of LEVELS) st(svg, X0[lv], 44, `${lv.toUpperCase()} ${lv === "operator" ? 12 : 24}H`, { fill: C.ink3, "font-size": 9.5, "letter-spacing": 0.8 });
    for (const stg of STAGES) {
      const y = Y0[stg] + blockH(stg) / 2;
      st(svg, 30, y, stg.toUpperCase(), { fill: C.ink3, "font-size": 9.5, "letter-spacing": 1.5, "text-anchor": "middle", transform: `rotate(-90 30 ${y})` });
    }
    s("line", { x1: 40, x2: W - 26, y1: Y0.inference - 15, y2: Y0.inference - 15, stroke: C.hair, "stroke-dasharray": "2 4" }, svg);
    for (const stg of STAGES) for (const lv of LEVELS) {
      const ts = D.tasks.filter((t) => t.stage === stg && t.level === lv);
      const off = ((maxRows[stg] - rowsOf(stg, lv)) * (TH + G)) / 2;
      s("rect", { x: X0[lv] - 5, y: Y0[stg] - 5, width: span(lv) + 10, height: blockH(stg) + 10, rx: 8, fill: "none", stroke: C.hair }, svg);
      ts.forEach((t, i) => {
        const x = X0[lv] + (i % COLS[lv]) * (TW + G), y = Y0[stg] + off + Math.floor(i / COLS[lv]) * (TH + G);
        const w = t.winner, col = COLOR[w];
        const g = s("g", { class: "tile", tabindex: 0, role: "link", "aria-label": `${t.name}: top configuration ${MODEL[w].name}, ${withUnit(t, t.results[w].best)}` }, svg);
        s("rect", { class: "bg", x, y, width: TW, height: TH, rx: 5, fill: col, "fill-opacity": 0.2, stroke: col, "stroke-opacity": 0.55 }, g);
        st(g, x + 6, y + 15, t.short, { fill: C.ink, "font-size": t.short.length > 7 ? 8.4 : 9.4, "font-weight": 500 });
        X.marker(g, w, x + 9.5, y + 29, 3, { ring: "transparent", ringW: 0 });
        st(g, x + 16, y + 32, MODEL[w].short, { fill: C.ink2, "font-size": 8.6 });
        const show = (e) => {
          const b = g.getBoundingClientRect();
          const order = Object.keys(t.ranks).sort((a, c) => t.ranks[a] - t.ranks[c]).slice(0, 3);
          X.showTip(e.clientX ?? b.right, e.clientY ?? b.bottom, `${t.name} · ${cap(t.stage)} ${t.level}`, order.map((m) => ({ color: COLOR[m], value: withUnit(t, t.results[m].best), label: MODEL[m].name })), "best score during the run · click for the task page");
        };
        g.addEventListener("pointermove", show); g.addEventListener("focus", show);
        g.addEventListener("pointerleave", X.hideTip); g.addEventListener("blur", X.hideTip);
        g.addEventListener("click", () => { location.href = X.taskHref(t.key); });
        g.addEventListener("keydown", (e) => { if (e.key === "Enter") location.href = X.taskHref(t.key); });
      });
    }
    const sw = s("g", { "clip-path": "url(#die-clip)", "aria-hidden": "true" }, svg);
    s("rect", { class: "sweep", x: 0, y: 12, width: 140, height: H - 24, fill: "url(#sweep-g)" }, sw);
    $("#die").append(svg);
    const counts = {};
    D.tasks.forEach((t) => { counts[t.winner] = (counts[t.winner] || 0) + 1; });
    const leg = $("#die-legend");
    MODELS.filter((m) => counts[m]).sort((a, b) => counts[b] - counts[a]).forEach((m) => leg.append(h("span", { class: "who" }, X.swatch(m, 10), `${MODEL[m].short} · ${counts[m]} task${counts[m] > 1 ? "s" : ""}`)));

  })();

  /* ---------------- six task categories ---------------- */
  X.makeLegend($("#results-legend"));
  const results = $("#task-results");
  for (const stage of STAGES) {
    const block = h("section", { class: "results-stage", "aria-labelledby": `results-${stage}` },
      h("h3", { id: `results-${stage}`, class: "results-stage-title", text: cap(stage) }));
    const grid = h("div", { class: "results-grid" });
    for (const level of LEVELS) {
      const tasks = X.filterTasks(D.tasks, stage, level);
      const group = h("section", { class: "result-category", "data-stage": stage, "data-level": level, "aria-labelledby": `results-${stage}-${level}` },
        h("div", { class: "result-category-head" }, h("h4", { id: `results-${stage}-${level}`, text: cap(level) + "s" }), h("span", { text: `${tasks.length} tasks · ${level === "operator" ? 12 : 24} h` })));
      for (const task of tasks) {
        group.append(h("a", { class: "card mult result-task", href: X.taskHref(task.key), "data-task": task.key },
          h("h5", { text: task.name }),
          h("div", { class: "chart-unit", text: `${unitOf(task) || "score"} ↑${task.key === "flash-kmeans" ? " · log scale" : ""}` }),
          X.trajChart(task, { W: 340, H: 180, logY: task.key === "flash-kmeans" })));
      }
      grid.append(group);
    }
    block.append(grid); results.append(block);
  }
})();
