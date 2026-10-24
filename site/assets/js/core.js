/* Infrathon shared code: data access, rank math, marks, charts and site chrome. */
window.IX = (() => {
  "use strict";
  const D = window.INFRATHON;
  const K = 6;
  const MODELS = D.models.map((m) => m.key);
  const MODEL = Object.fromEntries(D.models.map((m) => [m.key, m]));
  const PROVIDER = { sol: "OpenAI", claude: "Anthropic", qwen: "Alibaba", deepseek: "DeepSeek", glm: "Zhipu AI", astra: "OpenAI" };
  // Mirrors the --m-* tokens in site.css (SVG presentation attributes cannot read CSS variables).
  const COLOR = { sol: "#3987e5", claude: "#d95926", qwen: "#199e70", deepseek: "#c98500", glm: "#d55181", astra: "#9085e9" };
  const SHAPE = { sol: "circle", claude: "square", qwen: "triangle", deepseek: "diamond", glm: "tridown", astra: "plus" };
  const C = { ink: "#ededef", ink2: "#a3a8b1", ink3: "#777d88", hair: "rgba(255,255,255,0.07)", hair2: "rgba(255,255,255,0.13)", panel: "#0c0e11", bg: "#060709", crit: "#d03b3b" };
  const TASK = Object.fromEntries(D.tasks.map((t) => [t.key, t]));
  const STAGES = ["training", "inference"];
  const LEVELS = ["operator", "module", "system"];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);

  /* ---------- DOM ---------- */
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

  /* ---------- formatting ---------- */
  function fmt(v, dp) {
    if (v == null || !isFinite(v)) return "—";
    const a = Math.abs(v);
    const d = dp != null ? dp : a >= 1000 ? 0 : a >= 100 ? 1 : 2;
    return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  const UNIT = { TFLOPS: "TFLOPS", "GB/s": "GB/s", "tok/s": "tok/s", FPS: "FPS", "steps/min": "steps/min", Ratio: "×", Fidelity: "pts", "Rel. accuracy": "pts", Score: "" };
  const unitOf = (t) => (t.key === "flash-kmeans" ? "TFLOP/s" : UNIT[t.metric] ?? "");
  function withUnit(t, v, dp) { const u = unitOf(t); if (v == null) return "—"; return u === "×" ? fmt(v, dp) + "×" : u ? `${fmt(v, dp)} ${u}` : fmt(v, dp); }
  const metricLabel = (t) => ({
    TFLOPS: t.key === "flash-kmeans" ? "Equivalent TFLOP/s" : "TFLOPS", Score: "Task score", Ratio: "Compression ratio",
    Fidelity: "Fidelity points", "Rel. accuracy": "Relative accuracy", "tok/s": "Tokens / s", FPS: "Latency-weighted FPS",
    "steps/min": "Valid steps / min", "GB/s": "Bandwidth (GB/s)",
  }[t.metric] || t.metric);
  const ordinal = (n) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);
  const pct = (x, dp = 0) => `${(x * 100).toFixed(dp)}%`;
  const taskHref = (key) => `task.html#${key}`;
  const runHref = (key, m) => `runs.html#${key}/${m}`;
  const groupName = (t) => `${cap(t.stage)} · ${cap(t.level)}`;
  const xhighTasks = (m) => D.tasks.filter((t) => t.results[m]?.effort === "xhigh");
  const effortNote = (m) => { const n = xhighTasks(m).length; return n ? `effort max · xhigh on ${n}` : "effort max"; };

  /* ---------- marks ---------- */
  function marker(parent, key, x, y, r, opts) {
    const o = Object.assign({ fill: COLOR[key], ring: C.panel, ringW: 2 }, opts || {});
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
    marker(svg, key, 6, 6, 4.2, { ringW: 0 });
    return svg;
  }
  const who = (m, label) => h("span", { class: "who" }, swatch(m), label ?? MODEL[m].name);

  /* ---------- tooltip ---------- */
  let tip;
  function showTip(x, y, title, rows, note) {
    if (!tip) { tip = h("div", { id: "tip", role: "status" }); document.body.append(tip); }
    tip.replaceChildren();
    if (title) tip.append(h("div", { class: "t", text: title }));
    for (const r of rows) tip.append(h("div", { class: "r" }, h("span", { class: "lk", style: `background:${r.color || C.ink3}` }), h("b", { text: r.value }), h("span", { text: r.label })));
    if (note) tip.append(h("div", { class: "note", text: note }));
    tip.hidden = false;
    const b = tip.getBoundingClientRect();
    let L = x + 16, T = y + 14;
    if (L + b.width > innerWidth - 8) L = x - b.width - 16;
    if (T + b.height > innerHeight - 8) T = y - b.height - 14;
    tip.style.left = `${Math.max(8, L)}px`;
    tip.style.top = `${Math.max(8, T)}px`;
  }
  const hideTip = () => { if (tip) tip.hidden = true; };

  /* ---------- rank math ---------- */
  const filterTasks = (ts, stage, level) => ts.filter((t) => (stage === "all" || t.stage === stage) && (level === "all" || t.level === level));
  function rankScores(ts) {
    const out = {};
    for (const m of MODELS) {
      const v = ts.filter((t) => m in t.contrib).map((t) => t.contrib[m]);
      out[m] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    }
    return out;
  }
  function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function bootstrap(ts, B = 3000) {
    const rnd = mulberry32(20261023), sm = {}, first = {};
    MODELS.forEach((m) => { sm[m] = []; first[m] = 0; });
    for (let b = 0; b < B; b++) {
      const pick = ts.map(() => ts[Math.floor(rnd() * ts.length)]);
      const rs = rankScores(pick);
      const vals = MODELS.map((m) => rs[m]).filter((v) => v != null), top = Math.max(...vals);
      for (const m of MODELS) if (rs[m] != null) { sm[m].push(rs[m]); if (rs[m] === top) first[m]++; }
    }
    const q = (xs, p) => { if (!xs.length) return null; const a = [...xs].sort((x, y) => x - y), i = (a.length - 1) * p, lo = Math.floor(i); return a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (i - lo); };
    return Object.fromEntries(MODELS.map((m) => [m, { lo: q(sm[m], 0.025), hi: q(sm[m], 0.975), p1: first[m] / B }]));
  }
  function standings(ts) {
    const rs = rankScores(ts), bs = bootstrap(ts);
    return MODELS.map((m) => {
      const cov = ts.filter((t) => m in t.ranks);
      const rel = cov.length ? cov.reduce((a, t) => a + (t.results[m].best || 0) / Math.max(...Object.keys(t.ranks).map((o) => t.results[o].best || 0)), 0) / cov.length : null;
      return { m, score: rs[m], ci: bs[m], wins: cov.filter((t) => t.ranks[m] === 1).length, rel, cov: cov.length, n: ts.length };
    }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }

  /* ---------- scales ---------- */
  function niceTicks(lo, hi, n = 4) {
    if (!(hi > lo)) hi = lo + 1;
    const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) || 10 * mag;
    const t0 = Math.floor(lo / step) * step, t1 = Math.ceil(hi / step) * step, out = [];
    for (let v = t0; v <= t1 + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  const bestAt = (traj, t) => { let v = null; for (const [x, y] of traj) { if (x <= t + 1e-9) v = y; else break; } return v; };

  /* ---------- legend focus ---------- */
  let focusModel = null;
  const focusListeners = [];
  function makeLegend(el) {
    for (const m of MODELS) {
      const b = h("button", { type: "button", "aria-pressed": "false", "data-m": m }, swatch(m), MODEL[m].name);
      b.addEventListener("click", () => setFocus(focusModel === m ? null : m));
      el.append(b);
    }
  }
  function setFocus(m) {
    focusModel = m;
    document.querySelectorAll(".legend button[data-m]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
    focusListeners.forEach((f) => f());
  }

  /* ---------- best-so-far chart ---------- */
  function trajChart(t, opts) {
    const o = Object.assign({ W: 320, H: 170, compact: true, dots: false, rug: false, models: null, tooltip: true }, opts);
    const pad = { l: o.compact ? 38 : 54, r: 12, t: 10, b: o.compact ? 22 : 30 };
    const svg = s("svg", { viewBox: `0 0 ${o.W} ${o.H}`, role: "img", "aria-label": `Best score so far over time for ${t.name} (${metricLabel(t)})` });
    const runs = (o.models || MODELS).filter((m) => t.results[m]);
    const vals = runs.flatMap((m) => (o.dots ? t.results[m].subs.filter((x) => x[1] != null).map((x) => x[1]) : t.results[m].traj.map((p) => p[1])));
    if (!vals.length) { st(svg, o.W / 2, o.H / 2, "no valid scores", { fill: C.ink3, "font-size": 11, "text-anchor": "middle" }); return svg; }
    const vmin = Math.min(...vals), vmax = Math.max(...vals);
    const padV = (vmax - vmin) * 0.08 || Math.abs(vmax) * 0.05 || 1;
    const ticks = niceTicks(vmin >= 0 ? Math.max(0, vmin - padV) : vmin - padV, vmax + padV, o.compact ? 3 : 4);
    const lo = ticks[0], hi = ticks[ticks.length - 1];
    const T = t.budget_h, X0 = pad.l, X1 = o.W - pad.r, Y0 = o.H - pad.b, Y1 = pad.t;
    const xs = (x) => X0 + (Math.min(x, T) / T) * (X1 - X0), ys = (v) => Y0 - ((v - lo) / (hi - lo)) * (Y0 - Y1);
    const fs = o.compact ? 10.5 : 11;
    for (const v of ticks) {
      s("line", { x1: X0, x2: X1, y1: ys(v), y2: ys(v), stroke: C.hair, "stroke-width": 1 }, svg);
      st(svg, X0 - 6, ys(v) + 3.5, fmt(v, Math.abs(hi - lo) < 5 ? 1 : 0), { fill: C.ink3, "font-size": fs, "text-anchor": "end" });
    }
    s("line", { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: C.hair2, "stroke-width": 1 }, svg);
    const xstep = T === 12 ? (o.compact ? 4 : 2) : o.compact ? 8 : 4;
    for (let x = 0; x <= T; x += xstep) st(svg, xs(x), Y0 + (o.compact ? 14 : 17), `${x}h`, { fill: C.ink3, "font-size": fs, "text-anchor": "middle" });
    const layers = {};
    for (const m of runs) {
      const r = t.results[m], g = s("g", {}, svg);
      layers[m] = g;
      if (o.dots) for (const [x, v] of r.subs) if (v != null) s("circle", { cx: xs(x), cy: ys(v), r: 2.3, fill: COLOR[m], "fill-opacity": 0.35 }, g);
      if (!r.traj.length) continue;
      // The best known score carries forward through the full task budget.
      const end = T;
      let d = `M${xs(r.traj[0][0]).toFixed(1)},${ys(r.traj[0][1]).toFixed(1)}`;
      for (let k = 1; k < r.traj.length; k++) d += `H${xs(r.traj[k][0]).toFixed(1)}V${ys(r.traj[k][1]).toFixed(1)}`;
      d += `H${xs(end).toFixed(1)}`;
      s("path", { d, fill: "none", stroke: COLOR[m], "stroke-width": o.compact ? 1.6 : 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
      marker(g, m, xs(end), ys(r.traj[r.traj.length - 1][1]), o.compact ? 3.4 : 4.2, { ring: o.ring || C.panel });
    }
    if (o.rug) for (const m of runs) for (const [x, , c] of t.results[m].subs) {
      if (c === "v") continue;
      s("line", { x1: xs(x), x2: xs(x), y1: Y0 - 5, y2: Y0, stroke: c === "x" || c === "r" ? C.crit : C.ink3, "stroke-width": 1.4, "stroke-dasharray": c === "x" || c === "r" ? null : "1.5 1.5" }, svg);
    }
    const applyFocus = () => { for (const m of runs) layers[m].setAttribute("opacity", !focusModel || focusModel === m ? 1 : 0.13); };
    applyFocus();
    focusListeners.push(applyFocus);
    if (!o.tooltip) return svg;
    const cross = s("line", { x1: 0, x2: 0, y1: Y1, y2: Y0, stroke: C.ink2, "stroke-width": 1, visibility: "hidden" }, svg);
    s("rect", { x: X0, y: Y1, width: X1 - X0, height: Y0 - Y1, fill: "transparent" }, svg);
    svg.addEventListener("pointermove", (e) => {
      const p = svg.getBoundingClientRect(), x = ((e.clientX - p.left) / p.width) * o.W;
      if (x < X0 || x > X1) { cross.setAttribute("visibility", "hidden"); hideTip(); return; }
      const tt = ((x - X0) / (X1 - X0)) * T;
      cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
      const rows = runs.map((m) => ({ m, v: bestAt(t.results[m].traj, tt) }))
        .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity))
        .map(({ m, v }) => ({ color: COLOR[m], value: v == null ? "—" : withUnit(t, v), label: MODEL[m].name }));
      showTip(e.clientX, e.clientY, `${t.name} · ${fmt(tt, 1)} h`, rows, "best valid score so far");
    });
    svg.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); hideTip(); });
    return svg;
  }

  /* ---------- run trace: one lane per configuration ---------- */
  function traceChart(t, animate) {
    const W = 1000, laneH = 46, top = 22, X0 = 168, X1 = 862, H = top + K * laneH + 30, T = t.budget_h;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Run trace for ${t.name}: every submission and the best score so far over ${T} hours, one lane per configuration.` });
    const xs = (v) => X0 + (Math.min(v, T) / T) * (X1 - X0);
    const vals = MODELS.flatMap((m) => (t.results[m]?.traj || []).map((p) => p[1]));
    const vmin = Math.min(...vals), vmax = Math.max(...vals);
    const step = T === 12 ? 2 : 4;
    for (let x = 0; x <= T; x += step) {
      s("line", { x1: xs(x), x2: xs(x), y1: top - 6, y2: top + K * laneH, stroke: C.hair, "stroke-width": 1 }, svg);
      st(svg, xs(x), H - 8, `${x}h`, { fill: C.ink3, "font-size": 11, "text-anchor": "middle" });
    }
    st(svg, W - 6, top - 8, "best so far", { fill: C.ink3, "font-size": 10.5, "text-anchor": "end" });
    const clipId = `clip-${t.key}-${Math.random().toString(36).slice(2, 7)}`;
    const clipRect = s("rect", { x: 0, y: 0, width: X0, height: H }, s("clipPath", { id: clipId }, s("defs", {}, svg)));
    const read = {};
    MODELS.forEach((m, i) => {
      const y0 = top + i * laneH, base = y0 + 34, hi = y0 + 6, r = t.results[m];
      s("line", { x1: X0, x2: X1, y1: base, y2: base, stroke: C.hair2, "stroke-width": 1 }, svg);
      marker(svg, m, 14, y0 + 22, 4.5);
      st(svg, 28, y0 + 26, MODEL[m].name, { fill: r ? C.ink : C.ink3, "font-size": 13, style: "font-family:var(--f-sans)" });
      if (!r) { st(svg, X0 + 8, y0 + 26, "no run in this cohort", { fill: C.ink3, "font-size": 11 }); return; }
      const g = s("g", { "clip-path": `url(#${clipId})` }, svg);
      const yv = (v) => (vmax > vmin ? base - ((v - vmin) / (vmax - vmin)) * (base - hi - 4) - 4 : base - 14);
      if (r.traj.length) {
        let d = `M${xs(r.traj[0][0]).toFixed(1)},${yv(r.traj[0][1]).toFixed(1)}`;
        for (let k = 1; k < r.traj.length; k++) d += `H${xs(r.traj[k][0]).toFixed(1)}V${yv(r.traj[k][1]).toFixed(1)}`;
        d += `H${xs(T).toFixed(1)}`;
        s("path", { d: `${d}V${base}H${xs(r.traj[0][0]).toFixed(1)}Z`, fill: COLOR[m], "fill-opacity": 0.16 }, g);
        s("path", { d, fill: "none", stroke: COLOR[m], "stroke-width": 2, "stroke-linejoin": "round" }, g);
      }
      for (const [x, , c] of r.subs) {
        const X = xs(x);
        if (c === "r") s("rect", { x: X - 3, y: base + 3, width: 6, height: 6, fill: "none", stroke: C.crit, "stroke-width": 1.4 }, g);
        else s("line", { x1: X, x2: X, y1: base + 2, y2: base + 9, stroke: c === "x" ? C.crit : C.ink3, "stroke-width": c === "x" ? 1.6 : 1.2, "stroke-dasharray": c === "v" || c === "x" ? null : "1.5 1.5" }, g);
      }
      if ((r.elapsed_h ?? T) < T - 0.05) {
        s("line", { x1: xs(r.elapsed_h), x2: xs(r.elapsed_h), y1: y0 + 8, y2: base + 9, stroke: C.ink3, "stroke-width": 1 }, g);
        st(g, xs(r.elapsed_h) + 4, y0 + 14, `stopped ${fmt(r.elapsed_h, 1)} h`, { fill: C.ink3, "font-size": 10 });
      }
      read[m] = st(svg, W - 6, y0 + 26, "", { fill: C.ink, "font-size": 13, "text-anchor": "end", "font-weight": 500 });
    });
    const scan = s("line", { x1: X0, x2: X0, y1: top - 6, y2: top + K * laneH, stroke: C.ink, "stroke-width": 1, "stroke-opacity": 0.7 }, svg);
    const scanLabel = st(svg, X0, top - 9, "", { fill: C.ink2, "font-size": 10.5, "text-anchor": "middle" });
    function setTime(tt, showScan) {
      const X = xs(tt);
      clipRect.setAttribute("width", X + 1);
      scan.setAttribute("x1", X); scan.setAttribute("x2", X); scan.style.display = showScan ? "" : "none";
      scanLabel.setAttribute("x", Math.min(Math.max(X, X0 + 14), X1 - 14));
      scanLabel.textContent = showScan ? `${fmt(tt, 1)} h` : "";
      for (const m in read) {
        const r = t.results[m], v = bestAt(r.traj, tt);
        read[m].textContent = v == null ? (tt >= T - 1e-6 && !r.traj.length ? "no valid score" : "—") : withUnit(t, v);
        read[m].setAttribute("fill", v == null ? C.ink3 : C.ink);
      }
    }
    let anim = null, scrub = false;
    svg.addEventListener("pointermove", (e) => {
      const p = svg.getBoundingClientRect(), x = ((e.clientX - p.left) / p.width) * W;
      if (x < X0 || x > X1) return;
      scrub = true;
      if (anim) { cancelAnimationFrame(anim); anim = null; }
      setTime(((x - X0) / (X1 - X0)) * T, true);
    });
    svg.addEventListener("pointerleave", () => { if (scrub) setTime(T, false); scrub = false; });
    if (!animate || reduceMotion) setTime(T, false);
    else {
      const t0 = performance.now(), dur = 2800;
      const tick = (now) => { const p = Math.min(1, (now - t0) / dur), e = 1 - (1 - p) ** 3; setTime(e * T, p < 1); anim = p < 1 ? requestAnimationFrame(tick) : null; };
      anim = requestAnimationFrame(tick);
    }
    return svg;
  }

  /* ---------- small marks ---------- */
  function fingerprint(t, w = 120, hgt = 24) {
    const svg = s("svg", { class: "finger", viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: "none", "aria-hidden": "true" });
    const bests = MODELS.map((m) => t.results[m]?.best).filter((v) => v != null);
    const max = Math.max(...bests, 1e-9), bw = w / K;
    MODELS.forEach((m, i) => {
      const v = t.results[m]?.best, x = i * bw + 1.5;
      s("rect", { x, y: hgt - 1, width: bw - 3, height: 1, fill: C.hair2 }, svg);
      if (v == null || v === 0) return;
      const hh = Math.max(1.5, (v / max) * (hgt - 2));
      s("rect", { x, y: hgt - 1 - hh, width: bw - 3, height: hh, rx: 1.5, fill: COLOR[m], "fill-opacity": t.results[m].flag ? 0.35 : 0.95 }, svg);
    });
    return svg;
  }
  function hbar(color, frac, label, opts) {
    const o = Object.assign({ max: 70, dashed: false, faded: false }, opts);
    const svg = s("svg", { "aria-hidden": "true" });
    s("line", { x1: 0, x2: 0, y1: 2, y2: 20, stroke: C.hair2, "stroke-width": 1 }, svg);
    const w = Math.max(0, frac) * o.max;
    if (o.dashed) s("rect", { x: 0.75, y: 5.75, width: `${w}%`, height: 10.5, rx: 3, fill: "none", stroke: color, "stroke-width": 1.5, "stroke-dasharray": "3 2" }, svg);
    else if (w > 0) {
      s("rect", { x: 0, y: 5, width: `${w}%`, height: 12, rx: 4, fill: color, "fill-opacity": o.faded ? 0.4 : 1 }, svg);
      s("rect", { x: 0, y: 5, width: `${Math.min(w, 2)}%`, height: 12, fill: color, "fill-opacity": o.faded ? 0.4 : 1 }, svg);
    }
    st(svg, `${w}%`, 15, label, { dx: w > 0 ? 7 : 6, fill: o.muted ? C.ink3 : C.ink, "font-size": 11.5 });
    return svg;
  }

  /* ---------- chrome ---------- */
  const PAGES = [["index.html", "Leaderboard"], ["tasks.html", "Tasks"], ["analysis.html", "Analysis"], ["runs.html", "Runs"], ["method.html", "Method"]];
  function chrome() {
    const page = document.body.dataset.page;
    const logo = s("svg", { width: 22, height: 22, viewBox: "0 0 32 32", "aria-hidden": "true" });
    s("rect", { x: 1, y: 1, width: 30, height: 30, rx: 8, fill: "none", stroke: C.hair2 }, logo);
    s("path", { d: "M7 22h4v-8h4v5h4V9h4v10h3", fill: "none", stroke: C.ink, "stroke-width": 2.2, "stroke-linejoin": "round" }, logo);
    const nav = h("header", { class: "nav" }, h("div", { class: "wrap" },
      h("a", { class: "brand", href: "index.html", "aria-label": "Infrathon home" }, logo, "Infrathon", h("span", { class: "v", text: "v1" })),
      h("nav", { class: "nav-links", "aria-label": "Pages" }, PAGES.map(([href, label]) => h("a", { href, "aria-current": href.startsWith(page) ? "page" : null, text: label }))),
      h("div", { class: "nav-right" }, h("span", { class: "pill" }, h("span", { class: "dot" }), "Paper under review"))));
    document.body.prepend(nav);
    const foot = h("footer", { class: "site" }, h("div", { class: "wrap" },
      h("div", {}, h("div", { class: "brand" }, logo.cloneNode(true), "Infrathon"),
        h("p", { text: `Long-horizon AI infrastructure benchmark. Results from the ${D.snapshot.replace(/-/g, "/")} export: ${D.summary.n_runs} runs, ${D.summary.n_submissions.toLocaleString("en-US")} judged submissions.` })),
      h("div", {}, h("h4", { class: "label", text: "Explore" }), h("ul", {}, PAGES.map(([href, label]) => h("li", {}, h("a", { href, text: label }))))),
      h("div", {}, h("h4", { class: "label", text: "Paper" }), h("ul", {},
        h("li", { text: "Infrathon: Can Frontier Models Solve Long-Horizon AI Infrastructure Tasks?" }),
        h("li", {}, h("a", { href: "method.html#cite", text: "Citation" })),
        h("li", { class: "muted", text: "Under review" })))));
    document.body.append(foot);
  }

  function wireTabs(btnA, btnB, panelA, panelB) {
    const set = (on) => { $(btnA).setAttribute("aria-selected", String(on)); $(btnB).setAttribute("aria-selected", String(!on)); $(panelA).hidden = !on; $(panelB).hidden = on; };
    $(btnA).addEventListener("click", () => set(true));
    $(btnB).addEventListener("click", () => set(false));
  }
  function seg(el, options, value, onChange) {
    el.replaceChildren();
    for (const [v, label, n] of options) {
      el.append(h("button", { type: "button", "aria-pressed": String(v === value), onclick: () => { el.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v))); onChange(v); }, "data-v": v }, label, n != null ? h("span", { class: "n", text: n }) : null));
    }
  }

  chrome();
  return {
    D, K, MODELS, MODEL, PROVIDER, COLOR, C, TASK, STAGES, LEVELS, reduceMotion, cap,
    s, st, h, $, fmt, unitOf, withUnit, metricLabel, ordinal, pct, taskHref, runHref, groupName, xhighTasks, effortNote,
    marker, swatch, who, showTip, hideTip, filterTasks, rankScores, bootstrap, standings,
    niceTicks, bestAt, makeLegend, setFocus, trajChart, traceChart, fingerprint, hbar, wireTabs, seg,
  };
})();
