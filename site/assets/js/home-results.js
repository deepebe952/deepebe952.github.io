/* Homepage results: the full suite leaderboard, task map, and all 25 trajectories. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODELS, MODEL, COLOR, C, STAGES, LEVELS, s, st, h, $, fmt, withUnit, unitOf, cap } = X;

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
      tb.append(h("tr", { "data-model": r.m },
        h("td", { class: "rk", text: r.score == null ? "–" : String(pos) }),
        h("td", {}, h("div", { class: "model" }, h("span", { class: "badge" }, X.swatch(r.m, 14)), h("div", {}, h("b", { text: MODEL[r.m].name }), h("small", { text: `${X.PROVIDER[r.m]} · ${X.effortNote(r.m)}` })))),
        h("td", {}, h("div", { class: "score" }, r.score == null ? "—" : fmt(r.score, 1), h("small", { text: r.ci.lo == null ? "" : `${fmt(r.ci.lo, 1)}–${fmt(r.ci.hi, 1)}` }))),
        h("td", { class: "barcell" }, scoreBar(r.m, r.score ?? 0, r.ci)),
        h("td", { class: "n" }, `${r.wins}`, h("small", { text: `of ${r.cov}` })),
        h("td", { class: "n first-time" }, firstMedian == null ? "—" : `${fmt(firstMedian, 2)} h`, h("small", { text: `median · ${first.length} runs` })),
        h("td", { class: "n visible-tokens", title: `Agent text and tool-call tokens across ${ts.length} runs (o200k_base).` }, tokens, h("small", { text: `total · ${ts.length} runs` }))));
    });
    const scope = [state.stage !== "all" ? state.stage : null, state.level !== "all" ? `${state.level}-level` : null].filter(Boolean).join(" ");
    $("#lb-sub").textContent = `Rank score across ${ts.length} ${scope ? scope + " " : ""}task${ts.length === 1 ? "" : "s"}.`;
  }
  if ($("#lb tbody") && $("#seg-stage") && $("#seg-level") && $("#lb-sub")) { drawSegs(); render(); }

  /* ---------------- task map ---------------- */
  (function renderTaskMap() {
    const map = $("#task-map");
    if (!map) return;
    const TW = 56, TH = 40, G = 6, GAP = 16, COLS = 3;
    const span = COLS * TW + (COLS - 1) * G;
    const X0 = Object.fromEntries(LEVELS.map((level, i) => [level, 46 + i * (span + GAP)]));
    const W = X0.system + span + 34;
    const rowsOf = (stage, level) => Math.ceil(X.filterTasks(D.tasks, stage, level).length / COLS);
    const maxRows = Object.fromEntries(STAGES.map((stage) => [stage, Math.max(...LEVELS.map((level) => rowsOf(stage, level)))]));
    const blockH = (stage) => maxRows[stage] * TH + (maxRows[stage] - 1) * G;
    const Y0 = { training: 62 };
    Y0.inference = Y0.training + blockH("training") + 30;
    const H = Y0.inference + blockH("inference") + 36;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": `Task map: ${D.tasks.length} tasks grouped by training or inference and optimization level. Tile colors identify the configuration with the best score.` });
    s("rect", { x: 12, y: 12, width: W - 24, height: H - 24, rx: 12, fill: C.panel, stroke: C.hair2 }, svg);
    for (let x = 40; x <= W - 46; x += 16) {
      s("rect", { x, y: 5, width: 6, height: 4, rx: 1, fill: C.hair2 }, svg);
      s("rect", { x, y: H - 9, width: 6, height: 4, rx: 1, fill: C.hair2 }, svg);
    }
    for (let y = 36; y <= H - 42; y += 16) {
      s("rect", { x: 5, y, width: 4, height: 6, rx: 1, fill: C.hair2 }, svg);
      s("rect", { x: W - 9, y, width: 4, height: 6, rx: 1, fill: C.hair2 }, svg);
    }
    for (const level of LEVELS) st(svg, X0[level], 44, `${level.toUpperCase()} ${level === "operator" ? 12 : 24}H`, { fill: C.ink3, "font-size": 9.5, "letter-spacing": 0.8 });
    for (const stage of STAGES) {
      const y = Y0[stage] + blockH(stage) / 2;
      st(svg, 30, y, stage.toUpperCase(), { fill: C.ink3, "font-size": 9.5, "letter-spacing": 1.5, "text-anchor": "middle", transform: `rotate(-90 30 ${y})` });
    }
    s("line", { x1: 40, x2: W - 26, y1: Y0.inference - 15, y2: Y0.inference - 15, stroke: C.hair, "stroke-dasharray": "2 4" }, svg);
    for (const stage of STAGES) for (const level of LEVELS) {
      const tasks = X.filterTasks(D.tasks, stage, level);
      const offset = ((maxRows[stage] - rowsOf(stage, level)) * (TH + G)) / 2;
      s("rect", { x: X0[level] - 5, y: Y0[stage] - 5, width: span + 10, height: blockH(stage) + 10, rx: 8, fill: "none", stroke: C.hair }, svg);
      tasks.forEach((task, i) => {
        const x = X0[level] + (i % COLS) * (TW + G);
        const y = Y0[stage] + offset + Math.floor(i / COLS) * (TH + G);
        const winner = task.winner, color = COLOR[winner];
        const tile = s("a", { class: "tile", href: X.taskResultsHref(task.key), tabindex: 0, role: "link", "data-task": task.key, "aria-label": `${task.name}, ${cap(stage)} ${level}: top configuration ${MODEL[winner].name}, ${withUnit(task, task.results[winner].best)}. Open task results.` }, svg);
        s("rect", { class: "bg", x, y, width: TW, height: TH, rx: 5, fill: color, "fill-opacity": 0.2, stroke: color, "stroke-opacity": 0.55 }, tile);
        st(tile, x + 6, y + 15, task.short, { fill: C.ink, "font-size": task.short.length > 7 ? 8.4 : 9.4, "font-weight": 500 });
        X.marker(tile, winner, x + 9.5, y + 29, 3, { ring: "transparent", ringW: 0 });
        st(tile, x + 16, y + 32, MODEL[winner].short, { fill: C.ink2, "font-size": 8.6 });
        const show = (event) => {
          const bounds = tile.getBoundingClientRect();
          const order = Object.keys(task.ranks).sort((a, b) => task.ranks[a] - task.ranks[b]).slice(0, 3);
          X.showTip(event.clientX ?? bounds.right, event.clientY ?? bounds.bottom,
            `${task.name} · ${cap(stage)} ${level}`,
            order.map((model) => ({ color: COLOR[model], value: withUnit(task, task.results[model].best), label: MODEL[model].name })),
            "Best score during the run · open task details");
        };
        tile.addEventListener("pointermove", show);
        tile.addEventListener("focus", show);
        tile.addEventListener("pointerleave", X.hideTip);
        tile.addEventListener("blur", X.hideTip);
        tile.addEventListener("click", X.hideTip);
        tile.addEventListener("keydown", (event) => { if (event.key === "Escape") X.hideTip(); });
      });
    }
    map.replaceChildren(svg);
    const legend = $("#die-legend");
    if (legend) {
      legend.replaceChildren();
      const counts = {};
      D.tasks.forEach((task) => { counts[task.winner] = (counts[task.winner] || 0) + 1; });
      MODELS.filter((model) => counts[model]).sort((a, b) => counts[b] - counts[a]).forEach((model) => {
        legend.append(h("span", { class: "who" }, X.swatch(model, 10), `${MODEL[model].short} · ${counts[model]} task${counts[model] > 1 ? "s" : ""}`));
      });
    }
  })();

  /* ---------------- task rows and filters ---------------- */
  const results = $("#task-results"), legend = $("#results-legend");
  const stageControl = $("#f-stage"), levelControl = $("#f-level"), search = $("#f-q"), count = $("#task-foot");
  if (!results || !legend || !stageControl || !levelControl || !search || !count) return;

  const saved = history.state?.infrathonTasks;
  const taskFilter = {
    stage: ["all", ...STAGES].includes(saved?.stage) ? saved.stage : "all",
    level: ["all", ...LEVELS].includes(saved?.level) ? saved.level : "all",
    q: typeof saved?.q === "string" ? saved.q : ""
  };
  const highlight = MODELS.includes(saved?.highlight) ? saved.highlight : null;
  results.replaceChildren();
  legend.replaceChildren();
  X.makeLegend(legend);

  // Construct each chart once; filtering only changes row visibility, so the
  // shared chart focus listeners and selected model remain intact.
  const taskRows = D.tasks.map((task) => {
    const winner = task.winner;
    const row = h("a", { class: "card task-result-row", href: X.taskResultsHref(task.key), id: `task-result-${task.key}`, "data-task": task.key, "data-stage": task.stage, "data-level": task.level },
      h("div", { class: "task-result-info" }, h("h3", { text: task.name }), h("p", { class: "target", text: task.target })),
      h("div", { class: "task-result-category" }, h("span", { class: "label", text: "Category" }), h("span", { text: `${cap(task.stage)} · ${cap(task.level)}` })),
      h("div", { class: "task-result-budget" }, h("span", { class: "label", text: "Budget" }), h("b", { text: `${task.budget_h} h` })),
      h("div", { class: "task-result-metric" }, h("span", { class: "label", text: "Metric" }), h("span", { class: "metric-name", text: task.metric_info?.home_label || X.metricLabel(task) })),
      h("div", { class: "task-result-winner" }, h("span", { class: "label", text: "Top configuration" }), X.who(winner, MODEL[winner].short), h("span", { class: "task-result-score", text: withUnit(task, task.results[winner].best) })),
      h("div", { class: "task-result-chart" }, X.trajChart(task, { W: 300, H: 160, logY: task.key === "flash-kmeans" })));
    results.append(row);
    return { task, row };
  });
  const empty = h("p", { class: "task-results-empty muted", role: "status", text: "No task matches these filters." });
  results.append(empty);
  if (highlight) X.setFocus(highlight);

  function saveTaskState() {
    const active = legend.querySelector('button[aria-pressed="true"]');
    history.replaceState({ ...history.state, infrathonTasks: { ...taskFilter, highlight: active?.dataset.m || null } }, "");
  }
  function renderTaskRows() {
    const query = taskFilter.q.trim().toLowerCase();
    let visible = 0;
    for (const { task, row } of taskRows) {
      const matches = (taskFilter.stage === "all" || task.stage === taskFilter.stage)
        && (taskFilter.level === "all" || task.level === taskFilter.level)
        && (!query || `${task.name} ${task.target} ${task.summary}`.toLowerCase().includes(query));
      row.hidden = !matches;
      if (matches) visible++;
    }
    empty.hidden = visible > 0;
    count.textContent = `${visible} of ${D.tasks.length} tasks.`;
    X.hideTip();
    saveTaskState();
  }
  X.seg(stageControl, [["all", "All"], ...STAGES.map((stage) => [stage, cap(stage), D.tasks.filter((task) => task.stage === stage).length])], taskFilter.stage, (stage) => { taskFilter.stage = stage; renderTaskRows(); });
  X.seg(levelControl, [["all", "All"], ...LEVELS.map((level) => [level, cap(level), D.tasks.filter((task) => task.level === level).length])], taskFilter.level, (level) => { taskFilter.level = level; renderTaskRows(); });
  search.value = taskFilter.q;
  search.addEventListener("input", () => { taskFilter.q = search.value; renderTaskRows(); });
  legend.addEventListener("click", saveTaskState);
  renderTaskRows();
})();
