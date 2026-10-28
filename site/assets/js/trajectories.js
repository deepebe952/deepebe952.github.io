/* Task-specific run log: trajectories.html#<task>/<model>. */
(() => {
  "use strict";
  const X = window.IX;
  if (!X) return;
  const { MODELS, MODEL, TASK, h, $, fmt, withUnit } = X;
  const STATUS = { v: "scored", x: "failed checks", r: "rejected by integrity review", n: "infrastructure failure", w: "waiting" };

  const state = { task: null, model: null };
  function parse() {
    let key, model;
    try { [key, model] = decodeURIComponent(location.hash.slice(1)).split("/"); }
    catch { return false; }
    const task = Object.hasOwn(TASK, key) ? TASK[key] : null;
    if (!task) return false;
    state.task = key;
    state.model = MODELS.includes(model) && task.results[model] ? model
      : task.results.claude ? "claude" : MODELS.find((m) => task.results[m]);
    return !!state.model;
  }
  const go = () => history.replaceState(null, "", `#${state.task}/${state.model}`);

  function renderRun() {
    const t = TASK[state.task], r = t.results[state.model];
    document.title = `Run log · ${t.name} · ${MODEL[state.model].short} · Infrathon`;
    $("#r-lede").textContent = `${t.name} · ${MODEL[state.model].name}`;
    X.seg($("#r-model"), MODELS.filter((m) => t.results[m]).map((m) => [m, MODEL[m].short]), state.model, (v) => { state.model = v; go(); renderRun(); });
    $("#r-tasklink").href = X.taskHref(t.key);
    $("#r-tasklink").textContent = t.name;
    $("#r-back").href = X.taskHref(t.key);
    $("#r-back").setAttribute("aria-label", `Back to task: ${t.name}`);
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

  function renderFromHash() {
    if (!parse()) {
      const home = new URL("index.html#results", location.href);
      home.search = location.search;
      location.replace(home.href);
      return;
    }
    renderRun();
  }
  renderFromHash();
  const entryTask = state.task;
  const referrer = document.referrer ? new URL(document.referrer) : null;
  function backToTask(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // Browsers normally omit the referrer's fragment; the entry hash identifies
    // the task whose Run log link opened this page. Keep that return destination
    // only while viewing the same task, including after model changes.
    const cameFromTask = referrer?.origin === location.origin
      && referrer.pathname === new URL("task.html", location.href).pathname
      && (!referrer.hash || referrer.hash === `#${entryTask}`);
    if (cameFromTask && state.task === entryTask && history.length > 1) {
      event.preventDefault();
      history.back();
    }
  }
  $("#r-back").addEventListener("click", backToTask);
  $("#r-tasklink").addEventListener("click", backToTask);
  window.addEventListener("hashchange", renderFromHash);
})();
