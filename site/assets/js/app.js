/* Infrathon site. Renders every chart from window.INFRATHON (site/data/infrathon.js). */
(() => {
  "use strict";
  const D = window.INFRATHON;
  if (!D) return;

  const K = 6;
  const MODELS = D.models.map((m) => m.key);
  const MODEL = Object.fromEntries(D.models.map((m) => [m.key, m]));
  // Mirrors the --m-* tokens in site.css (SVG presentation attributes cannot read CSS variables).
  const COLOR = { sol: "#3987e5", claude: "#d95926", qwen: "#199e70", deepseek: "#c98500", glm: "#d55181", astra: "#9085e9" };
  const SHAPE = { sol: "circle", claude: "square", qwen: "triangle", deepseek: "diamond", glm: "tridown", astra: "plus" };
  const INK = "#e9eef3", INK2 = "#aab5c0", INK3 = "#7d8995", LINE = "#1c232c", LINE2 = "#2a333e", SURFACE = "#0e1217", CRIT = "#d03b3b";
  const TASK = Object.fromEntries(D.tasks.map((t) => [t.key, t]));
  const RANKED = D.tasks.filter((t) => t.ranked);
  const STAGES = ["training", "inference"];
  const LEVELS = ["operator", "module", "system"];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- DOM helpers ---------------- */
  const NS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function st(parent, x, y, text, attrs) {
    const t = s("text", Object.assign({ x, y }, attrs || {}), parent);
    t.textContent = text;
    return t;
  }
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "style") e.style.cssText = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  }
  const $ = (sel) => document.querySelector(sel);

  /* ---------------- formatting ---------------- */
  function fmt(v, dp) {
    if (v == null || !isFinite(v)) return "—";
    const a = Math.abs(v);
    const d = dp != null ? dp : a >= 1000 ? 0 : a >= 100 ? 1 : 2;
    return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  const UNIT = { TFLOPS: "TFLOPS", "GB/s": "GB/s", "tok/s": "tok/s", FPS: "FPS", "steps/min": "steps/min", Ratio: "×", Fidelity: "pts", "Rel. accuracy": "pts", Score: "" };
  const unitOf = (t) => (t.key === "flash-kmeans" ? "TFLOP/s" : UNIT[t.metric] ?? "");
  const withUnit = (t, v) => { const u = unitOf(t); return v == null ? "—" : u === "×" ? fmt(v) + "×" : u ? `${fmt(v)} ${u}` : fmt(v); };
  const metricLabel = (t) => ({
    TFLOPS: t.key === "flash-kmeans" ? "Equivalent TFLOP/s" : "TFLOPS", Score: "Score", Ratio: "Compression ratio",
    Fidelity: "Fidelity points", "Rel. accuracy": "Relative accuracy", "tok/s": "Tokens per second", FPS: "Latency-weighted FPS",
    "steps/min": "Valid agent steps per minute", "GB/s": "Effective bandwidth (GB/s)",
  }[t.metric] || t.metric);
  const ordinal = (n) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
  const pct = (x, dp = 0) => `${(x * 100).toFixed(dp)}%`;

  /* ---------------- marks ---------------- */
  function marker(parent, key, x, y, r, opts) {
    const o = Object.assign({ fill: COLOR[key], ring: SURFACE, ringW: 2 }, opts || {});
    const a = { fill: o.fill, stroke: o.ring, "stroke-width": o.ringW, "paint-order": "stroke" };
    const shape = SHAPE[key];
    if (shape === "circle") return s("circle", Object.assign({ cx: x, cy: y, r }, a), parent);
    if (shape === "square") return s("rect", Object.assign({ x: x - r * 0.88, y: y - r * 0.88, width: r * 1.76, height: r * 1.76, rx: 1 }, a), parent);
    let pts;
    if (shape === "triangle") pts = [[x, y - r * 1.15], [x + r * 1.1, y + r * 0.8], [x - r * 1.1, y + r * 0.8]];
    else if (shape === "tridown") pts = [[x, y + r * 1.15], [x + r * 1.1, y - r * 0.8], [x - r * 1.1, y - r * 0.8]];
    else if (shape === "diamond") pts = [[x, y - r * 1.2], [x + r * 1.2, y], [x, y + r * 1.2], [x - r * 1.2, y]];
    else { const w = r * 0.42, l = r * 1.15; pts = [[x - w, y - l], [x + w, y - l], [x + w, y - w], [x + l, y - w], [x + l, y + w], [x + w, y + w], [x + w, y + l], [x - w, y + l], [x - w, y + w], [x - l, y + w], [x - l, y - w], [x - w, y - w]]; }
    return s("polygon", Object.assign({ points: pts.map((p) => p.map((v) => v.toFixed(2)).join(",")).join(" ") }, a), parent);
  }
  function swatch(key, size = 12) {
    const svg = s("svg", { width: size, height: size, viewBox: "0 0 12 12", "aria-hidden": "true" });
    svg.style.flex = "none";
    marker(svg, key, 6, 6, 4.2, { ringW: 0 });
    return svg;
  }

  /* ---------------- tooltip ---------------- */
  const tip = h("div", { id: "tip", role: "status", "aria-live": "polite" });
  tip.hidden = true;
  document.body.append(tip);
  function showTip(x, y, title, rows, note) {
    tip.replaceChildren();
    if (title) tip.append(h("div", { class: "t", text: title }));
    for (const r of rows) {
      const lk = h("span", { class: "lk", style: `background:${r.color || INK3}` });
      tip.append(h("div", { class: "r" }, lk, h("b", { text: r.value }), h("span", { text: r.label })));
    }
    if (note) tip.append(h("div", { style: "margin-top:6px;color:#7d8995;font-size:11px", text: note }));
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let L = x + 16, T = y + 14;
    if (L + r.width > innerWidth - 8) L = x - r.width - 16;
    if (T + r.height > innerHeight - 8) T = y - r.height - 14;
    tip.style.left = `${Math.max(8, L)}px`;
    tip.style.top = `${Math.max(8, T)}px`;
  }
  const hideTip = () => { tip.hidden = true; };

  /* ---------------- scales ---------------- */
  function niceTicks(lo, hi, n = 4) {
    if (!(hi > lo)) { hi = lo + 1; }
    const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) || 10 * mag;
    const t0 = Math.floor(lo / step) * step, t1 = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = t0; v <= t1 + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }
  const bestAt = (traj, t) => { let v = null; for (const [x, y] of traj) { if (x <= t + 1e-9) v = y; else break; } return v; };

  /* =========================================================
     HERO: run trace
     ========================================================= */
  const traceSel = $("#trace-task");
  const traceOrder = [...D.tasks].sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level));
  for (const stage of STAGES) {
    const og = h("optgroup", { label: cap(stage) });
    for (const t of traceOrder.filter((t) => t.stage === stage)) og.append(h("option", { value: t.key, text: `${t.name} · ${cap(t.level)}` }));
    traceSel.append(og);
  }
  traceSel.value = "eagle3";
  let traceAnim = null;
  function renderTrace(key, animate) {
    const t = TASK[key];
    const body = $("#trace-body");
    body.replaceChildren();
    if (traceAnim) cancelAnimationFrame(traceAnim);
    const W = 1000, laneH = 46, top = 22, X0 = 168, X1 = 862, H = top + K * laneH + 30;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Run trace for ${t.name}: submissions and best score over ${t.budget_h} hours for each configuration.` }, body);
    const T = t.budget_h;
    const xs = (h0) => X0 + (Math.min(h0, T) / T) * (X1 - X0);
    const vals = MODELS.flatMap((m) => (t.results[m]?.traj || []).map((p) => p[1]));
    const vmin = Math.min(...vals), vmax = Math.max(...vals);
    const subs = MODELS.reduce((a, m) => a + (t.results[m]?.n_sub || 0), 0);
    $("#trace-meta").textContent = `${t.budget_h} h budget · ${Object.keys(t.results).length} runs · ${subs} submissions · ${metricLabel(t)}`;

    // time grid
    const step = T === 12 ? 2 : 4;
    for (let x = 0; x <= T; x += step) {
      s("line", { x1: xs(x), x2: xs(x), y1: top - 6, y2: top + K * laneH, stroke: LINE, "stroke-width": 1 }, svg);
      st(svg, xs(x), H - 8, `${x}h`, { fill: INK3, "font-size": 11, "text-anchor": "middle" });
    }
    st(svg, W - 6, top - 8, "best so far", { fill: INK3, "font-size": 10.5, "text-anchor": "end" });

    const clipId = `clip-${key}`;
    const clip = s("clipPath", { id: clipId }, s("defs", {}, svg));
    const clipRect = s("rect", { x: 0, y: 0, width: X0, height: H }, clip);
    const readouts = {};
    MODELS.forEach((m, i) => {
      const y0 = top + i * laneH, base = y0 + 34, hi = y0 + 6;
      const r = t.results[m];
      s("line", { x1: X0, x2: X1, y1: base, y2: base, stroke: LINE2, "stroke-width": 1 }, svg);
      const lab = s("g", {}, svg);
      marker(lab, m, 14, y0 + 22, 4.5);
      st(lab, 28, y0 + 26, MODEL[m].name, { fill: r ? INK : INK3, "font-size": 13, style: "font-family:var(--f-body)" });
      if (!r) { st(svg, X0 + 8, y0 + 26, "no run in this cohort", { fill: INK3, "font-size": 11 }); readouts[m] = null; return; }
      const g = s("g", { "clip-path": `url(#${clipId})` }, svg);
      const yv = (v) => (vmax > vmin ? base - ((v - vmin) / (vmax - vmin)) * (base - hi - 4) - 4 : base - 14);
      if (r.traj.length && !r.hide_curve) {
        const end = xs(r.elapsed_h ?? T);
        let d = `M${xs(r.traj[0][0]).toFixed(1)},${yv(r.traj[0][1]).toFixed(1)}`;
        for (let k = 1; k < r.traj.length; k++) d += `H${xs(r.traj[k][0]).toFixed(1)}V${yv(r.traj[k][1]).toFixed(1)}`;
        d += `H${end.toFixed(1)}`;
        s("path", { d: `${d}V${base}H${xs(r.traj[0][0]).toFixed(1)}Z`, fill: COLOR[m], "fill-opacity": 0.16 }, g);
        s("path", { d, fill: "none", stroke: COLOR[m], "stroke-width": 2, "stroke-linejoin": "round" }, g);
      }
      for (const [x, , stc] of r.subs) {
        const X = xs(x);
        if (stc === "v") s("line", { x1: X, x2: X, y1: base + 2, y2: base + 9, stroke: INK3, "stroke-width": 1.2 }, g);
        else if (stc === "x") s("line", { x1: X, x2: X, y1: base + 2, y2: base + 9, stroke: CRIT, "stroke-width": 1.6 }, g);
        else s("line", { x1: X, x2: X, y1: base + 2, y2: base + 9, stroke: INK3, "stroke-width": 1.2, "stroke-dasharray": "1.5 1.5" }, g);
      }
      if ((r.elapsed_h ?? T) < T - 0.05) {
        s("line", { x1: xs(r.elapsed_h), x2: xs(r.elapsed_h), y1: y0 + 8, y2: base + 9, stroke: INK3, "stroke-width": 1 }, g);
        st(g, xs(r.elapsed_h) + 4, y0 + 14, `stopped ${fmt(r.elapsed_h, 1)} h`, { fill: INK3, "font-size": 10 });
      }
      readouts[m] = st(svg, W - 6, y0 + 26, "", { fill: INK, "font-size": 13, "text-anchor": "end", "font-weight": 500 });
    });
    const scan = s("line", { x1: X0, x2: X0, y1: top - 6, y2: top + K * laneH, stroke: INK, "stroke-width": 1, "stroke-opacity": 0.7 }, svg);
    const scanLabel = st(svg, X0, top - 9, "", { fill: INK2, "font-size": 10.5, "text-anchor": "middle" });

    function setTime(tt, showScan) {
      const X = xs(tt);
      clipRect.setAttribute("width", X + 1);
      scan.setAttribute("x1", X); scan.setAttribute("x2", X);
      scan.style.display = showScan ? "" : "none";
      scanLabel.setAttribute("x", Math.min(Math.max(X, X0 + 14), X1 - 14));
      scanLabel.textContent = showScan ? `${fmt(tt, 1)} h` : "";
      for (const m of MODELS) {
        if (!readouts[m]) continue;
        const r = t.results[m];
        const v = r.hide_curve ? null : bestAt(r.traj, tt);
        readouts[m].textContent = r.hide_curve ? "not comparable" : v == null ? (tt >= T - 1e-6 && !r.traj.length ? "no valid score" : "—") : withUnit(t, v);
        readouts[m].setAttribute("fill", v == null ? INK3 : INK);
      }
    }
    let scrubbing = false;
    svg.addEventListener("pointermove", (e) => {
      const p = svg.getBoundingClientRect();
      const x = ((e.clientX - p.left) / p.width) * W;
      if (x < X0 || x > X1) return;
      scrubbing = true;
      if (traceAnim) { cancelAnimationFrame(traceAnim); traceAnim = null; }
      setTime(((x - X0) / (X1 - X0)) * T, true);
    });
    svg.addEventListener("pointerleave", () => { if (scrubbing) setTime(T, false); scrubbing = false; });

    if (!animate || reduceMotion) { setTime(T, false); return; }
    const dur = 3200, t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - (1 - p) ** 3;
      setTime(e * T, p < 1);
      if (p < 1) traceAnim = requestAnimationFrame(tick); else traceAnim = null;
    };
    traceAnim = requestAnimationFrame(tick);
  }
  traceSel.addEventListener("change", () => renderTrace(traceSel.value, true));
  renderTrace("eagle3", true);

  const subTotal = D.summary.n_submissions;
  document.querySelector('[data-stat="subs"]').textContent = subTotal.toLocaleString("en-US");
  document.querySelector('[data-stat="runs"]').textContent = D.summary.n_runs;

  /* =========================================================
     Rank math (client side, so filters can recompute)
     ========================================================= */
  function scopeTasks(scope) {
    if (scope === "all") return RANKED;
    return RANKED.filter((t) => t.stage === scope || t.level === scope);
  }
  function rankScores(ts, ep) {
    const key = ep === "best" ? "ranks_best" : "ranks";
    const out = {};
    for (const m of MODELS) out[m] = ts.length ? (100 * ts.reduce((a, t) => a + (K - t[key][m]), 0)) / (ts.length * (K - 1)) : NaN;
    return out;
  }
  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function bootstrap(ts, ep, B = 4000) {
    const rnd = mulberry32(20261023), sm = {}, first = {};
    MODELS.forEach((m) => { sm[m] = []; first[m] = 0; });
    for (let b = 0; b < B; b++) {
      const pick = ts.map(() => ts[Math.floor(rnd() * ts.length)]);
      const rs = rankScores(pick, ep), top = Math.max(...MODELS.map((m) => rs[m]));
      for (const m of MODELS) { sm[m].push(rs[m]); if (rs[m] === top) first[m]++; }
    }
    const q = (xs, p) => { const a = [...xs].sort((x, y) => x - y), i = (a.length - 1) * p, lo = Math.floor(i); return a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (i - lo); };
    const out = {};
    for (const m of MODELS) out[m] = { lo: q(sm[m], 0.025), hi: q(sm[m], 0.975), p1: first[m] / B };
    return out;
  }

  /* =========================================================
     LEADERBOARD
     ========================================================= */
  const state = { scope: "all", ep: "final" };
  const SCOPES = [["all", "All"], ["training", "Training"], ["inference", "Inference"], ["operator", "Operator"], ["module", "Module"], ["system", "System"]];
  const scopeSeg = $("#scope-seg");
  for (const [k, label] of SCOPES) {
    scopeSeg.append(h("button", { type: "button", "data-scope": k, "aria-pressed": String(k === "all") }, label, h("span", { class: "n", text: scopeTasks(k).length })));
  }
  scopeSeg.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.scope = b.dataset.scope;
    scopeSeg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderBoard();
  });
  $("#ep-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.ep = b.dataset.ep;
    $("#ep-seg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderBoard(); renderCats();
  });

  function rsBar(m, v, ci) {
    const svg = s("svg", { "aria-hidden": "true" });
    for (const g of [0, 25, 50, 75, 100]) s("line", { x1: `${g}%`, x2: `${g}%`, y1: 4, y2: 22, stroke: g === 0 ? LINE2 : LINE, "stroke-width": 1 }, svg);
    if (v > 0) {
      s("rect", { x: 0, y: 9, width: `${v}%`, height: 8, rx: 4, fill: COLOR[m] }, svg);
      s("rect", { x: 0, y: 9, width: `${Math.min(v, 3)}%`, height: 8, fill: COLOR[m] }, svg);
    }
    if (ci) {
      s("line", { x1: `${ci.lo}%`, x2: `${ci.hi}%`, y1: 13, y2: 13, stroke: INK, "stroke-width": 1.5 }, svg);
      for (const x of [ci.lo, ci.hi]) s("line", { x1: `${x}%`, x2: `${x}%`, y1: 8, y2: 18, stroke: INK, "stroke-width": 1.5 }, svg);
    }
    return svg;
  }

  function renderBoard() {
    const ts = scopeTasks(state.scope), ep = state.ep;
    const rs = rankScores(ts, ep), bs = bootstrap(ts, ep);
    const key = ep === "best" ? "ranks_best" : "ranks";
    const field = ep === "best" ? "best" : "final";
    const order = [...MODELS].sort((a, b) => rs[b] - rs[a]);
    const tbody = $("#board tbody");
    tbody.replaceChildren();
    for (const m of order) {
      const pos = 1 + MODELS.filter((o) => rs[o] > rs[m]).length;
      const counts = [0, 0, 0, 0, 0, 0];
      ts.forEach((t) => { counts[Math.min(K, Math.max(1, Math.round(t[key][m]))) - 1]++; });
      const wins = ts.filter((t) => t[key][m] === 1).length;
      const rel = ts.reduce((a, t) => a + t.results[m][field] / Math.max(...MODELS.map((o) => t.results[o][field])), 0) / ts.length;
      const hist = h("div", { class: "hist" });
      counts.forEach((c, i) => {
        const a = c / ts.length;
        hist.append(h("span", { class: c === 0 ? "zero" : a > 0.56 ? "hot" : "", style: `--a:${Math.max(0.12, a).toFixed(3)}`, title: `${c} of ${ts.length} tasks in ${ordinal(i + 1)} place` }, c));
      });
      const effortNote = D.tasks.some((t) => t.flags[m] === "x") ? "xhigh on 4 tasks, max elsewhere" : "reasoning effort max";
      tbody.append(h("tr", {},
        h("td", { class: "pos" }, String(pos)),
        h("td", {}, h("div", { class: "model" }, swatch(m, 14), h("div", {}, MODEL[m].name, h("small", { text: effortNote })))),
        h("td", {}, h("div", { class: "rs" }, h("span", { class: "v", text: fmt(rs[m], 1) }), rsBar(m, rs[m], bs[m]))),
        h("td", {}, hist),
        h("td", { class: "c" }, `${wins} / ${ts.length}`),
        h("td", { class: "c" }, fmt(rel, 3)),
        h("td", { class: "c" }, pct(bs[m].p1)),
      ));
      tbody.lastChild.querySelector(".rs").title = `95% bootstrap interval ${fmt(bs[m].lo, 1)}–${fmt(bs[m].hi, 1)}`;
    }
    const scopeName = SCOPES.find((x) => x[0] === state.scope)[1].toLowerCase();
    $("#lb-eyebrow").textContent = `${ts.length} ranked ${state.scope === "all" ? "" : scopeName + " "}tasks · K = 6 configurations`;
    $("#board-note").textContent = `${ep === "best" ? "Ranked by the best valid score each run reached during interaction, not its final artifact." : "Ranked by independent evaluation of the implementation frozen at the deadline."} Whiskers: 95% interval over 4,000 bootstrap resamples of these ${ts.length} tasks. Mean relative score = ${field} ÷ best ${field} on the task, averaged. P(#1) counts ties for every tied leader.`;
  }
  renderBoard();

  /* ---------- category grid ---------- */
  function renderCats() {
    const grid = $("#cat-grid");
    grid.replaceChildren(h("div", { class: "corner" }));
    for (const lv of LEVELS) {
      const budget = lv === "operator" ? "12 h budget" : "24 h budget";
      grid.append(h("div", { class: "ch" }, `${cap(lv)}-level`, h("small", { text: budget })));
    }
    for (const stg of STAGES) {
      grid.append(h("div", { class: "rh" }, cap(stg), h("small", { text: `${D.tasks.filter((t) => t.stage === stg).length} tasks` })));
      for (const lv of LEVELS) {
        const ts = RANKED.filter((t) => t.stage === stg && t.level === lv);
        const inv = D.tasks.filter((t) => t.stage === stg && t.level === lv).length;
        const rs = rankScores(ts, state.ep);
        const cell = h("div", { class: "cat-cell", "data-label": `${cap(stg)} · ${cap(lv)}` }, h("div", { class: "n", text: `${ts.length} of ${inv} task${inv > 1 ? "s" : ""} ranked` }));
        const rowH = 22, W = 320, L = 66, R = 268;
        const svg = s("svg", { viewBox: `0 0 ${W} ${MODELS.length * rowH + 20}`, role: "img", "aria-label": `${cap(stg)} ${lv}-level rank scores: ` + MODELS.map((m) => `${MODEL[m].short} ${fmt(rs[m], 1)}`).join(", ") }, cell);
        const xs = (v) => L + (v / 100) * (R - L);
        for (const g of [0, 50, 100]) {
          s("line", { x1: xs(g), x2: xs(g), y1: 4, y2: MODELS.length * rowH + 2, stroke: g === 0 ? LINE2 : LINE, "stroke-width": 1 }, svg);
          st(svg, xs(g), MODELS.length * rowH + 16, String(g), { fill: INK3, "font-size": 10, "text-anchor": "middle" });
        }
        MODELS.forEach((m, i) => {
          const y = 4 + i * rowH + rowH / 2, v = rs[m];
          const row = s("g", { tabindex: 0, style: "cursor:default;outline:none" }, svg);
          s("rect", { x: 0, y: y - rowH / 2, width: W, height: rowH, fill: "transparent" }, row);
          st(row, 0, y + 4, MODEL[m].short, { fill: INK2, "font-size": 11 });
          if (v > 0) s("line", { x1: xs(0), x2: xs(v), y1: y, y2: y, stroke: COLOR[m], "stroke-width": 2 }, row);
          marker(row, m, xs(v), y, 4.5);
          st(row, xs(v) + 9, y + 4, fmt(v, 1).replace(/\.0$/, ""), { fill: INK, "font-size": 11 });
          const show = (e) => {
            const r = row.getBoundingClientRect();
            const key = state.ep === "best" ? "ranks_best" : "ranks";
            showTip(e.clientX ?? r.right, e.clientY ?? r.top, `${MODEL[m].name} · ${cap(stg)} ${lv}`,
              ts.map((t) => ({ color: COLOR[m], value: ordinal(Math.round(t[key][m])), label: t.name })), `Rank score ${fmt(v, 1)} over ${ts.length} task${ts.length > 1 ? "s" : ""}`);
          };
          row.addEventListener("pointermove", show); row.addEventListener("focus", show);
          row.addEventListener("pointerleave", hideTip); row.addEventListener("blur", hideTip);
        });
        grid.append(cell);
      }
    }
  }
  renderCats();

  function wireTabs(a, b, pa, pb) {
    const set = (on) => { $(a).setAttribute("aria-selected", String(on)); $(b).setAttribute("aria-selected", String(!on)); $(pa).hidden = !on; $(pb).hidden = on; };
    $(a).addEventListener("click", () => set(true)); $(b).addEventListener("click", () => set(false));
  }
  wireTabs("#tab-cat-live", "#tab-cat-paper", "#cat-live", "#cat-paper");
  wireTabs("#tab-traj-live", "#tab-traj-paper", "#traj-live", "#traj-paper");

  /* =========================================================
     STABILITY
     ========================================================= */
  (function renderStability() {
    const S = D.summary, B = S.bootstrap;
    const all = D.groups.all.rank_score;
    const order = [...MODELS].sort((a, b) => all[b] - all[a]);
    const tbl = $("#pmat");
    tbl.append(h("thead", {}, h("tr", {}, h("th", {}, h("span", { class: "sr-only", text: "Configuration" })), [1, 2, 3, 4, 5, 6].map((i) => h("th", { scope: "col", text: ordinal(i) })))));
    const tb = h("tbody");
    for (const m of order) {
      const tr = h("tr", {}, h("th", { scope: "row" }, h("span", { style: "display:inline-flex;align-items:center;gap:7px" }, swatch(m), MODEL[m].short)));
      B[m].p_pos.forEach((p) => {
        const label = p >= 0.995 ? ">99%" : p >= 0.01 ? pct(p) : p > 0 ? "<1%" : "";
        tr.append(h("td", { class: p === 0 ? "zero" : p > 0.56 ? "hot" : "", style: `--a:${Math.max(0.1, p).toFixed(3)}` }, label));
      });
      tb.append(tr);
    }
    tbl.append(tb);

    const top = order[0], second = order[1];
    const loo = S.leave_one_out, ep = D.endpoint;
    const zeroDrops = ep.drops.filter((d) => d.final === 0).length;
    const tiles = [
      [pct(B[top].p_pos[0]), `of resamples put ${MODEL[top].name} first. ${MODEL[second].name} leads or ties in ${pct(B[second].p_pos[0])}. No other configuration ever ranks first.`],
      [`${loo.leader_changes.length}`, `single-task removals change the leader. Only ${loo.order_changes} change the order at all, and both just swap 3rd and 4th place.`, "of 17"],
      [`${ep.winner_changes.length}`, `tasks change winner if runs are ranked by their best in-run score instead of the final artifact (${ep.winner_changes.map((w) => TASK[w.task].name).join(", ")}). Mean Kendall τ between the two rankings is ${fmt(ep.mean_kendall_tau, 2)}.`, "of 17"],
      [`${ep.drops.length}`, `runs end with a final artifact more than 10% below their best in-run score. ${zeroDrops} of them fall to zero at final evaluation.`, `of ${ep.n_compared}`],
    ];
    const box = $("#stab-tiles");
    for (const [v, text, small] of tiles) box.append(h("div", { class: "tile" }, h("div", { class: "v" }, v, small ? h("small", { text: small }) : null), h("p", { text })));

    const wrap = $("#drops");
    for (const d of ep.drops) {
      const t = TASK[d.task], frac = d.best > 0 ? d.final / d.best : 0;
      const svg = s("svg", { "aria-hidden": "true" });
      s("line", { x1: 0, x2: "100%", y1: 7, y2: 7, stroke: LINE2, "stroke-width": 1 }, svg);
      if (frac > 0) {
        s("rect", { x: 0, y: 2, width: `${frac * 100}%`, height: 10, rx: 3, fill: COLOR[d.model], "fill-opacity": 0.9 }, svg);
        s("rect", { x: 0, y: 2, width: `${Math.min(frac * 100, 2)}%`, height: 10, fill: COLOR[d.model], "fill-opacity": 0.9 }, svg);
      }
      s("line", { x1: "100%", x2: "100%", y1: 0, y2: 14, stroke: INK, "stroke-width": 2 }, svg);
      const row = h("div", { class: "drop-row" },
        h("div", { class: "who" }, swatch(d.model), h("span", { text: `${t.name} · ${MODEL[d.model].short}` })),
        svg,
        h("div", { class: "vals" }, `${fmt(d.best)} → ${fmt(d.final)} ${unitOf(t)}`.trim(), h("span", { style: `color:${INK};margin-left:8px`, text: d.final === 0 ? "zero" : pct(d.change) })));
      row.style.cursor = "pointer";
      row.addEventListener("click", () => openTask(d.task));
      wrap.append(row);
    }
    $("#drops-sub").textContent = `Runs whose final evaluation lands more than 10% below the best valid score they reached while working (${ep.drops.length} of ${ep.n_compared} runs with both numbers; flagged proxies, failures and pending reevaluations are left out). The bar is the final score as a share of that best; the white tick marks 100%. Click a row for the task.`;
  })();

  /* =========================================================
     Legends with focus state
     ========================================================= */
  let focusModel = null;
  const focusListeners = [];
  function makeLegend(el, hint) {
    for (const m of MODELS) {
      const b = h("button", { type: "button", "aria-pressed": "false", "data-m": m }, swatch(m), MODEL[m].name);
      b.addEventListener("click", () => setFocus(focusModel === m ? null : m));
      el.append(b);
    }
    if (hint) el.append(h("span", { class: "hint", text: hint }));
  }
  function setFocus(m) {
    focusModel = m;
    document.querySelectorAll(".legend button[data-m]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
    focusListeners.forEach((f) => f());
  }

  /* =========================================================
     Trajectory chart (shared by small multiples and the dialog)
     ========================================================= */
  function trajChart(t, opts) {
    const o = Object.assign({ W: 320, H: 170, compact: true, dots: false }, opts);
    const pad = { l: o.compact ? 40 : 54, r: 12, t: 10, b: o.compact ? 22 : 30 };
    const svg = s("svg", { viewBox: `0 0 ${o.W} ${o.H}`, role: "img", "aria-label": `Best score so far over time for ${t.name}, ${metricLabel(t)}` });
    const runs = MODELS.filter((m) => t.results[m] && !t.results[m].hide_curve);
    const vals = runs.flatMap((m) => (o.dots ? t.results[m].subs.filter((x) => x[1] != null).map((x) => x[1]) : t.results[m].traj.map((p) => p[1])));
    if (!vals.length) { st(svg, o.W / 2, o.H / 2, "no valid scores", { fill: INK3, "font-size": 11, "text-anchor": "middle" }); return svg; }
    const vmin = Math.min(...vals), vmax = Math.max(...vals);
    const padV = (vmax - vmin) * 0.08 || Math.abs(vmax) * 0.05 || 1;
    const ticks = niceTicks(vmin >= 0 ? Math.max(0, vmin - padV) : vmin - padV, vmax + padV, o.compact ? 3 : 4);
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    const T = t.budget_h, X0 = pad.l, X1 = o.W - pad.r, Y0 = o.H - pad.b, Y1 = pad.t;
    const xs = (x) => X0 + (Math.min(x, T) / T) * (X1 - X0), ys = (v) => Y0 - ((v - lo) / (hi - lo)) * (Y0 - Y1);
    for (const v of ticks) {
      s("line", { x1: X0, x2: X1, y1: ys(v), y2: ys(v), stroke: LINE, "stroke-width": 1 }, svg);
      st(svg, X0 - 6, ys(v) + 3.5, fmt(v, Math.abs(hi - lo) < 5 ? 1 : 0), { fill: INK3, "font-size": o.compact ? 10.5 : 11, "text-anchor": "end" });
    }
    s("line", { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: LINE2, "stroke-width": 1 }, svg);
    const xstep = T === 12 ? (o.compact ? 4 : 2) : o.compact ? 8 : 4;
    for (let x = 0; x <= T; x += xstep) st(svg, xs(x), Y0 + (o.compact ? 13 : 16), `${x}h`, { fill: INK3, "font-size": o.compact ? 10.5 : 11, "text-anchor": "middle" });

    const layers = {};
    for (const m of runs) {
      const r = t.results[m], g = s("g", {}, svg);
      layers[m] = g;
      if (o.dots) for (const [x, v] of r.subs) if (v != null) s("circle", { cx: xs(x), cy: ys(v), r: 2.2, fill: COLOR[m], "fill-opacity": 0.35 }, g);
      if (!r.traj.length) continue;
      const end = r.elapsed_h ?? T;
      let d = `M${xs(r.traj[0][0]).toFixed(1)},${ys(r.traj[0][1]).toFixed(1)}`;
      for (let k = 1; k < r.traj.length; k++) d += `H${xs(r.traj[k][0]).toFixed(1)}V${ys(r.traj[k][1]).toFixed(1)}`;
      d += `H${xs(end).toFixed(1)}`;
      s("path", { d, fill: "none", stroke: COLOR[m], "stroke-width": o.compact ? 1.6 : 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
      marker(g, m, xs(end), ys(r.traj[r.traj.length - 1][1]), o.compact ? 3.4 : 4.2);
    }
    if (o.rug) {
      for (const m of runs) for (const [x, , stc] of t.results[m].subs) {
        if (stc === "v") continue;
        s("line", { x1: xs(x), x2: xs(x), y1: Y0 - 5, y2: Y0, stroke: stc === "x" ? CRIT : INK3, "stroke-width": 1.4, "stroke-dasharray": stc === "x" ? null : "1.5 1.5" }, svg);
      }
    }
    const applyFocus = () => { for (const m of runs) layers[m].setAttribute("opacity", !focusModel || focusModel === m ? 1 : 0.14); };
    applyFocus();
    focusListeners.push(applyFocus);

    const cross = s("line", { x1: 0, x2: 0, y1: Y1, y2: Y0, stroke: INK2, "stroke-width": 1, visibility: "hidden" }, svg);
    s("rect", { x: X0, y: Y1, width: X1 - X0, height: Y0 - Y1, fill: "transparent" }, svg);
    svg.addEventListener("pointermove", (e) => {
      const p = svg.getBoundingClientRect(), x = ((e.clientX - p.left) / p.width) * o.W;
      if (x < X0 || x > X1) { cross.setAttribute("visibility", "hidden"); hideTip(); return; }
      const tt = ((x - X0) / (X1 - X0)) * T;
      cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
      const rows = runs.map((m) => ({ m, v: (t.results[m].elapsed_h ?? T) + 1e-6 >= tt ? bestAt(t.results[m].traj, tt) : bestAt(t.results[m].traj, T) }))
        .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity))
        .map(({ m, v }) => ({ color: COLOR[m], value: v == null ? "—" : withUnit(t, v), label: MODEL[m].name }));
      showTip(e.clientX, e.clientY, `${t.name} · ${fmt(tt, 1)} h`, rows, "best valid score so far");
    });
    svg.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); hideTip(); });
    return svg;
  }

  /* =========================================================
     TASKS floorplan
     ========================================================= */
  makeLegend($("#task-legend"));
  makeLegend($("#traj-legend"), "click to isolate");
  function fingerprint(t) {
    const svg = s("svg", { class: "finger", viewBox: "0 0 120 22", preserveAspectRatio: "none", "aria-hidden": "true" });
    const finals = MODELS.map((m) => t.results[m]?.final).filter((v) => v != null);
    const max = Math.max(...finals, 1e-9);
    const w = 120 / K;
    MODELS.forEach((m, i) => {
      const v = t.results[m]?.final, x = i * w + 1.5;
      s("rect", { x, y: 21, width: w - 3, height: 1, fill: LINE2 }, svg);
      if (v == null || v === 0) return;
      const hh = Math.max(1.5, (v / max) * 20);
      s("rect", { x, y: 21 - hh, width: w - 3, height: hh, fill: COLOR[m], "fill-opacity": t.results[m].flag && t.results[m].flag !== "x" ? 0.35 : 0.95 }, svg);
    });
    return svg;
  }
  (function renderPlan() {
    const plan = $("#plan");
    plan.append(h("div", { class: "corner" }));
    for (const lv of LEVELS) {
      const n = D.tasks.filter((t) => t.level === lv).length;
      plan.append(h("div", { class: "ch" }, `${cap(lv)}`, h("small", { text: `${n} tasks · ${lv === "operator" ? 12 : 24} h` })));
    }
    for (const stg of STAGES) {
      plan.append(h("div", { class: "rh" }, cap(stg), h("small", { text: `${D.tasks.filter((t) => t.stage === stg).length} tasks` })));
      for (const lv of LEVELS) {
        const cell = h("div", { class: "cell", "data-label": `${cap(lv)} · ${lv === "operator" ? 12 : 24} h` });
        const tiles = h("div", { class: "cell-tiles" });
        for (const t of D.tasks.filter((x) => x.stage === stg && x.level === lv)) {
          const w = t.winner;
          const win = w
            ? h("div", { class: "win" }, swatch(w, 10), `${MODEL[w].short} · ${withUnit(t, t.results[w].final)}`)
            : h("div", { class: "win na", text: "No winner highlighted" });
          tiles.append(h("button", { type: "button", class: "task", "aria-haspopup": "dialog", onclick: () => openTask(t.key) },
            h("div", { class: "nm", text: t.name }),
            h("div", { class: "meta" }, `${metricLabel(t)} · ${t.start}`, t.ranked ? null : h("span", { class: "chip", style: "margin-left:6px", text: "NOT RANKED" })),
            fingerprint(t), win));
        }
        cell.append(tiles);
        plan.append(cell);
      }
    }
  })();

  /* =========================================================
     TRAJECTORIES small multiples
     ========================================================= */
  (function renderMultiples() {
    const box = $("#multiples");
    for (const stg of STAGES) for (const lv of LEVELS) {
      const ts = D.tasks.filter((t) => t.stage === stg && t.level === lv);
      box.append(h("div", { class: "group-label", text: `${cap(stg)} · ${cap(lv)} · ${lv === "operator" ? 12 : 24} h` }));
      for (const t of ts) {
        const panel = h("button", { type: "button", class: "mult", "aria-haspopup": "dialog", onclick: () => openTask(t.key) },
          h("div", { class: "h" }, h("b", { text: t.name }), h("span", { text: unitOf(t) || "score" })),
          h("div", { class: "sub", text: t.target }));
        panel.append(trajChart(t, { W: 300, H: 165 }));
        box.append(panel);
      }
    }
  })();

  /* =========================================================
     EFFICIENCY
     ========================================================= */
  (function renderEfficiency() {
    const TK = D.tokens, M = TK.models;
    const order = [...MODELS].sort((a, b) => M[a].hours - M[b].hours);
    const charts = [
      ["Hours to first valid score", "median wall-clock hours", (m) => M[m].hours, (v) => `${fmt(v, 2)} h`, null],
      ["Tool calls to first valid score", "median agent tool calls", (m) => M[m].tool_calls, (v) => fmt(v, 0), null],
      ["Tokens to first valid score", "median, runs with per-request logs", (m) => M[m].tokens_m, (v) => `${fmt(v, 1)}M`, (m) => (M[m].tokens_m == null ? "no per-request log" : null)],
      ["Tokens per run", "median over the full 12–24 h budget", (m) => M[m].tokens_per_run_m, (v) => `${fmt(v, 0)}M`, null],
    ];
    const box = $("#eff");
    for (const [title, sub, get, f, missing] of charts) {
      const max = Math.max(...order.map((m) => get(m) ?? 0));
      const bars = h("div", { class: "bars" });
      for (const m of order) {
        const v = get(m), est = title === "Tokens per run" && M[m].tokens_per_run_estimated;
        const svg = s("svg", { role: "img", "aria-label": `${MODEL[m].name}: ${v == null ? "not measured" : f(v)}${est ? " (estimated)" : ""}` });
        s("line", { x1: 0, x2: 0, y1: 2, y2: 20, stroke: LINE2, "stroke-width": 1 }, svg);
        if (v == null) {
          st(svg, 6, 15, missing(m), { fill: INK3, "font-size": 11 });
        } else {
          const w = (v / max) * 78;
          if (est) {
            s("rect", { x: 0.75, y: 5.75, width: `${w}%`, height: 10.5, rx: 3, fill: "none", stroke: COLOR[m], "stroke-width": 1.5, "stroke-dasharray": "3 2" }, svg);
          } else {
            s("rect", { x: 0, y: 5, width: `${w}%`, height: 12, rx: 4, fill: COLOR[m] }, svg);
            s("rect", { x: 0, y: 5, width: `${Math.min(w, 2)}%`, height: 12, fill: COLOR[m] }, svg);
          }
          st(svg, `${w}%`, 15, `${est ? "≈" : ""}${f(v)}${est ? " est." : ""}`, { dx: 7, fill: INK, "font-size": 11.5 });
        }
        bars.append(h("div", { class: "bar-row" }, h("div", { class: "who" }, swatch(m), MODEL[m].short), svg));
      }
      box.append(h("div", { class: "pane" }, h("div", { class: "pane-title", text: title }), h("div", { class: "pane-sub", style: "margin-bottom:4px", text: sub }), bars));
    }

    const tbl = $("#eff-table");
    tbl.append(h("thead", {}, h("tr", {}, ["Configuration", "Hours to first valid", "Tool calls", "Tokens to first valid", "Tokens per run", "First submission valid"].map((x) => h("th", { scope: "col", text: x })))));
    const tb = h("tbody");
    for (const m of order) {
      const r = M[m];
      tb.append(h("tr", {},
        h("td", {}, h("span", { style: "display:inline-flex;gap:7px;align-items:center" }, swatch(m), MODEL[m].name)),
        h("td", { text: fmt(r.hours, 2) }),
        h("td", { text: fmt(r.tool_calls, 0) }),
        h("td", { text: r.tokens_m == null ? "not logged" : `${fmt(r.tokens_m, 1)}M (n=${r.tokens_n})` }),
        h("td", { text: `${r.tokens_per_run_estimated ? "≈" : ""}${fmt(r.tokens_per_run_m, 0)}M${r.tokens_per_run_estimated ? " est." : ""}` }),
        h("td", { text: `${r.first_try_valid[0]} / ${r.first_try_valid[1]}` })));
    }
    tbl.append(tb);

    const notes = $("#eff-notes");
    const ul = h("ul");
    for (const [k, v] of Object.entries(TK.definitions)) ul.append(h("li", {}, h("b", { text: `${k.replace(/_/g, " ")}: ` }), v));
    for (const m of order) ul.append(h("li", {}, h("b", { text: `${MODEL[m].name}: ` }), TK.provenance[m]));
    ul.append(h("li", { text: `Claude spends a median ${TK.highlights.claude_tokens_between_submissions_m}M tokens between consecutive submissions. Miles tasks take the longest to reach a first valid score: on ALFWorld, Qwen and DeepSeek needed about ${TK.highlights.alfworld_tool_calls_to_first_valid.qwen.toLocaleString("en-US")} and ${TK.highlights.alfworld_tool_calls_to_first_valid.deepseek.toLocaleString("en-US")} tool calls.` }));
    notes.append(h("p", { style: "margin:10px 0 0", text: `${TK.scope} ${TK.source}` }), ul);
  })();

  /* =========================================================
     TASK DIALOG
     ========================================================= */
  const dlg = $("#task-dialog");
  function finalBars(t) {
    const box = h("div", { class: "chart-box" }, h("div", { class: "pane-title", text: `Final score · ${metricLabel(t)}` }));
    const avail = MODELS.filter((m) => t.results[m]);
    const max = Math.max(...avail.map((m) => t.results[m].final ?? 0), 1e-9);
    const order = [...MODELS].sort((a, b) => (t.results[b]?.final ?? -1) - (t.results[a]?.final ?? -1));
    const bars = h("div", { class: "bars" });
    for (const m of order) {
      const r = t.results[m], v = r?.final;
      const svg = s("svg", { role: "img", "aria-label": `${MODEL[m].name}: ${v == null ? "no final" : withUnit(t, v)}` });
      s("line", { x1: 0, x2: 0, y1: 2, y2: 20, stroke: LINE2, "stroke-width": 1 }, svg);
      if (v == null) st(svg, 6, 15, !r ? "no run in this cohort" : r.flag === "F" ? "failed final checks · no numeric score" : "no final evaluation", { fill: INK3, "font-size": 11 });
      else {
        const w = (v / max) * 62;
        const flagged = r.flag && r.flag !== "x";
        if (w > 0) {
          s("rect", { x: 0, y: 5, width: `${w}%`, height: 12, rx: 4, fill: COLOR[m], "fill-opacity": flagged ? 0.4 : 1 }, svg);
          s("rect", { x: 0, y: 5, width: `${Math.min(w, 2)}%`, height: 12, fill: COLOR[m], "fill-opacity": flagged ? 0.4 : 1 }, svg);
        }
        st(svg, `${w}%`, 15, `${withUnit(t, v)}${r.flag ? `  [${r.flag}]` : ""}${t.winner === m ? "  ← best" : ""}`, { dx: 7, fill: INK, "font-size": 11.5 });
      }
      bars.append(h("div", { class: "bar-row" }, h("div", { class: "who" }, swatch(m), MODEL[m].short), svg));
    }
    box.append(bars);
    return box;
  }
  function openTask(key, fromHash) {
    const t = TASK[key];
    if (!t) return;
    dlg.replaceChildren();
    const close = h("button", { type: "button", class: "close", "aria-label": "Close", text: "×", onclick: () => dlg.close() });
    dlg.append(h("div", { class: "dlg-head" },
      h("div", {}, h("div", { class: "eyebrow" }, h("span", {}, h("b", { text: `${cap(t.stage)} · ${cap(t.level)}` })), h("span", { text: `${t.budget_h} h budget` }), h("span", { text: t.ranked ? "ranked" : "not in the ranking" })),
        h("h3", { id: "dlg-title", style: "margin-top:8px", text: t.name })), close));
    const left = h("div", {},
      h("p", { style: "margin:0;color:var(--ink-2)", text: t.summary }),
      h("dl", { class: "facts" },
        h("dt", { text: "Target" }), h("dd", { text: t.target }),
        h("dt", { text: "Metric" }), h("dd", { text: `${metricLabel(t)}, higher is better` }),
        h("dt", { text: "Budget" }), h("dd", { text: `${t.budget_h} hours wall-clock` }),
        h("dt", { text: "Hardware" }), h("dd", { text: t.gpus }),
        h("dt", { text: "Start" }), h("dd", { text: t.start === "seed" ? "Seed: a working baseline to improve" : "Scratch: an empty file or stub" }),
        h("dt", { text: "Cohort" }), h("dd", { class: "mono", style: "font-size:12px", text: t.cohort })));
    if (t.exclusion) left.append(h("div", { class: "excl" }, h("b", { text: "Not in the ranking" }), t.exclusion));
    const chart = h("div", { class: "chart-box" }, h("div", { class: "pane-title", text: "Best valid score so far" }), h("div", { class: "pane-sub", style: "margin-bottom:0", text: "Line: running best. Dots: every valid submission. Ticks on the axis: rejected (red) and infrastructure failures (dotted)." }));
    chart.append(trajChart(t, { W: 620, H: 280, compact: false, dots: true, rug: true }));
    const right = h("div", {}, finalBars(t), chart);

    const tbl = h("table", { class: "plain" });
    tbl.append(h("thead", {}, h("tr", {}, ["Configuration", "Final", "Best during run", "Final vs best", "First valid score", "Submissions (valid / rejected / infra)", "Run length"].map((x) => h("th", { scope: "col", text: x })))));
    const tb = h("tbody");
    for (const m of MODELS) {
      const r = t.results[m];
      if (!r) { tb.append(h("tr", {}, h("td", {}, h("span", { style: "display:inline-flex;gap:7px;align-items:center" }, swatch(m), MODEL[m].name)), h("td", { colspan: 6, text: "No run in this cohort" }))); continue; }
      const vs = r.final != null && r.best ? r.final / r.best - 1 : null;
      tb.append(h("tr", {},
        h("td", {}, h("span", { style: "display:inline-flex;gap:7px;align-items:center" }, swatch(m), MODEL[m].name, r.flag ? h("span", { class: "chip", text: r.flag }) : null)),
        h("td", { text: r.final == null ? "—" : fmt(r.final) }),
        h("td", { text: fmt(r.best) }),
        h("td", { text: vs == null ? "—" : `${vs >= 0 ? "+" : ""}${(vs * 100).toFixed(1)}%` }),
        h("td", { text: r.first_valid_h == null ? "none" : `${fmt(r.first_valid_h, 2)} h` }),
        h("td", { text: `${r.counts.valid} / ${r.counts.invalid} / ${r.counts.infrastructure}` }),
        h("td", { text: `${fmt(r.elapsed_h, 1)} h` })));
    }
    tbl.append(tb);
    const flags = [...new Set(Object.values(t.flags))];
    const body = h("div", { class: "dlg-body" }, left, right, h("div", { class: "dlg-table" }, tbl),
      flags.length ? h("div", { class: "dlg-flags", text: flags.map((f) => `${f}: ${D.flag_legend[f]}`).join(" · ") } ) : null);
    dlg.append(body);
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    if (!fromHash) history.replaceState(null, "", `#task/${key}`);
  }
  dlg.addEventListener("close", () => { hideTip(); if (location.hash.startsWith("#task/")) history.replaceState(null, "", "#tasks"); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  function fromHash() { const m = location.hash.match(/^#task\/([\w-]+)/); if (m && TASK[m[1]]) openTask(m[1], true); }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
