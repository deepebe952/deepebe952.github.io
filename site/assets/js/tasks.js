/* Tasks: filterable table of all 25 tasks. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODEL, STAGES, LEVELS, h, $, cap, withUnit, metricLabel } = X;
  const state = { stage: "all", level: "all", start: "all", q: "" };
  const match = (t) => (state.stage === "all" || t.stage === state.stage) && (state.level === "all" || t.level === state.level)
    && (state.start === "all" || t.start === state.start)
    && (!state.q || `${t.name} ${t.target} ${t.summary}`.toLowerCase().includes(state.q));
  const segs = () => {
    X.seg($("#f-stage"), [["all", "All"], ...STAGES.map((s) => [s, cap(s), D.tasks.filter((t) => t.stage === s).length])], state.stage, (v) => { state.stage = v; render(); });
    X.seg($("#f-level"), [["all", "All"], ...LEVELS.map((l) => [l, cap(l), D.tasks.filter((t) => t.level === l).length])], state.level, (v) => { state.level = v; render(); });
    X.seg($("#f-start"), [["all", "All"], ["seed", "Seed", D.tasks.filter((t) => t.start === "seed").length], ["scratch", "Scratch", D.tasks.filter((t) => t.start === "scratch").length]], state.start, (v) => { state.start = v; render(); });
  };
  $("#f-q").addEventListener("input", (e) => { state.q = e.target.value.trim().toLowerCase(); render(); });

  const tbl = $("#task-table");
  tbl.append(h("thead", {}, h("tr", {}, ["Task", "Category", "Budget", "Metric", "Start", "Best final", "All six finals", "Paper ranking"].map((x, i) => h("th", { scope: "col", class: i === 2 ? "n" : null, text: x })))));
  const tb = h("tbody");
  tbl.append(tb);
  function render() {
    tb.replaceChildren();
    const ts = D.tasks.filter(match);
    for (const t of ts) {
      const w = t.winner;
      tb.append(h("tr", { class: "rowlink", tabindex: 0, onclick: () => { location.href = X.taskHref(t.key); }, onkeydown: (e) => { if (e.key === "Enter") location.href = X.taskHref(t.key); } },
        h("td", {}, h("div", { class: "task-name" }, h("b", { text: t.name }), h("small", { text: t.target }))),
        h("td", { class: "muted", text: `${cap(t.stage)} · ${cap(t.level)}` }),
        h("td", { class: "n", text: `${t.budget_h} h` }),
        h("td", { class: "muted", text: metricLabel(t) }),
        h("td", {}, h("span", { class: "chip", text: t.start })),
        h("td", {}, X.who(w, `${MODEL[w].short} · ${withUnit(t, t.results[w].final)}`)),
        h("td", { title: "Final score of each configuration relative to the best (Sol, Claude, Qwen, DeepSeek, GLM, Astra)" }, X.fingerprint(t)),
        h("td", { class: "muted", text: t.ranked ? "ranked" : "excluded" })));
    }
    if (!ts.length) tb.append(h("tr", {}, h("td", { colspan: 8, class: "muted", text: "No task matches these filters." })));
    $("#task-foot").textContent = `${ts.length} of ${D.tasks.length} tasks. "Best final" uses every recorded final score; "Paper ranking" marks the 17 tasks with a comparable final for all six configurations. Bars: Sol, Claude, Qwen, DeepSeek, GLM, Astra, scaled to the best final on the task (faded = flagged result).`;
    segs();
  }
  render();
})();
