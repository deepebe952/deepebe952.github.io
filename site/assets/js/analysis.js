/* Agent Behavior Analysis: paper Section 5, Figures 8–11. */
(() => {
  "use strict";
  const X = window.IX, F = window.INFRATHON_BEHAVIOR;
  if (!X || !F) return;
  const { D, MODEL, COLOR, C, TASK, s, st, h, $, fmt, pct, cap, unitOf } = X;
  const beforeColor = COLOR.claude, afterColor = COLOR.qwen;
  const splitColors = { 1: COLOR.sol, 2: COLOR.deepseek, 4: COLOR.qwen };
  const approx = (value, dp = 3) => `≈${fmt(value, dp)}`;

  // Preserve links to the previous analysis layout without adding extra sections.
  const oldLinks = { trajectories: "index.html#results", ranking: "index.html#leaderboard", stability: "index.html#leaderboard", efficiency: "index.html#leaderboard", behavior: "#improvement" };
  const redirect = () => { const target = oldLinks[location.hash.slice(1)]; if (target) location.replace(target); };
  redirect();
  window.addEventListener("hashchange", redirect);

  function tooltip(el, title, rows, note = "") {
    const show = (e) => { const b = el.getBoundingClientRect(); X.showTip(e.clientX ?? b.left, e.clientY ?? b.top, title, rows, note); };
    el.addEventListener("pointermove", show); el.addEventListener("focus", show);
    el.addEventListener("pointerleave", X.hideTip); el.addEventListener("blur", X.hideTip);
    el.addEventListener("keydown", (e) => { if (e.key === "Escape") X.hideTip(); });
  }
  function interactive(parent, title, rows, note) {
    const g = s("g", { tabindex: 0, class: "behavior-mark", "aria-label": `${title}: ${rows.map((r) => `${r.label} ${r.value}`).join(", ")}` }, parent);
    tooltip(g, title, rows, note);
    return g;
  }
  function legend(el, entries) {
    for (const [label, color] of entries) el.append(h("span", {}, h("i", { style: `--legend-color:${color}`, "aria-hidden": "true" }), label));
  }
  function plot(selector, render) {
    const box = typeof selector === "string" ? $(selector) : selector;
    let width = 0;
    const draw = () => {
      const next = Math.max(240, Math.round(box.getBoundingClientRect().width));
      if (next === width) return;
      width = next;
      box.replaceChildren(render(width));
    };
    draw();
    new ResizeObserver(draw).observe(box);
  }
  function canvas(W, H, title) { return s("svg", { viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": title }); }
  function text(svg, x, y, value, attrs = {}) { return st(svg, x, y, value, { fill: C.ink3, "font-size": 10, ...attrs }); }
  function yAxis(svg, ticks, ys, L, R, format = (v) => String(v)) {
    for (const value of ticks) {
      s("line", { x1: L, x2: R, y1: ys(value), y2: ys(value), stroke: C.hair }, svg);
      text(svg, L - 8, ys(value) + 3, format(value), { "text-anchor": "end" });
    }
  }

  /* Figure 8a: printed differences, in 10^-3 nats. */
  const logprobBox = $("#logprob-chart");
  logprobBox.append(h("div", { class: "logprob-axis", "aria-hidden": "true" }, h("span"), h("span", {}, h("span", { text: "0" }), h("span", { text: "20" })), h("span")));
  for (const row of F.fig8.logprob) {
    const color = row.breadth_one ? COLOR.claude : COLOR.qwen;
    const el = h("div", { class: `logprob-row${row.breadth_one ? " breadth-one" : ""}`, tabindex: 0, "aria-label": `${row.label}: ${row.difference_millinats} millinats` },
      h("span", { text: row.label }), h("span", { class: "logprob-line", "aria-hidden": "true" }, h("i", { style: `width:${row.difference_millinats / 20 * 100}%;--log-color:${color}` })), h("b", { text: fmt(row.difference_millinats, 2) }));
    tooltip(el, row.label, [{ color, value: `${fmt(row.difference_millinats, 2)} × 10⁻³ nats`, label: "Mean absolute difference" }]);
    logprobBox.append(el);
  }
  logprobBox.append(h("p", { class: "logprob-unit", text: "Mean absolute difference (10⁻³ nats)" }));

  /* Figure 8b: 11 fixtures for each of two configurations. */
  $("#fixture-legend").append(X.who("claude", "Claude"), X.who("deepseek", "DeepSeek"));
  plot("#fixture-chart", (W) => {
    const H = 290, L = 38, R = W - 12, T = 30, B = H - 43;
    const svg = canvas(W, H, "Attn-QAT: error divided by tolerance on eleven local fixtures");
    const xs = (i) => L + 10 + i / 10 * (R - L - 20), ys = (v) => B - v / 1.2 * (B - T);
    yAxis(svg, [0, .5, 1], ys, L, R, (v) => fmt(v, 1));
    text(svg, L, 15, "Worst reported error / tolerance");
    s("line", { x1: L, x2: R, y1: ys(1), y2: ys(1), stroke: C.ink3, "stroke-dasharray": "4 4" }, svg);
    text(svg, (L + R) / 2, ys(1) - 9, "Numerical pass threshold", { "text-anchor": "middle" });
    for (let i = 0; i < 11; i++) text(svg, xs(i), B + 17, i + 1, { "text-anchor": "middle" });
    text(svg, (L + R) / 2, H - 6, "Disclosed edge fixture", { "text-anchor": "middle" });
    for (const [m, values] of Object.entries(F.fig8.error_tolerance_ratio)) values.forEach((value, i) => {
      const g = interactive(svg, `${MODEL[m].short} · fixture ${i + 1}`, [{ color: COLOR[m], value: approx(value), label: "Error / tolerance" }], "Figure 8b · approximate vector-derived value");
      X.marker(g, m, xs(i) + (m === "claude" ? -2.5 : 2.5), ys(value), 4.1, { ringW: 1 });
    });
    return svg;
  });

  /* Figure 9a: source tile constants change public forward latency. */
  document.querySelectorAll(".repair-legend").forEach((el) => legend(el, [["Before repair", beforeColor], ["After repair", afterColor]]));
  plot("#latency-chart", (W) => {
    const H = 270, L = 39, R = W - 10, T = 30, B = H - 35, max = 88;
    const svg = canvas(W, H, "GLM Attn-QAT public median latency before and after repair");
    const ys = (v) => B - v / max * (B - T), groupW = (R - L) / 2, barW = Math.min(40, groupW * .27);
    yAxis(svg, [0, 20, 40, 60, 80], ys, L, R);
    text(svg, L, 15, "Public median latency (ms)");
    F.fig9.latency_ms.forEach((row, i) => {
      const mid = L + groupW * (i + .5);
      text(svg, mid, B + 23, row.label, { "text-anchor": "middle", fill: C.ink2, "font-size": 11 });
      for (const [key, offset, color] of [["before", -barW - 2, beforeColor], ["after", 2, afterColor]]) {
        const x = mid + offset, value = row[key];
        const g = interactive(svg, `${row.label} · ${key === "before" ? "before" : "after"} repair`, [{ color, value: `${fmt(value, 2)} ms`, label: "Public median latency" }]);
        s("rect", { x, y: ys(value), width: barW, height: B - ys(value), rx: 2, fill: color, "fill-opacity": .8 }, g);
        text(g, x + barW / 2, ys(value) - 9, fmt(value, 2), { "text-anchor": "middle", fill: C.ink, "font-size": 10 });
      }
      const g = interactive(svg, `${row.label} · second pre-repair measurement`, [{ color: beforeColor, value: `${approx(row.repeat_before, 2)} ms`, label: "Public median latency" }]);
      s("circle", { cx: mid - barW / 2 - 2, cy: ys(row.repeat_before), r: 4, fill: C.panel, stroke: beforeColor, "stroke-width": 1.7 }, g);
    });
    return svg;
  });

  /* Figure 9b: cache-key repair halves launches in three kernel families. */
  plot("#launches-chart", (W) => {
    const H = 270, L = W < 360 ? 75 : 109, R = W - 45, T = 35, B = H - 34;
    const svg = canvas(W, H, "DeepSeek LLaDA GPU launches before and after repair");
    const xs = (v) => L + v / 11000 * (R - L);
    text(svg, L, 15, "GPU launches / decoding case");
    for (const v of [0, 5000, 10000]) {
      s("line", { x1: xs(v), x2: xs(v), y1: T - 4, y2: B, stroke: C.hair }, svg);
      text(svg, xs(v), B + 20, v ? `${v / 1000}k` : "0", { "text-anchor": "middle" });
    }
    F.fig9.launches.forEach((row, i) => {
      const y = T + i * 65;
      const label = row.label === "Residual + norm" && W < 360 ? ["Residual", "+ norm"] : [row.label];
      label.forEach((v, j) => text(svg, L - 9, y + 21 + j * 13 - (label.length > 1 ? 6 : 0), v, { "text-anchor": "end", fill: C.ink2, "font-size": 11 }));
      for (const [key, offset, color] of [["before", 0, beforeColor], ["after", 22, afterColor]]) {
        const value = row[key], g = interactive(svg, `${row.label} · ${key} repair`, [{ color, value: fmt(value, 0), label: "GPU launches" }]);
        s("rect", { x: L, y: y + offset, width: xs(value) - L, height: 17, rx: 2, fill: color, "fill-opacity": .8 }, g);
        text(g, xs(value) + 5, y + offset + 12, fmt(value, 0), { fill: C.ink, "font-size": 10 });
      }
    });
    return svg;
  });

  /* Figure 10: all plotted split variants and their two process measurements. */
  legend($("#split-legend"), [1, 2, 4].map((n) => [`Split = ${n}`, splitColors[n]]));
  for (const [i, panel] of F.fig10.panels.entries()) {
    const chart = h("div", { class: "behavior-plot" });
    $("#workload-panels").append(h("div", { class: "workload-panel" }, h("h4", { text: `${String.fromCharCode(97 + i)} · ${panel.title}` }), h("p", { text: panel.shape }), chart));
    plot(chart, (W) => {
      const H = 260, L = 38, R = W - 18, T = 29, B = H - 47;
      const maximum = Math.max(...panel.variants.flatMap((v) => v.process_medians_ms.flat())) * 1.12;
      const ticks = i === 0 ? [0, 2.5, 5, 7.5] : i === 1 ? [0, .25, .5, .75] : [0, .8, 1.6, 2.4];
      const svg = canvas(W, H, `Flash-KMeans: ${panel.title}`), xs = (j) => L + 19 + j * (R - L - 38), ys = (v) => B - v / maximum * (B - T);
      yAxis(svg, ticks, ys, L, R);
      text(svg, L, 14, "Update latency (ms)");
      ["Balanced labels", "Assigned labels"].forEach((label, j) => {
        const words = label.split(" ");
        text(svg, xs(j), B + 19, words[0], { "text-anchor": "middle" });
        text(svg, xs(j), B + 32, words[1], { "text-anchor": "middle" });
      });
      for (const variant of panel.variants) {
        const color = splitColors[variant.split], values = variant.medians_ms;
        s("line", { x1: xs(0), x2: xs(1), y1: ys(values[0]), y2: ys(values[1]), stroke: color, "stroke-width": 2 }, svg);
        values.forEach((value, j) => {
          const g = interactive(svg, `Split ${variant.split} · ${j ? "assigned" : "balanced"} labels`, [{ color, value: `${approx(value)} ms`, label: "Across-process median" }, ...variant.process_medians_ms[j].map((v, k) => ({ color, value: `${approx(v)} ms`, label: `Process ${k + 1} median` }))], "Figure 10 · approximate vector-derived values");
          variant.process_medians_ms[j].forEach((v, k) => s("line", { x1: xs(j) + (k ? 4 : -4), x2: xs(j) + (k ? 4 : -4), y1: ys(v) - 4, y2: ys(v) + 4, stroke: color, "stroke-width": 1.5 }, g));
          s("circle", { cx: xs(j), cy: ys(value), r: 4, fill: color, stroke: C.panel, "stroke-width": 1.4 }, g);
        });
      }
      return svg;
    });
  }

  /* Figure 11: printed scores and run counts; independent of the current ranking. */
  const behavior = D.tokens.behavior;
  for (const row of behavior.completion) {
    const { model: m, task: key, before, after } = row, t = TASK[key], gain = (after / before - 1) * 100;
    $("#completion-gains").append(h("a", { class: "gain-example", href: X.taskHref(key), style: `--case-color:${COLOR[m]}` },
      h("div", { class: "gain-heading" }, h("div", {}, h("b", { text: { sageattention: "SageAttention", gkd: "GKD", sd35: "SD3.5" }[key] }), h("span", { text: `${MODEL[m].short} · ${cap(t.level)}` })), h("strong", { text: `+${fmt(gain, 1)}%` })),
      h("div", { class: "gain-track", "aria-hidden": "true" }, h("span", { style: `width:${gain / 30 * 100}%` })),
      h("div", { class: "gain-scores" }, h("span", {}, h("small", { text: "At completion" }), h("b", { text: fmt(before, 2) })), h("span", { class: "gain-arrow", "aria-hidden": "true", text: "→" }), h("span", {}, h("small", { text: "After code changes" }), h("b", { text: `${fmt(after, 2)} ${unitOf(t)}` })))));
  }
  const repeatBox = $("#repeat-comparison"), categories = ["No repeats", "Some repeats (≤50%)", "Mostly repeats (>50%)"];
  behavior.halves.forEach((half) => {
    const row = h("div", { class: "repeat-half" }, h("div", { class: "repeat-heading" }, h("b", { text: half.label }), h("span", { text: `${behavior.n_runs} runs` })));
    const bar = h("div", { class: "repeat-stack", role: "group", "aria-label": half.label });
    half.counts.forEach((n, i) => {
      const label = `${categories[i]}: ${n} of ${behavior.n_runs} runs`;
      const segment = h("button", { type: "button", class: `repeat-segment repeat-${i}`, style: `flex:${n}`, "aria-label": label, text: n >= 10 ? String(n) : "" });
      tooltip(segment, half.label, [{ color: [C.hair2, COLOR.astra, COLOR.claude][i], value: `${n} runs · ${pct(n / behavior.n_runs, 1)}`, label: categories[i] }]);
      bar.append(segment);
    });
    row.append(bar, h("div", { class: "repeat-counts" }, half.counts.map((n, i) => h("span", { class: `repeat-count repeat-${i}` }, h("i", { "aria-hidden": "true" }), `${n} ${["none", "some", "mostly"][i]}`))));
    repeatBox.append(row);
  });
  repeatBox.append(h("div", { class: "repeat-legend" }, categories.map((label, i) => h("span", { class: `repeat-count repeat-${i}` }, h("i", { "aria-hidden": "true" }), label))),
    h("div", { class: "repeat-kpi" }, h("div", {}, h("strong", { text: `${behavior.pooled_pct[0]}% → ${behavior.pooled_pct[1]}%` }), h("p", { text: "Pooled repeated-content share of submissions" }))));
})();
