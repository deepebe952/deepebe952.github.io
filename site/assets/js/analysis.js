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

  const rej = MODELS.reduce((a, m) => a + D.summary.status_totals[m].rejected, 0);
  $("#rej-big").replaceChildren(`${rej} rejections`, h("small", { text: `The integrity review blocked ${rej} of ${D.summary.n_submissions.toLocaleString("en-US")} submissions in this cohort before benchmarking, returning the violated rule instead of a score.` }));
})();
