/* Home: task map, leaderboard, results matrix, highlights, headline facts. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODELS, MODEL, COLOR, C, TASK, STAGES, LEVELS, s, st, h, $, fmt, withUnit, unitOf, cap, pct } = X;

  $("#stat-runs").textContent = D.summary.n_runs;
  $("#stat-subs").textContent = D.summary.n_submissions.toLocaleString("en-US");

  /* ---------------- task map ("die") ---------------- */
  (function renderDie() {
    const W = 560, TW = 56, TH = 40, G = 6, GAP = 16;
    const COLS = { operator: 3, module: 2, system: 3 };
    const span = (lv) => COLS[lv] * TW + (COLS[lv] - 1) * G;
    const X0 = { operator: 46 };
    X0.module = X0.operator + span("operator") + GAP;
    X0.system = X0.module + span("module") + GAP;
    const rowsOf = (stg, lv) => Math.ceil(D.tasks.filter((t) => t.stage === stg && t.level === lv).length / COLS[lv]);
    const maxRows = Object.fromEntries(STAGES.map((stg) => [stg, Math.max(...LEVELS.map((lv) => rowsOf(stg, lv)))]));
    const blockH = (stg) => maxRows[stg] * TH + (maxRows[stg] - 1) * G;
    const Y0 = { training: 62 };
    Y0.inference = Y0.training + blockH("training") + 30;
    const H = Y0.inference + blockH("inference") + 36;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": "Task map: 25 tasks arranged by stage and optimization level, coloured by the configuration with the best final score." });
    const defs = s("defs", {}, svg);
    const grad = s("linearGradient", { id: "sweep-g", x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    s("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }, grad);
    s("stop", { offset: 0.5, "stop-color": "#fff", "stop-opacity": 0.07 }, grad);
    s("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 0 }, grad);
    s("clipPath", { id: "die-clip" }, defs).append(s("rect", { x: 12, y: 12, width: W - 24, height: H - 24, rx: 12 }));
    s("rect", { x: 12, y: 12, width: W - 24, height: H - 24, rx: 12, fill: "#08090c", stroke: C.hair2 }, svg);
    for (let x = 40; x <= W - 40; x += 16) { s("rect", { x, y: 5, width: 6, height: 4, rx: 1, fill: "rgba(255,255,255,0.12)" }, svg); s("rect", { x, y: H - 9, width: 6, height: 4, rx: 1, fill: "rgba(255,255,255,0.12)" }, svg); }
    for (let y = 36; y <= H - 36; y += 16) { s("rect", { x: 5, y, width: 4, height: 6, rx: 1, fill: "rgba(255,255,255,0.12)" }, svg); s("rect", { x: W - 9, y, width: 4, height: 6, rx: 1, fill: "rgba(255,255,255,0.12)" }, svg); }
    for (const lv of LEVELS) st(svg, X0[lv], 44, `${lv.toUpperCase()} ${lv === "operator" ? 12 : 24}H`, { fill: C.ink3, "font-size": 9.5, "letter-spacing": 0.8 });
    for (const stg of STAGES) {
      const y = Y0[stg] + blockH(stg) / 2;
      st(svg, 30, y, stg.toUpperCase(), { fill: C.ink3, "font-size": 9.5, "letter-spacing": 1.5, "text-anchor": "middle", transform: `rotate(-90 30 ${y})` });
    }
    s("line", { x1: 40, x2: W - 26, y1: Y0.inference - 15, y2: Y0.inference - 15, stroke: C.hair, "stroke-dasharray": "2 4" }, svg);
    for (const stg of STAGES) for (const lv of LEVELS) {
      const ts = D.tasks.filter((t) => t.stage === stg && t.level === lv);
      const off = ((maxRows[stg] - rowsOf(stg, lv)) * (TH + G)) / 2;
      s("rect", { x: X0[lv] - 5, y: Y0[stg] - 5, width: span(lv) + 10, height: blockH(stg) + 10, rx: 8, fill: "none", stroke: "rgba(255,255,255,0.06)" }, svg);
      ts.forEach((t, i) => {
        const x = X0[lv] + (i % COLS[lv]) * (TW + G), y = Y0[stg] + off + Math.floor(i / COLS[lv]) * (TH + G);
        const w = t.winner, col = COLOR[w];
        const g = s("g", { class: "tile", tabindex: 0, role: "link", "aria-label": `${t.name}: best final ${MODEL[w].name}, ${withUnit(t, t.results[w].final)}` }, svg);
        s("rect", { class: "bg", x, y, width: TW, height: TH, rx: 5, fill: col, "fill-opacity": 0.2, stroke: col, "stroke-opacity": 0.55 }, g);
        st(g, x + 6, y + 15, t.short, { fill: C.ink, "font-size": t.short.length > 7 ? 8.4 : 9.4, "font-weight": 500 });
        X.marker(g, w, x + 9.5, y + 29, 3, { ring: "transparent", ringW: 0 });
        st(g, x + 16, y + 32, MODEL[w].short, { fill: C.ink2, "font-size": 8.6 });
        const show = (e) => {
          const b = g.getBoundingClientRect();
          const order = Object.keys(t.ranks).sort((a, c) => t.ranks[a] - t.ranks[c]).slice(0, 3);
          X.showTip(e.clientX ?? b.right, e.clientY ?? b.bottom, `${t.name} · ${cap(t.stage)} ${t.level}`, order.map((m) => ({ color: COLOR[m], value: withUnit(t, t.results[m].final), label: MODEL[m].name })), "click for the task page");
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
    MODELS.filter((m) => counts[m]).sort((a, b) => counts[b] - counts[a]).forEach((m) => leg.append(h("span", { class: "who" }, X.swatch(m, 10), `${MODEL[m].name} · ${counts[m]} task${counts[m] > 1 ? "s" : ""}`)));
  })();

  /* ---------------- leaderboard ---------------- */
  const state = { view: "all", stage: "all", level: "all", ep: "final" };
  const TK = D.tokens.models;
  function counts(view) { return X.viewTasks(view); }
  function drawSegs() {
    const vt = counts(state.view);
    X.seg($("#seg-view"), [["all", "All", 25], ["paper", "Paper subset", 17]], state.view, (v) => { state.view = v; drawSegs(); render(); });
    X.seg($("#seg-stage"), [["all", "All"], ["training", "Training", X.filterTasks(vt, "training", state.level).length], ["inference", "Inference", X.filterTasks(vt, "inference", state.level).length]], state.stage, (v) => { state.stage = v; drawSegs(); render(); });
    X.seg($("#seg-level"), [["all", "All"], ...LEVELS.map((l) => [l, cap(l), X.filterTasks(vt, state.stage, l).length])], state.level, (v) => { state.level = v; drawSegs(); render(); });
    X.seg($("#seg-ep"), [["final", "Final artifact"], ["best", "Best during run"]], state.ep, (v) => { state.ep = v; render(); });
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
    const ts = X.filterTasks(X.viewTasks(state.view), state.stage, state.level);
    const rows = X.standings(ts, state.ep);
    const tb = $("#lb tbody");
    tb.replaceChildren();
    rows.forEach((r) => {
      const pos = 1 + rows.filter((o) => (o.score ?? -1) > (r.score ?? -1)).length;
      const effort = D.tasks.some((t) => t.flags[r.m] === "x") ? "xhigh on 4 tasks" : "effort max";
      const tk = TK[r.m];
      tb.append(h("tr", {},
        h("td", { class: "rk", text: r.score == null ? "–" : String(pos) }),
        h("td", {}, h("div", { class: "model" }, h("span", { class: "badge" }, X.swatch(r.m, 14)), h("div", {}, h("b", { text: MODEL[r.m].name }), h("small", { text: `${X.PROVIDER[r.m]} · ${effort}` })))),
        h("td", {}, h("div", { class: "score" }, r.score == null ? "—" : fmt(r.score, 1), h("small", { text: r.ci.lo == null ? "" : `${fmt(r.ci.lo, 1)}–${fmt(r.ci.hi, 1)}` }))),
        h("td", { class: "barcell" }, scoreBar(r.m, r.score ?? 0, r.ci)),
        h("td", { class: "n" }, `${r.wins}`, h("small", { text: `of ${r.cov}${r.cov < r.n ? ` (${r.n})` : ""}` })),
        h("td", { class: "n", text: r.rel == null ? "—" : fmt(r.rel, 3) }),
        h("td", { class: "n", text: pct(r.ci.p1) }),
        h("td", { class: "n" }, `${fmt(tk.hours, 2)} h`, h("small", { text: `${tk.tool_calls} tool calls` })),
        h("td", { class: "n" }, `${tk.tokens_per_run_estimated ? "≈" : ""}${tk.tokens_per_run_m}M`, h("small", { text: tk.tokens_per_run_estimated ? "estimated" : "measured" }))));
    });
    const scope = [state.stage !== "all" ? state.stage : null, state.level !== "all" ? `${state.level}-level` : null].filter(Boolean).join(" ");
    $("#lb-sub").textContent = `Rank score over ${ts.length} ${scope ? scope + " " : ""}task${ts.length === 1 ? "" : "s"}${state.view === "paper" ? " from the paper's common subset" : ""}, by ${state.ep === "best" ? "best valid score during the run" : "independent final evaluation"}. 100 = first on every task.`;
    $("#lb-foot").textContent = state.view === "all"
      ? "Each task ranks the configurations that have a numeric final score, so a missing result is left out rather than counted as zero; Astra is ranked on 23 tasks and GLM on 24. Whiskers and P(#1): 3,000 bootstrap resamples of tasks. Time and tokens: per-model medians from the trajectory analysis (152 runs)."
      : "The paper's 17 tasks with a comparable final for all six configurations (Eq. 6, K = 6). Whiskers and P(#1): 3,000 bootstrap resamples of tasks. Time and tokens: per-model medians from the trajectory analysis (152 runs).";
  }
  drawSegs();
  render();

  /* ---------------- results matrix ---------------- */
  (function renderMatrix() {
    const tbl = $("#matrix");
    tbl.append(h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "Task" }), MODELS.map((m) => h("th", { scope: "col", class: "mcol" }, h("span", { class: "who" }, X.swatch(m, 10), MODEL[m].short))), h("th", { scope: "col", text: "Unit" }))));
    const tb = h("tbody");
    for (const stg of STAGES) for (const lv of LEVELS) {
      const ts = D.tasks.filter((t) => t.stage === stg && t.level === lv);
      tb.append(h("tr", { class: "grp" }, h("td", { colspan: MODELS.length + 2 }, `${cap(stg)} · ${cap(lv)}`, h("span", { text: `${ts.length} task${ts.length > 1 ? "s" : ""} · ${lv === "operator" ? 12 : 24} h` }))));
      for (const t of ts) {
        const max = Math.max(...Object.keys(t.ranks).map((m) => t.results[m].final));
        const tr = h("tr", { class: "row", tabindex: 0, onclick: () => { location.href = X.taskHref(t.key); }, onkeydown: (e) => { if (e.key === "Enter") location.href = X.taskHref(t.key); } },
          h("td", { class: "task" }, h("b", { text: t.name }), h("small", { text: `${t.start} · ${t.ranked ? "in paper ranking" : "not in paper ranking"}` })));
        for (const m of MODELS) {
          const r = t.results[m];
          if (!r || r.final == null) {
            const why = !r ? "no run" : r.flag === "F" ? "failed" : "no final";
            tr.append(h("td", {}, h("div", { class: "cell none", title: !r ? "No run in this cohort" : r.flag === "F" ? "Final candidate failed checks; no numeric score" : "No final evaluation" }, why)));
            continue;
          }
          const win = t.winner === m;
          const cell = h("div", { class: `cell${win ? " win" : ""}`, style: win ? `--wc:${COLOR[m]}` : null, title: `${MODEL[m].name}: ${withUnit(t, r.final)}${r.flag ? ` [${r.flag}] ${D.flag_legend[r.flag]}` : ""}` },
            h("i", { style: `width:${max > 0 ? (r.final / max) * 100 : 0}%` }), h("span", { text: fmt(r.final) }), r.flag ? h("span", { class: "flag", text: r.flag }) : null);
          tr.append(h("td", {}, cell));
        }
        tr.append(h("td", { class: "unit", text: unitOf(t) || "score" }));
        tb.append(tr);
      }
    }
    tbl.append(tb);
    const used = [...new Set(D.tasks.flatMap((t) => Object.values(t.flags)))];
    $("#matrix-foot").textContent = used.map((f) => `${f} ${D.flag_legend[f]}`).join(" · ") + ". Flagged results are shown as recorded and are outside the paper's 17-task ranking.";
  })();

  /* ---------------- highlights ---------------- */
  (function renderHighlights() {
    const items = [
      ["eagle3", "Claude climbs to 846 tok/s, 99 tok/s ahead of the next configuration; GLM stays below 250."],
      ["flash-kmeans", "Claude's best equivalent throughput rises from 107 to 209 TFLOP/s within the 12-hour run."],
      ["qvg", "Qwen's first valid score arrives at 10.2 h. Claude reaches 18.66× compression, twice the next best."],
      ["kvzip", "Sol reaches 94.39 at 5.8 h; none of its next 29 submissions beats it. Astra finishes on 97.62."],
    ];
    const box = $("#hl");
    for (const [key, text] of items) {
      const t = TASK[key];
      box.append(h("a", { class: "card hl", href: X.taskHref(key) },
        h("div", { class: "meta" }, h("span", { class: "label", text: `${cap(t.stage)} · ${t.level}` }), h("span", { class: "label", text: unitOf(t) || "score" })),
        h("h3", { text: t.name }), X.trajChart(t, { W: 300, H: 150, ring: C.bg }), h("p", { text })));
    }
  })();

  /* ---------------- headline facts ---------------- */
  (function renderFacts() {
    const all = D.views.all, tk = D.tokens.models;
    const facts = [
      [pct(all.bootstrap.claude.p_pos[0]), "", `of task resamples put Claude Opus 5.5 first across all 25 tasks. Removing any one task never changes the leader.`, "analysis.html#stability"],
      [`${D.drops.rows.length}`, `of ${D.drops.n_compared}`, "runs end with a final artifact more than 10% below the best score they reached during the run.", "analysis.html#drops"],
      ["5.8 → 28.1%", "", "share of submissions that repeat an earlier candidate, first versus second half of the budget.", "analysis.html#behavior"],
      [`${tk.astra.tool_calls} vs ${tk.qwen.tool_calls}`, "", "median tool calls before the first valid score: GPT-6 Astra versus Qwen 3.8 Flash.", "analysis.html#efficiency"],
    ];
    const box = $("#facts");
    for (const [v, small, text, href] of facts) box.append(h("a", { href }, h("b", {}, v, small ? h("small", { text: small }) : null), h("p", { text })));
  })();
})();
