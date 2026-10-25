/* Analysis page: categories, stability, trajectories, efficiency. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODELS, MODEL, COLOR, C, TASK, STAGES, LEVELS, s, st, h, $, cap, fmt, pct, ordinal, unitOf } = X;
  const R = D.ranking;

  /* ---------- stage x level ---------- */
  (function renderCats() {
    const grid = $("#cat-grid");
    for (const stg of STAGES) for (const lv of LEVELS) {
      const ts = X.filterTasks(D.tasks, stg, lv);
      const rs = X.rankScores(ts);
      const card = h("div", { class: "card cat" }, h("div", { class: "h" }, h("b", { text: `${cap(stg)} · ${cap(lv)}` }), h("span", { text: `${ts.length} task${ts.length > 1 ? "s" : ""}` })));
      const rowH = 24, W = 330, L = 70, Rx = 284;
      const svg = s("svg", { viewBox: `0 0 ${W} ${MODELS.length * rowH + 22}`, role: "img", "aria-label": `${cap(stg)} ${lv}-level rank scores: ` + MODELS.map((m) => `${MODEL[m].short} ${rs[m] == null ? "not ranked" : fmt(rs[m], 1)}`).join(", ") });
      const xs = (v) => L + (v / 100) * (Rx - L);
      for (const g of [0, 50, 100]) {
        s("line", { x1: xs(g), x2: xs(g), y1: 4, y2: MODELS.length * rowH + 2, stroke: g === 0 ? C.hair2 : C.hair, "stroke-width": 1 }, svg);
        st(svg, xs(g), MODELS.length * rowH + 17, String(g), { fill: C.ink3, "font-size": 10.5, "text-anchor": "middle" });
      }
      MODELS.forEach((m, i) => {
        const y = 4 + i * rowH + rowH / 2, v = rs[m];
        const row = s("g", { tabindex: 0, style: "outline:none" }, svg);
        s("rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, fill: "transparent" }, row);
        st(row, 0, y + 4, MODEL[m].short, { fill: C.ink2, "font-size": 11.5 });
        if (v == null) { st(row, L + 4, y + 4, "no run here", { fill: C.ink3, "font-size": 10.5 }); return; }
        if (v > 0) s("line", { x1: xs(0), x2: xs(v), y1: y, y2: y, stroke: COLOR[m], "stroke-width": 2 }, row);
        X.marker(row, m, xs(v), y, 4.6);
        st(row, xs(v) + 9, y + 4, fmt(v, 1).replace(/\.0$/, ""), { fill: C.ink, "font-size": 11.5 });
        const show = (e) => {
          const b = row.getBoundingClientRect();
          X.showTip(e.clientX ?? b.right, e.clientY ?? b.top, `${MODEL[m].name} · ${cap(stg)} ${lv}`,
            ts.filter((t) => t.ranks[m]).map((t) => ({ color: COLOR[m], value: `${ordinal(Math.round(t.ranks[m]))} of ${Object.keys(t.ranks).length}`, label: t.name })), `rank score ${fmt(v, 1)}`);
        };
        row.addEventListener("pointermove", show); row.addEventListener("focus", show);
        row.addEventListener("pointerleave", X.hideTip); row.addEventListener("blur", X.hideTip);
      });
      card.append(svg);
      grid.append(card);
    }
  })();
  X.wireTabs("#tab-traj-live", "#tab-traj-paper", "#traj-live", "#traj-paper");

  /* ---------- stability ---------- */
  (function renderStability() {
    const B = R.bootstrap, rs = R.rank_score;
    const order = [...MODELS].sort((a, b) => rs[b] - rs[a]);
    const tbl = $("#pmat");
    tbl.append(h("thead", {}, h("tr", {}, h("th", {}, h("span", { class: "sr-only", text: "Configuration" })), [1, 2, 3, 4, 5, 6].map((i) => h("th", { scope: "col", text: ordinal(i) })))));
    const tb = h("tbody");
    for (const m of order) {
      const tr = h("tr", {}, h("th", { scope: "row" }, X.who(m, MODEL[m].short)));
      B[m].p_pos.forEach((p) => {
        const label = p >= 0.995 ? ">99%" : p >= 0.01 ? pct(p) : p > 0 ? "<1%" : "";
        tr.append(h("td", { class: p === 0 ? "zero" : p > 0.56 ? "hot" : "", style: `--a:${Math.max(0.1, p).toFixed(3)}` }, label));
      });
      tb.append(tr);
    }
    tbl.append(tb);
    const top = order[0], second = order[1], loo = R.leave_one_out, top3 = order.slice(0, 3);
    const listing = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
    const lastOn = (m) => D.tasks.filter((t) => t.ranks[m] != null && t.ranks[m] === Math.max(...Object.values(t.ranks))).map((t) => t.name);
    const winners = order.filter((m) => R.wins[m] > 0);
    const tiles = [
      [pct(B[top].p_pos[0]), "", `of resamples put ${MODEL[top].name} first; ${MODEL[second].name} leads or ties in ${pct(B[second].p_pos[0])}. 95% interval for ${MODEL[top].short}: ${fmt(B[top].lo, 1)}–${fmt(B[top].hi, 1)}.`],
      [`${loo.leader_changes.length}`, `of ${R.n}`, `single-task removals change the leader. ${loo.order_changes ? `${loo.order_changes} change the order of the six at all.` : "None changes the order of the six at all."}`],
      [`${R.wins[top]}`, `of ${R.n}`, `tasks are topped by ${MODEL[top].name}. ${listing(winners.slice(1).map((m) => `${MODEL[m].short} tops ${R.wins[m]}`))}; ${listing(order.filter((m) => !R.wins[m]).map((m) => MODEL[m].short))} top none.`],
      [`${top3.filter((m) => lastOn(m).length).length}`, "of 3", `top-three configurations finish last on at least one task: ${top3.map((m) => `${MODEL[m].short} on ${listing(lastOn(m)) || "none"}`).join("; ")}.`],
    ];
    const box = $("#stab-tiles");
    for (const [v, small, text] of tiles) box.append(h("div", {}, h("b", {}, v, small ? h("small", { text: small }) : null), h("p", { text })));
  })();

  /* ---------- trajectories ---------- */
  (function renderMultiples() {
    X.makeLegend($("#traj-legend"));
    const box = $("#multiples");
    for (const stg of STAGES) for (const lv of LEVELS) {
      box.append(h("div", { class: "grp-label", text: `${cap(stg)} · ${cap(lv)} · ${lv === "operator" ? 12 : 24} h` }));
      for (const t of D.tasks.filter((x) => x.stage === stg && x.level === lv)) {
        box.append(h("a", { class: "card mult", href: X.taskHref(t.key) }, h("div", { class: "h" }, h("b", { text: t.name }), h("span", { text: unitOf(t) || "score" })), X.trajChart(t, { W: 300, H: 165 })));
      }
    }
    const featured = $("#featured-trajectories");
    const groups = [
      ["training", ["attn-qat", "orpo", "opcd", "flux-moe", "gkd", "alfworld"]],
      ["inference", ["sageattention", "kvzip", "eagle3", "flash-kmeans", "qvg", "llada"]],
    ];
    let letter = 0;
    for (const [stage, keys] of groups) {
      featured.append(h("div", { class: "grp-label", text: `${cap(stage)} · operators / modules / systems` }));
      for (const key of keys) {
        const t = TASK[key];
        featured.append(h("a", { class: "card mult", href: X.taskHref(key) },
          h("div", { class: "featured-meta" }, h("span", { text: `${String.fromCharCode(97 + letter++)} · ${cap(t.level)}` }), h("span", { text: `${t.budget_h} h budget` })),
          h("div", { class: "h" }, h("b", { text: t.name })),
          h("div", { class: "chart-unit", text: `${unitOf(t) || "score"} ↑${key === "flash-kmeans" ? " · log scale" : ""}` }),
          X.trajChart(t, { W: 340, H: 190, logY: key === "flash-kmeans" })));
      }
    }
  })();

  /* Figure 5: raw elapsed times, and digitized paper token/action distributions. */
  (function renderFirstScore() {
    const box = $("#first-score-chart"), paper = D.tokens.first_score_distributions.metrics;
    const specs = {
      elapsed: { label: "Elapsed time", unit: "Hours to first valid score", ticks: [.01, .1, 1, 10], format: (v) => `${fmt(v, 2)} h`, description: "Selected run histories · hover or focus a dot for its task; open it to inspect the run." },
      tokens: { label: "Visible output", unit: "Visible output tokens (thousands)", ticks: [1, 10, 100], format: (v) => `≈${fmt(v, 1)}k`, description: "Before the first matched scored feedback · approximate values reconstructed from paper Figure 5." },
      actions: { label: "Agent actions", unit: "Text blocks + tool invocations", ticks: [10, 100, 1000], format: (v) => `≈${fmt(v, 0)}`, description: "Before the first matched scored feedback · approximate values reconstructed from paper Figure 5." },
    };
    const quantile = (xs, q) => { const p = (xs.length - 1) * q, lo = Math.floor(p); return xs[lo] + (xs[Math.ceil(p)] - xs[lo]) * (p - lo); };
    const elapsed = Object.fromEntries(MODELS.map((m) => {
      const points = D.tasks.filter((t) => t.results[m]?.first_valid_h != null).map((t) => ({ value: t.results[m].first_valid_h, task: t })).sort((a, b) => a.value - b.value);
      const values = points.map((p) => p.value);
      return [m, { points, q1: quantile(values, .25), median: quantile(values, .5), q3: quantile(values, .75) }];
    }));
    let metric = "elapsed", lastWidth = 0;
    const bindTip = (el, title, rows, note) => {
      const show = (e) => { const b = el.getBoundingClientRect(); X.showTip(e.clientX ?? b.right, e.clientY ?? b.top, title, rows, note); };
      el.addEventListener("pointermove", show); el.addEventListener("focus", show);
      el.addEventListener("pointerleave", X.hideTip); el.addEventListener("blur", X.hideTip);
      el.addEventListener("keydown", (e) => { if (e.key === "Escape") X.hideTip(); });
    };
    function draw() {
      X.hideTip();
      const spec = specs[metric], raw = metric === "elapsed";
      const rows = raw ? elapsed : Object.fromEntries(MODELS.map((m) => [m, { ...paper[metric][m], points: paper[metric][m].points.map((value) => ({ value })) }]));
      const W = Math.max(280, Math.round(box.getBoundingClientRect().width)), H = 356, L = 82, R = W - 64, top = 30, rowH = 46;
      lastWidth = W;
      const all = MODELS.flatMap((m) => rows[m].points.map((p) => p.value));
      const lo = Math.min(...all) / 1.3, hi = Math.max(...all) * 1.3;
      const xs = (v) => L + Math.log(v / lo) / Math.log(hi / lo) * (R - L);
      const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": `${spec.label} before first score, by configuration. Dots are runs, markers are medians, bars are interquartile ranges.` });
      st(svg, W - 2, 15, "Median", { fill: C.ink3, "font-size": 10, "text-anchor": "end" });
      for (const v of spec.ticks.filter((v) => v >= lo && v <= hi)) {
        s("line", { x1: xs(v), x2: xs(v), y1: top - 6, y2: top + rowH * 6, stroke: C.hair }, svg);
        st(svg, xs(v), H - 26, String(v), { fill: C.ink3, "font-size": 11, "text-anchor": "middle" });
      }
      MODELS.forEach((m, i) => {
        const row = rows[m], y = top + rowH * i + rowH / 2;
        st(svg, 0, y - 2, MODEL[m].short, { fill: C.ink2, "font-size": 12 });
        st(svg, 0, y + 13, `${row.points.length} runs`, { fill: C.ink3, "font-size": 9.5 });
        s("line", { x1: L, x2: R, y1: y, y2: y, stroke: C.hair }, svg);
        s("line", { x1: xs(row.q1), x2: xs(row.q3), y1: y, y2: y, stroke: COLOR[m], "stroke-width": 5, "stroke-opacity": .24, "stroke-linecap": "round" }, svg);
        for (const q of [row.q1, row.q3]) s("line", { x1: xs(q), x2: xs(q), y1: y - 5, y2: y + 5, stroke: COLOR[m], "stroke-opacity": .6 }, svg);
        const placed = [];
        row.points.forEach((point) => {
          const x = xs(point.value), lanes = [-12, -6, 0, 6, 12];
          const clearance = (dy) => placed.length ? Math.min(...placed.map(([px, py]) => Math.hypot(x - px, dy - py))) : Infinity;
          const dy = lanes.reduce((best, next) => clearance(next) > clearance(best) ? next : best, lanes[0]);
          placed.push([x, dy]);
          const title = raw ? `${point.task.name} · ${MODEL[m].short}` : `${MODEL[m].name} · plotted run`;
          const dot = s(raw ? "a" : "g", { ...(raw ? { href: X.runHref(point.task.key, m) } : {}), tabindex: 0, class: "distribution-point", "aria-label": `${title}: ${spec.format(point.value)}` }, svg);
          s("circle", { cx: x, cy: y + dy, r: 5, fill: COLOR[m], "fill-opacity": .65, stroke: C.panel, "stroke-width": 1 }, dot);
          bindTip(dot, title, [{ color: COLOR[m], value: spec.format(point.value), label: spec.label }], raw ? "Open the run’s submission history" : "Approximate value from Figure 5; task identity is unavailable.");
        });
        const median = s("g", { tabindex: 0, class: "distribution-median", "aria-label": `${MODEL[m].short}: median ${spec.format(row.median)}, middle 50% ${spec.format(row.q1)} to ${spec.format(row.q3)}` }, svg);
        X.marker(median, m, xs(row.median), y, 6.5);
        st(median, W - 2, y + 4, spec.format(row.median), { fill: C.ink, "font-size": 11, "text-anchor": "end" });
        bindTip(median, `${MODEL[m].name} · ${row.points.length} runs`, [
          { color: COLOR[m], value: spec.format(row.median), label: "Median" },
          { color: COLOR[m], value: `${spec.format(row.q1)} – ${spec.format(row.q3)}`, label: "Middle 50%" },
        ], raw ? "Selected run histories" : "Approximate values from paper Figure 5");
      });
      st(svg, (L + R) / 2, H - 5, `${spec.unit} · log scale`, { fill: C.ink3, "font-size": 10, "text-anchor": "middle" });
      box.replaceChildren(svg);
      $("#first-score-description").textContent = spec.description;
    }
    X.seg($("#first-score-controls"), Object.entries(specs).map(([key, spec]) => [key, spec.label]), metric, (value) => { metric = value; draw(); });
    draw();
    new ResizeObserver(() => { if (Math.max(280, Math.round(box.getBoundingClientRect().width)) !== lastWidth) draw(); }).observe(box);
  })();

  /* ---------- interaction statistics, paper Figures 5–7 ---------- */
  (function renderEfficiency() {
    const TK = D.tokens, M = TK.models;
    const order = [...MODELS].sort((a, b) => D.summary.first_valid[a].median_h - D.summary.first_valid[b].median_h);
    const charts = [
      ["Time to first valid score", "median hours · selected scored runs", (m) => D.summary.first_valid[m].median_h, (v) => `${fmt(v, 2)} h`],
      ["Visible output", "total over 25 tasks · paper Figure 7", (m) => M[m].visible_output_m, (v) => `${fmt(v, 2)}M`],
      ["Agent actions", "total text blocks and tool invocations · Figure 7", (m) => M[m].actions_k, (v) => `${fmt(v, 1)}k`],
    ];
    const box = $("#eff");
    for (const [title, sub, get, f] of charts) {
      const max = Math.max(...order.map(get)), bars = h("div", { class: "bars" });
      for (const m of order) {
        const v = get(m);
        bars.append(h("div", { class: "bar-row" }, X.who(m, MODEL[m].short), X.hbar(COLOR[m], v / max, f(v), { max: 70 })));
      }
      box.append(h("div", { class: "card" }, h("div", { class: "card-head" }, h("div", {}, h("h3", { text: title }), h("p", { text: sub }))), h("div", { class: "card-body" }, bars)));
    }
    box.append(h("div", { class: "card stat-tiles" },
      h("div", {}, h("b", {}, "131", h("small", { text: "/ 143" })), h("p", { text: "Full-budget runs with a midpoint score that improve in the second half." })),
      h("div", {}, h("b", {}, "3.21", h("small", { text: "%" })), h("p", { text: "Median second-half gain across 142 runs with a positive midpoint score." })),
      h("div", {}, h("b", {}, "36.39", h("small", { text: "M" })), h("p", { text: "Visible output tokens across all 150 selected trajectories." })),
      h("div", {}, h("b", { text: "203,266" }), h("p", { text: "Agent actions over the complete task suite. Paper Figures 6–7." }))));
    const tbl = $("#eff-table");
    tbl.append(h("thead", {}, h("tr", {}, ["Configuration", "Median hours to first score", "Scored runs", "Visible output · 25 tasks", "Actions · 25 tasks"].map((x, i) => h("th", { scope: "col", class: i ? "n" : null, text: x })))));
    const tb = h("tbody");
    for (const m of order) tb.append(h("tr", {}, h("td", {}, X.who(m)),
      h("td", { class: "n", text: fmt(D.summary.first_valid[m].median_h, 2) }),
      h("td", { class: "n", text: `${D.summary.first_valid[m].n} / 25` }),
      h("td", { class: "n", text: `${fmt(M[m].visible_output_m, 2)}M` }),
      h("td", { class: "n", text: `${fmt(M[m].actions_k, 1)}k` })));
    tbl.append(tb);
    const ul = h("ul");
    for (const [k, v] of Object.entries(TK.definitions)) ul.append(h("li", {}, h("b", { text: `${cap(k.replace(/_/g, " "))}: ` }), v));
    $("#eff-notes").append(h("p", { style: "margin:10px 0 0", text: `${TK.scope} ${TK.source}` }), ul);
  })();

  /* Figure 11: case-level score changes and run-level repetition categories. */
  (function renderBehavior() {
    const data = D.tokens.behavior, gainBox = $("#completion-gains");
    for (const example of data.completion) {
      const { model: m, task: key, before, after } = example, t = TASK[key];
      const gain = (after / before - 1) * 100;
      gainBox.append(h("a", { class: "gain-example", href: X.taskHref(key), style: `--case-color:${COLOR[m]}` },
        h("div", { class: "gain-heading" }, h("div", {}, h("b", { text: { sageattention: "SageAttention", gkd: "GKD", sd35: "SD3.5" }[key] }), h("span", { text: `${MODEL[m].short} · ${cap(t.level)}` })), h("strong", { text: `+${fmt(gain, 1)}%` })),
        h("div", { class: "gain-track", "aria-hidden": "true" }, h("span", { style: `width:${gain / 30 * 100}%` })),
        h("div", { class: "gain-scores" }, h("span", {}, h("small", { text: "At completion" }), h("b", { text: fmt(before, 2) })), h("span", { class: "gain-arrow", "aria-hidden": "true", text: "→" }), h("span", {}, h("small", { text: "After code changes" }), h("b", { text: `${fmt(after, 2)} ${unitOf(t) || ""}` })))));
    }
    gainBox.append(h("p", { class: "chart-note", text: "Bar length shows relative gain on a shared 0–30% scale." }));
    const repeatBox = $("#repeat-comparison");
    repeatBox.append(h("div", { class: "repeat-kpi" }, h("div", {}, h("span", { class: "label", text: "Pooled repeat share" }), h("strong", { text: `${data.pooled_pct[0]}% → ${data.pooled_pct[1]}%` })), h("span", { class: "chart-badge", text: "of submissions" })));
    const categories = ["No repeats", "Some repeats (≤50%)", "Mostly repeats (>50%)"];
    data.halves.forEach((half) => {
      const row = h("div", { class: "repeat-half" }, h("div", { class: "repeat-heading" }, h("b", { text: half.label }), h("span", { text: `${data.n_runs} runs` })));
      const bar = h("div", { class: "repeat-stack", role: "group", "aria-label": `${half.label}: repeated-content share within each run` });
      half.counts.forEach((n, i) => {
        const label = `${categories[i]}: ${n} of ${data.n_runs} runs (${pct(n / data.n_runs, 1)})`;
        const segment = h("button", { type: "button", class: `repeat-segment repeat-${i}`, style: `flex:${n}`, "aria-label": label, text: n >= 10 ? String(n) : "" });
        const show = (e) => { const b = segment.getBoundingClientRect(); X.showTip(e.clientX ?? b.left, e.clientY ?? b.top, half.label, [{ color: getComputedStyle(segment).backgroundColor, value: `${n} runs · ${pct(n / data.n_runs, 1)}`, label: categories[i] }], "Fraction of each run’s submissions that repeat earlier content"); };
        segment.addEventListener("pointermove", show); segment.addEventListener("focus", show); segment.addEventListener("click", show);
        segment.addEventListener("pointerleave", X.hideTip); segment.addEventListener("blur", X.hideTip);
        segment.addEventListener("keydown", (e) => { if (e.key === "Escape") X.hideTip(); });
        bar.append(segment);
      });
      row.append(bar, h("div", { class: "repeat-counts" }, half.counts.map((n, i) => h("span", { class: `repeat-count repeat-${i}` }, h("i", { "aria-hidden": "true" }), `${n} ${["none", "some", "mostly"][i]}`))));
      repeatBox.append(row);
    });
    repeatBox.append(h("div", { class: "repeat-legend" }, categories.map((label, i) => h("span", { class: `repeat-count repeat-${i}` }, h("i", { "aria-hidden": "true" }), label))),
      h("p", { class: "repeat-takeaway" }, h("b", { text: "2 → 18 runs" }), " have a majority of repeated submissions in the second half."));
  })();

  const rej = MODELS.reduce((a, m) => a + D.summary.status_totals[m].rejected, 0);
  $("#rej-big").replaceChildren(`${rej} rejections`, h("small", { text: `The integrity review blocked ${rej} of ${D.summary.n_submissions.toLocaleString("en-US")} submissions in this cohort before benchmarking, returning the violated rule instead of a score.` }));
})();
