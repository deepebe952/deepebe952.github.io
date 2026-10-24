/* Analysis page: categories, stability, final vs best, trajectories, efficiency. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODELS, MODEL, COLOR, C, TASK, STAGES, LEVELS, s, st, h, $, cap, fmt, pct, ordinal, unitOf } = X;
  const VIEWS = [["all", "All", 25], ["paper", "Paper subset", 17]];

  /* ---------- stage x level ---------- */
  let catView = "all";
  function renderCats() {
    const grid = $("#cat-grid");
    grid.replaceChildren();
    for (const stg of STAGES) for (const lv of LEVELS) {
      const ts = X.filterTasks(X.viewTasks(catView), stg, lv);
      const inv = D.tasks.filter((t) => t.stage === stg && t.level === lv).length;
      const rs = X.rankScores(ts, "final");
      const card = h("div", { class: "card cat" }, h("div", { class: "h" }, h("b", { text: `${cap(stg)} · ${cap(lv)}` }), h("span", { text: `${ts.length} of ${inv} task${inv > 1 ? "s" : ""}` })));
      const rowH = 24, W = 330, L = 70, R = 284;
      const svg = s("svg", { viewBox: `0 0 ${W} ${MODELS.length * rowH + 22}`, role: "img", "aria-label": `${cap(stg)} ${lv}-level rank scores: ` + MODELS.map((m) => `${MODEL[m].short} ${rs[m] == null ? "not ranked" : fmt(rs[m], 1)}`).join(", ") });
      const xs = (v) => L + (v / 100) * (R - L);
      for (const g of [0, 50, 100]) {
        s("line", { x1: xs(g), x2: xs(g), y1: 4, y2: MODELS.length * rowH + 2, stroke: g === 0 ? C.hair2 : C.hair, "stroke-width": 1 }, svg);
        st(svg, xs(g), MODELS.length * rowH + 17, String(g), { fill: C.ink3, "font-size": 10.5, "text-anchor": "middle" });
      }
      MODELS.forEach((m, i) => {
        const y = 4 + i * rowH + rowH / 2, v = rs[m];
        const row = s("g", { tabindex: 0, style: "outline:none" }, svg);
        s("rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, fill: "transparent" }, row);
        st(row, 0, y + 4, MODEL[m].short, { fill: C.ink2, "font-size": 11.5 });
        if (v == null) { st(row, L + 4, y + 4, "not ranked here", { fill: C.ink3, "font-size": 10.5 }); return; }
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
  }
  X.seg($("#cat-view"), VIEWS, catView, (v) => { catView = v; renderCats(); });
  renderCats();
  X.wireTabs("#tab-cat-live", "#tab-cat-paper", "#cat-live", "#cat-paper");
  X.wireTabs("#tab-traj-live", "#tab-traj-paper", "#traj-live", "#traj-paper");

  /* ---------- stability ---------- */
  let stabView = "all";
  function renderStability() {
    const V = D.views[stabView], B = V.bootstrap, rs = V.rank_score;
    const order = [...MODELS].sort((a, b) => rs[b] - rs[a]);
    const tbl = $("#pmat");
    tbl.replaceChildren(h("thead", {}, h("tr", {}, h("th", {}, h("span", { class: "sr-only", text: "Configuration" })), [1, 2, 3, 4, 5, 6].map((i) => h("th", { scope: "col", text: ordinal(i) })))));
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
    const top = order[0], second = order[1], loo = V.leave_one_out, top3 = order.slice(0, 3);
    const listing = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
    const lastOn = (m) => V.tasks.map((k) => TASK[k]).filter((t) => t.ranks[m] != null && t.ranks[m] === Math.max(...Object.values(t.ranks))).map((t) => t.name);
    const tiles = [
      [pct(B[top].p_pos[0]), "", `of resamples put ${MODEL[top].name} first; ${MODEL[second].name} leads or ties in ${pct(B[second].p_pos[0])}. No other configuration ever ranks first. 95% interval for ${MODEL[top].short}: ${fmt(B[top].lo, 1)}–${fmt(B[top].hi, 1)}.`],
      [`${loo.leader_changes.length}`, `of ${V.n}`, `single-task removals change the leader. ${loo.order_changes ? `${loo.order_changes} change the order at all, and only by swapping 3rd and 4th place.` : "None changes the order of the six at all."}`],
      [`${V.winner_changes.length}`, `of ${V.n}`, `tasks change winner if runs are ranked by their best in-run score instead of the final artifact (${V.winner_changes.map((w) => TASK[w.task].name).join(", ")}). Mean Kendall τ between the two orderings: ${fmt(V.mean_kendall_tau, 2)}.`],
      [`${top3.filter((m) => lastOn(m).length).length}`, "of 3", `top-three configurations finish last on at least one task: ${top3.map((m) => `${MODEL[m].short} on ${listing(lastOn(m)) || "none"}`).join("; ")}.`],
    ];
    const box = $("#stab-tiles");
    box.replaceChildren();
    for (const [v, small, text] of tiles) box.append(h("div", {}, h("b", {}, v, small ? h("small", { text: small }) : null), h("p", { text })));
  }
  X.seg($("#stab-view"), VIEWS, stabView, (v) => { stabView = v; renderStability(); });
  renderStability();

  /* ---------- final vs best ---------- */
  (function renderDrops() {
    const box = $("#drop-rows");
    for (const d of D.drops.rows) {
      const t = TASK[d.task], frac = d.best > 0 ? d.final / d.best : 0;
      const svg = s("svg", { "aria-hidden": "true" });
      s("line", { x1: 0, x2: "100%", y1: 7, y2: 7, stroke: C.hair2, "stroke-width": 1 }, svg);
      if (frac > 0) {
        s("rect", { x: 0, y: 2, width: `${frac * 100}%`, height: 10, rx: 4, fill: COLOR[d.model] }, svg);
        s("rect", { x: 0, y: 2, width: `${Math.min(frac * 100, 2)}%`, height: 10, fill: COLOR[d.model] }, svg);
      }
      s("line", { x1: "100%", x2: "100%", y1: 0, y2: 14, stroke: C.ink, "stroke-width": 2 }, svg);
      box.append(h("a", { class: "drop-row", href: X.taskHref(d.task) },
        h("span", { class: "who" }, X.swatch(d.model), h("span", { text: `${t.name} · ${MODEL[d.model].short}` })), svg,
        h("span", { class: "vals" }, `${fmt(d.best)} → ${fmt(d.final)} ${unitOf(t)}`.trim(), h("b", { style: "color:var(--ink);margin-left:10px;font-weight:500", text: d.final === 0 ? "zero" : pct(d.change) }))));
    }
    const zeros = D.drops.rows.filter((d) => d.final === 0).length;
    $("#drops-sub").textContent = `${D.drops.rows.length} of ${D.drops.n_compared} runs end with a final evaluation more than 10% below the best valid score they reached while working; ${zeros} fall to zero, usually by missing a quality gate. Bars show the final score as a share of that best (white tick = 100%). Flagged proxies, failures and pending reevaluations are left out.`;
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

  /* ---------- efficiency ---------- */
  (function renderEfficiency() {
    const TK = D.tokens, M = TK.models;
    const order = [...MODELS].sort((a, b) => M[a].hours - M[b].hours);
    const charts = [
      ["Hours to first valid score", "median wall-clock hours", (m) => M[m].hours, (v) => `${fmt(v, 2)} h`],
      ["Tool calls to first valid score", "median agent tool calls", (m) => M[m].tool_calls, (v) => fmt(v, 0)],
      ["Tokens to first valid score", "median, runs with per-request usage logs", (m) => M[m].tokens_m, (v) => `${fmt(v, 1)}M`],
      ["Tokens per run", "median over the full 12–24 h budget", (m) => M[m].tokens_per_run_m, (v) => `${fmt(v, 0)}M`],
    ];
    const box = $("#eff");
    for (const [title, sub, get, f] of charts) {
      const max = Math.max(...order.map((m) => get(m) ?? 0));
      const bars = h("div", { class: "bars" });
      for (const m of order) {
        const v = get(m), est = title === "Tokens per run" && M[m].tokens_per_run_estimated;
        const label = v == null ? "no per-request log" : `${est ? "≈" : ""}${f(v)}${est ? " est." : ""}`;
        bars.append(h("div", { class: "bar-row" }, X.who(m, MODEL[m].short), X.hbar(COLOR[m], v == null ? 0 : v / max, label, { max: 74, dashed: est, muted: v == null })));
      }
      box.append(h("div", { class: "card" }, h("div", { class: "card-head" }, h("div", {}, h("h3", { text: title }), h("p", { text: sub }))), h("div", { class: "card-body" }, bars)));
    }
    const tbl = $("#eff-table");
    tbl.append(h("thead", {}, h("tr", {}, ["Configuration", "Hours to first valid", "Tool calls", "Tokens to first valid", "Tokens per run", "First submission valid"].map((x, i) => h("th", { scope: "col", class: i ? "n" : null, text: x })))));
    const tb = h("tbody");
    for (const m of order) {
      const r = M[m];
      tb.append(h("tr", {}, h("td", {}, X.who(m)),
        h("td", { class: "n", text: fmt(r.hours, 2) }), h("td", { class: "n", text: fmt(r.tool_calls, 0) }),
        h("td", { class: "n", text: r.tokens_m == null ? "not logged" : `${fmt(r.tokens_m, 1)}M (n=${r.tokens_n})` }),
        h("td", { class: "n", text: `${r.tokens_per_run_estimated ? "≈" : ""}${fmt(r.tokens_per_run_m, 0)}M${r.tokens_per_run_estimated ? " est." : ""}` }),
        h("td", { class: "n", text: `${r.first_try_valid[0]} / ${r.first_try_valid[1]}` })));
    }
    tbl.append(tb);
    const ul = h("ul");
    for (const [k, v] of Object.entries(TK.definitions)) ul.append(h("li", {}, h("b", { text: `${cap(k.replace(/_/g, " "))}: ` }), v));
    for (const m of order) ul.append(h("li", {}, h("b", { text: `${MODEL[m].name}: ` }), TK.provenance[m]));
    ul.append(h("li", { text: `Claude spends a median ${TK.highlights.claude_tokens_between_submissions_m}M tokens between consecutive submissions. Miles tasks take longest to reach a first valid score: on ALFWorld, Qwen and DeepSeek needed about ${TK.highlights.alfworld_tool_calls_to_first_valid.qwen.toLocaleString("en-US")} and ${TK.highlights.alfworld_tool_calls_to_first_valid.deepseek.toLocaleString("en-US")} tool calls.` }));
    $("#eff-notes").append(h("p", { style: "margin:10px 0 0", text: `${TK.scope} ${TK.source}` }), ul);
  })();

  const rej = MODELS.reduce((a, m) => a + D.summary.status_totals[m].rejected, 0);
  $("#rej-big").replaceChildren(`${rej} rejections`, h("small", { text: `The integrity review blocked ${rej} of ${D.summary.n_submissions.toLocaleString("en-US")} submissions in this cohort before benchmarking, returning the violated rule instead of a score.` }));
})();
