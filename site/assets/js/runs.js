/* Runs: per-run submission log (runs.html#<task>/<model>) and a sortable table of all runs. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { D, MODELS, MODEL, TASK, STAGES, LEVELS, h, $, cap, fmt, withUnit } = X;
  const STATUS = { v: "scored", x: "failed checks", r: "rejected by integrity review", n: "infrastructure failure", w: "waiting" };

  $("#r-lede").textContent = `Every run in the October 23 cohort, submission by submission: ${D.summary.n_runs} runs and ${D.summary.n_submissions.toLocaleString("en-US")} judged submissions. Pick a task and a configuration to see what the judge returned over the run, or browse all runs below.`;

  const sel = $("#r-task");
  for (const stg of STAGES) {
    const og = h("optgroup", { label: cap(stg) });
    for (const lv of LEVELS) for (const t of D.tasks.filter((x) => x.stage === stg && x.level === lv)) og.append(h("option", { value: t.key, text: `${t.name} · ${lv}` }));
    sel.append(og);
  }
  const state = { task: "eagle3", model: "claude" };
  function parse() {
    const [k, m] = decodeURIComponent(location.hash.slice(1)).split("/");
    if (TASK[k]) state.task = k;
    if (m && MODELS.includes(m)) state.model = m;
    if (!TASK[state.task].results[state.model]) state.model = MODELS.find((x) => TASK[state.task].results[x]);
  }
  const go = () => history.replaceState(null, "", `#${state.task}/${state.model}`);
  sel.addEventListener("change", () => { state.task = sel.value; if (!TASK[state.task].results[state.model]) state.model = MODELS.find((x) => TASK[state.task].results[x]); go(); renderRun(); });

  function renderRun() {
    const t = TASK[state.task], r = t.results[state.model];
    sel.value = t.key;
    X.seg($("#r-model"), MODELS.filter((m) => t.results[m]).map((m) => [m, MODEL[m].short]), state.model, (v) => { state.model = v; go(); renderRun(); });
    $("#r-tasklink").href = X.taskHref(t.key);
    $("#r-tasklink").textContent = `${t.name} task page`;
    const c = r.counts;
    const k = [
      [r.best == null ? "—" : withUnit(t, r.best), `best during run${r.flag ? ` [${r.flag}]` : ""}${t.ranks[state.model] ? ` · rank ${X.ordinal(Math.round(t.ranks[state.model]))}` : ""}`],
      [r.best_at_h == null ? "—" : `${fmt(r.best_at_h, 2)} h`, "best reached at"],
      [r.first_valid_h == null ? "none" : `${fmt(r.first_valid_h, 2)} h`, "first valid score"],
      [`${r.n_sub}`, `submissions · ${c.valid} scored`],
      [`${c.invalid + c.rejected} / ${c.infrastructure + c.waiting}`, `failed or rejected / infra`],
    ];
    $("#r-kpis").replaceChildren(...k.map(([v, l]) => h("div", {}, h("b", { text: v }), h("span", { text: l }))));
    $("#r-chart").replaceChildren(X.trajChart(t, { W: 1000, H: 260, compact: false, dots: true, rug: true, models: [state.model] }));
    const log = $("#r-log");
    log.replaceChildren(h("thead", {}, h("tr", {}, ["#", "Time", "Status", "Score", "Best so far", "Change vs best"].map((x, i) => h("th", { scope: "col", class: i === 0 || i === 2 ? null : "n", text: x })))));
    const tb = h("tbody");
    let best = null;
    r.subs.forEach(([tt, v, code], i) => {
      let delta = "";
      if (v != null) {
        delta = best == null ? "first valid" : v > best ? `+${((v / best - 1) * 100).toFixed(1)}%` : `${((v / best - 1) * 100).toFixed(1)}%`;
        if (best == null || v > best) best = v;
      }
      tb.append(h("tr", {}, h("td", { class: "muted", text: i + 1 }), h("td", { class: "n", text: `${fmt(tt, 2)} h` }),
        h("td", {}, h("span", { class: `status ${code}`, text: STATUS[code] })),
        h("td", { class: "n", text: v == null ? "—" : fmt(v) }), h("td", { class: "n", text: best == null ? "—" : fmt(best) }),
        h("td", { class: "n", text: delta })));
    });
    if (!r.subs.length) tb.append(h("tr", {}, h("td", { colspan: 6, class: "muted", text: "No submissions were recorded for this run." })));
    log.append(tb);
  }

  /* ---------- all runs ---------- */
  const rows = D.tasks.flatMap((t) => Object.entries(t.results).map(([m, r]) => ({
    t, m, task: t.name, model: MODEL[m].name, best: r.best, rank: t.ranks[m], at: r.best_at_h,
    first: r.first_valid_h, scored: r.counts.valid, failed: r.counts.invalid, rejected: r.counts.rejected, infra: r.counts.infrastructure + r.counts.waiting, len: r.elapsed_h,
  })));
  const COLS = [["task", "Task"], ["model", "Configuration"], ["best", "Best during run"], ["rank", "Rank"], ["at", "Best at (h)"], ["first", "First valid (h)"], ["scored", "Scored"], ["failed", "Failed"], ["rejected", "Rejected"], ["infra", "Infra"], ["len", "Run length (h)"]];
  const sort = { key: null, dir: 1 };
  const filt = { model: "all", q: "" };
  X.seg($("#all-model"), [["all", "All"], ...MODELS.map((m) => [m, MODEL[m].short])], "all", (v) => { filt.model = v; renderAll(); });
  $("#all-q").addEventListener("input", (e) => { filt.q = e.target.value.trim().toLowerCase(); renderAll(); });
  function renderAll() {
    const tbl = $("#all-runs");
    tbl.replaceChildren(h("thead", {}, h("tr", {}, COLS.map(([k, label], i) => {
      const th = h("th", { scope: "col", class: `sortable${i > 1 ? " n" : ""}`, tabindex: 0, "aria-sort": sort.key === k ? (sort.dir > 0 ? "ascending" : "descending") : null, text: label + (sort.key === k ? (sort.dir > 0 ? " ↑" : " ↓") : "") });
      const act = () => { sort.dir = sort.key === k ? -sort.dir : i > 1 && k !== "rank" ? -1 : 1; sort.key = k; renderAll(); };
      th.addEventListener("click", act); th.addEventListener("keydown", (e) => { if (e.key === "Enter") act(); });
      return th;
    }))));
    let list = rows.filter((r) => (filt.model === "all" || r.m === filt.model) && (!filt.q || r.task.toLowerCase().includes(filt.q)));
    if (sort.key) list = [...list].sort((a, b) => { const x = a[sort.key], y = b[sort.key]; if (x == null) return 1; if (y == null) return -1; return (typeof x === "string" ? x.localeCompare(y) : x - y) * sort.dir; });
    const tb = h("tbody");
    for (const r of list) {
      const open = () => { state.task = r.t.key; state.model = r.m; go(); renderRun(); $("#explorer").scrollIntoView({ behavior: X.reduceMotion ? "auto" : "smooth" }); };
      tb.append(h("tr", { class: "rowlink", tabindex: 0, onclick: open, onkeydown: (e) => { if (e.key === "Enter") open(); } },
        h("td", { text: r.task }), h("td", {}, X.who(r.m, MODEL[r.m].short)),
        h("td", { class: "n", text: fmt(r.best) }), h("td", { class: "n", text: X.ordinal(Math.round(r.rank)) }),
        h("td", { class: "n", text: r.at == null ? "—" : fmt(r.at, 2) }), h("td", { class: "n", text: r.first == null ? "—" : fmt(r.first, 2) }),
        h("td", { class: "n", text: r.scored }), h("td", { class: "n", text: r.failed }), h("td", { class: "n", text: r.rejected }), h("td", { class: "n", text: r.infra }),
        h("td", { class: "n", text: fmt(r.len, 1) })));
    }
    tbl.append(tb);
    $("#all-foot").textContent = `${list.length} of ${rows.length} runs. Failed: the candidate did not pass the task's checks. Rejected: blocked by the integrity review before benchmarking. Infra: the evaluation infrastructure failed and the submission was not scored.`;
  }
  parse();
  renderRun();
  renderAll();
  window.addEventListener("hashchange", () => { parse(); renderRun(); });
})();
