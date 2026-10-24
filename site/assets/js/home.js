/* Home: leaderboard, task map, results matrix, highlights, headline facts. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODELS, MODEL, COLOR, C, TASK, STAGES, LEVELS, s, st, h, $, fmt, withUnit, unitOf, cap, pct } = X;
  const R = D.ranking;
  const leader = [...MODELS].sort((a, b) => R.rank_score[b] - R.rank_score[a])[0];

  $("#stat-runs").textContent = D.summary.n_runs;
  $("#stat-subs").textContent = D.summary.n_submissions.toLocaleString("en-US");

  /* ---------------- hero wafer ---------------- */
  (function renderWafer() {
    const cv = $("#wafer");
    if (!cv || getComputedStyle(cv.parentElement).display === "none") return;
    const ctx = cv.getContext("2d");
    const N = 15, NOTCH = 0.13;
    let W = 0, R = 0, cx = 0, cy = 0, dies = [], lit = [], hover = null, raf = 0, visible = true;
    const rnd = (() => { let a = 20261023; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    const order = [];
    function layout() {
      const box = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      W = box.width; cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = W * 0.43; cx = W / 2; cy = W / 2;
      const step = (2 * R) / N, d = step - Math.max(2, W / 260);
      dies = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = cx - R + i * step, y = cy - R + j * step;
        const corners = [[x, y], [x + d, y], [x, y + d], [x + d, y + d]];
        if (corners.every(([px, py]) => Math.hypot(px - cx, py - cy) <= R - W * 0.012) && y + d < cy + R * Math.cos(NOTCH) - 4) dies.push({ x, y, d });
      }
      if (!order.length) { const idx = dies.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [idx[i], idx[k]] = [idx[k], idx[i]]; } order.push(...idx.slice(0, D.tasks.length)); }
      lit = D.tasks.map((t, i) => ({ t, die: dies[order[i] % dies.length], col: COLOR[t.winner], phase: rnd() * Math.PI * 2 }));
    }
    function waferPath() {
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.PI / 2 + NOTCH, Math.PI / 2 - NOTCH + Math.PI * 2);
      ctx.closePath();
    }
    function rr(x, y, w, hh, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function draw(time) {
      ctx.clearRect(0, 0, W, W);
      const glow = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.25);
      glow.addColorStop(0, "rgba(120,135,255,0.10)"); glow.addColorStop(1, "rgba(120,135,255,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, W);
      for (let a = 0; a < 360; a += 6) {
        const r0 = R + W * 0.03, r1 = r0 + (a % 30 === 0 ? W * 0.018 : W * 0.008), t = (a * Math.PI) / 180;
        ctx.strokeStyle = a % 30 === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx + r0 * Math.cos(t), cy + r0 * Math.sin(t)); ctx.lineTo(cx + r1 * Math.cos(t), cy + r1 * Math.sin(t)); ctx.stroke();
      }
      waferPath();
      const disc = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
      disc.addColorStop(0, "#14171d"); disc.addColorStop(1, "#090a0d");
      ctx.fillStyle = disc; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1; ctx.stroke();
      const rad = Math.max(1.5, W / 300);
      for (const dd of dies) { rr(dd.x, dd.y, dd.d, dd.d, rad); ctx.fillStyle = "rgba(255,255,255,0.028)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.stroke(); }
      for (const L of lit) {
        const p = time == null ? 0.5 : 0.5 + 0.5 * Math.sin(time / 1400 + L.phase), on = hover === L;
        rr(L.die.x, L.die.y, L.die.d, L.die.d, rad);
        ctx.save(); ctx.shadowColor = L.col; ctx.shadowBlur = on ? 22 : 8 + 8 * p;
        ctx.globalAlpha = on ? 0.9 : 0.32 + 0.22 * p; ctx.fillStyle = L.col; ctx.fill(); ctx.restore();
        ctx.save(); ctx.globalAlpha = on ? 1 : 0.75; ctx.strokeStyle = L.col; ctx.lineWidth = on ? 1.6 : 1; ctx.stroke(); ctx.restore();
      }
      if (time != null) {
        const span = W * 1.6, pos = ((time / 7000) % 1) * (span + W * 0.6) - W * 0.3;
        ctx.save(); waferPath(); ctx.clip();
        const g = ctx.createLinearGradient(pos - W * 0.25, pos - W * 0.25, pos + W * 0.25, pos + W * 0.25);
        g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.06)"); g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, W); ctx.restore();
      }
    }
    const loop = (t) => { draw(t); raf = visible ? requestAnimationFrame(loop) : 0; };
    function start() { if (X.reduceMotion) { draw(null); return; } if (!raf) raf = requestAnimationFrame(loop); }
    layout(); start();
    new ResizeObserver(() => { layout(); if (X.reduceMotion || !raf) draw(X.reduceMotion ? null : performance.now()); }).observe(cv);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(cv);
    const hit = (e) => { const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top; return lit.find((L) => x >= L.die.x && x <= L.die.x + L.die.d && y >= L.die.y && y <= L.die.y + L.die.d) || null; };
    cv.addEventListener("pointermove", (e) => {
      hover = hit(e);
      cv.style.cursor = hover ? "pointer" : "default";
      if (hover) X.showTip(e.clientX, e.clientY, `${cap(hover.t.stage)} · ${hover.t.level}`, [{ color: hover.col, value: hover.t.name, label: MODEL[hover.t.winner].short }], "click for the task page");
      else X.hideTip();
      if (X.reduceMotion) draw(null);
    });
    cv.addEventListener("pointerleave", () => { hover = null; X.hideTip(); if (X.reduceMotion) draw(null); });
    cv.addEventListener("click", (e) => { const L = hit(e); if (L) location.href = X.taskHref(L.t.key); });
  })();

  /* ---------------- leaderboard ---------------- */
  const state = { stage: "all", level: "all" };
  const TK = D.tokens.models;
  function drawSegs() {
    X.seg($("#seg-stage"), [["all", "All", 25], ...STAGES.map((g) => [g, cap(g), X.filterTasks(D.tasks, g, state.level).length])], state.stage, (v) => { state.stage = v; drawSegs(); render(); });
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
      const tk = TK[r.m];
      tb.append(h("tr", {},
        h("td", { class: "rk", text: r.score == null ? "–" : String(pos) }),
        h("td", {}, h("div", { class: "model" }, h("span", { class: "badge" }, X.swatch(r.m, 14)), h("div", {}, h("b", { text: MODEL[r.m].name }), h("small", { text: `${X.PROVIDER[r.m]} · ${X.effortNote(r.m)}` })))),
        h("td", {}, h("div", { class: "score" }, r.score == null ? "—" : fmt(r.score, 1), h("small", { text: r.ci.lo == null ? "" : `${fmt(r.ci.lo, 1)}–${fmt(r.ci.hi, 1)}` }))),
        h("td", { class: "barcell" }, scoreBar(r.m, r.score ?? 0, r.ci)),
        h("td", { class: "n" }, `${r.wins}`, h("small", { text: `of ${r.cov}` })),
        h("td", { class: "n", text: r.rel == null ? "—" : fmt(r.rel, 3) }),
        h("td", { class: "n", text: pct(r.ci.p1) }),
        h("td", { class: "n" }, `${fmt(tk.hours, 2)} h`, h("small", { text: `${tk.tool_calls} tool calls` })),
        h("td", { class: "n" }, `${tk.tokens_per_run_estimated ? "≈" : ""}${tk.tokens_per_run_m}M`, h("small", { text: tk.tokens_per_run_estimated ? "estimated" : "measured" }))));
    });
    const scope = [state.stage !== "all" ? state.stage : null, state.level !== "all" ? `${state.level}-level` : null].filter(Boolean).join(" ");
    $("#lb-sub").textContent = `Rank score over ${ts.length} ${scope ? scope + " " : ""}task${ts.length === 1 ? "" : "s"}, from each run's best valid score. 100 = first on every task.`;
  }
  $("#lb-foot").textContent = "Each task ranks every configuration that ran it by its best valid score during the run; a run that never produced a valid score ranks last on that task. GPT-6 Astra has no run on Miles OPD, so it is ranked on 24 tasks. Whiskers and P(#1): 3,000 bootstrap resamples of tasks. Mean rel.: best score ÷ top score on the task, averaged. Time and tokens: per-model medians from the trajectory analysis (152 runs).";
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
    s("rect", { x: 12, y: 12, width: W - 24, height: H - 24, rx: 12, fill: "#08090c", stroke: C.hair2 }, svg);
    for (let x = 40; x <= W - 46; x += 16) { s("rect", { x, y: 5, width: 6, height: 4, rx: 1, fill: "rgba(255,255,255,0.12)" }, svg); s("rect", { x, y: H - 9, width: 6, height: 4, rx: 1, fill: "rgba(255,255,255,0.12)" }, svg); }
    for (let y = 36; y <= H - 42; y += 16) { s("rect", { x: 5, y, width: 4, height: 6, rx: 1, fill: "rgba(255,255,255,0.12)" }, svg); s("rect", { x: W - 9, y, width: 4, height: 6, rx: 1, fill: "rgba(255,255,255,0.12)" }, svg); }
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

    const tbl = $("#cat-leaders");
    tbl.append(h("thead", {}, h("tr", {}, ["Category", "Leader", "Rank score", "Runner-up"].map((x, i) => h("th", { scope: "col", class: i === 2 ? "n" : null, text: x })))));
    const tb = h("tbody");
    for (const stg of STAGES) for (const lv of LEVELS) {
      const ts = X.filterTasks(D.tasks, stg, lv), rs = X.rankScores(ts);
      const order = MODELS.filter((m) => rs[m] != null).sort((a, b) => rs[b] - rs[a]);
      tb.append(h("tr", {}, h("td", { class: "muted", text: `${cap(stg)} · ${lv} (${ts.length})` }), h("td", {}, X.who(order[0], MODEL[order[0]].short)),
        h("td", { class: "n", text: fmt(rs[order[0]], 1) }), h("td", {}, X.who(order[1], `${MODEL[order[1]].short} · ${fmt(rs[order[1]], 1)}`))));
    }
    tbl.append(tb);
  })();

  /* ---------------- results matrix ---------------- */
  (function renderMatrix() {
    const tbl = $("#matrix");
    tbl.append(h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "Task" }), MODELS.map((m) => h("th", { scope: "col", class: "mcol" }, h("span", { class: "who" }, X.swatch(m, 10), MODEL[m].short))), h("th", { scope: "col", text: "Unit" }))));
    const tb = h("tbody");
    for (const stg of STAGES) for (const lv of LEVELS) {
      const ts = D.tasks.filter((t) => t.stage === stg && t.level === lv);
      tb.append(h("tr", { class: "grp" }, h("td", { colspan: MODELS.length + 2 }, `${cap(stg)} · ${cap(lv)}`, h("span", { text: `${ts.length} task${ts.length > 1 ? "s" : ""} · ${lv === "operator" ? 12 : 24} h` }))));
      for (const t of ts) {
        const max = Math.max(...Object.keys(t.results).map((m) => t.results[m].best || 0));
        const tr = h("tr", { class: "row", tabindex: 0, onclick: () => { location.href = X.taskHref(t.key); }, onkeydown: (e) => { if (e.key === "Enter") location.href = X.taskHref(t.key); } },
          h("td", { class: "task" }, h("b", { text: t.name }), h("small", { text: `${t.start} · ${t.target}` })));
        for (const m of MODELS) {
          const r = t.results[m];
          if (!r || r.best == null) {
            tr.append(h("td", {}, h("div", { class: "cell none", title: !r ? "No run in this cohort" : "No valid scored submission during the run" }, !r ? "no run" : "no valid")));
            continue;
          }
          const win = t.winner === m;
          tr.append(h("td", {}, h("div", { class: `cell${win ? " win" : ""}`, style: win ? `--wc:${COLOR[m]}` : null, title: `${MODEL[m].name} (effort ${r.effort}): ${withUnit(t, r.best)}${r.flag ? ` [${r.flag}] ${D.flag_legend[r.flag]}` : ""}` },
            h("i", { style: `width:${max > 0 ? (r.best / max) * 100 : 0}%` }), h("span", { text: fmt(r.best) }), r.flag ? h("span", { class: "flag", text: r.flag }) : null)));
        }
        tr.append(h("td", { class: "unit", text: unitOf(t) || "score" }));
        tb.append(tr);
      }
    }
    tbl.append(tb);
    $("#matrix-foot").textContent = Object.entries(D.flag_legend).map(([f, text]) => `${f} ${text}`).join(" · ") + ". Flash-KMeans is scored on latency and shown here as equivalent throughput.";
  })();

  /* ---------------- highlights ---------------- */
  (function renderHighlights() {
    const items = [
      ["eagle3", "Claude climbs to 846 tok/s, 97 tok/s ahead of the next configuration; GLM stays below 250."],
      ["flash-kmeans", "Claude's best equivalent throughput rises from 107 to 209 TFLOP/s within the 12-hour run."],
      ["qvg", "Qwen's first valid score arrives at 10.2 h. Claude reaches 19.6× compression, more than twice the next best."],
      ["kvzip", "Sol reaches 94.39 at 5.8 h; none of its next 29 submissions beats it. Astra reaches 97.81."],
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
    const tk = D.tokens.models;
    const rej = MODELS.reduce((a, m) => a + D.summary.status_totals[m].rejected, 0);
    const facts = [
      [pct(R.bootstrap[leader].p_pos[0]), "", `of task resamples put ${MODEL[leader].name} first. Removing any one task never changes the leader.`, "analysis.html#stability"],
      [`${rej}`, "", `submissions blocked by the integrity review before scoring, for skipping or bending required work.`, "runs.html"],
      ["5.8 → 28.1%", "", "share of submissions that repeat an earlier candidate, first versus second half of the budget.", "analysis.html#behavior"],
      [`${tk.astra.tool_calls} vs ${tk.qwen.tool_calls}`, "", "median tool calls before the first valid score: GPT-6 Astra versus Qwen 3.8 Flash.", "analysis.html#efficiency"],
    ];
    const box = $("#facts");
    for (const [v, small, text, href] of facts) box.append(h("a", { href }, h("b", {}, v, small ? h("small", { text: small }) : null), h("p", { text })));
  })();
})();
