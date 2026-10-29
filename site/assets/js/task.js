/* Task documentation and results: task.html#<key>/<section>. */
(() => {
  "use strict";
  const X = window.IX, Docs = window.InfrathonDocs, guides = window.INFRATHON_DOCS.tasks;
  const { D, TASK, h, $, cap } = X;
  const miles = { opcd: "miles-opcd", opd: "miles-opd", alfworld: "miles-alfworld", sd35: "miles-diffusion-opd", wan22: "miles-diffusion-wan" };
  let currentKey = null;
  const inline = text => text.split(/(`[^`]+`)/g).map(part => part.startsWith("`") ? h("code", { text: part.slice(1, -1) }) : part);
  const items = texts => texts.map(text => h("li", {}, ...inline(text)));

  $("#task-back").addEventListener("click", () => {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    const cameFromSite = referrer?.origin === location.origin;
    const cameFromLog = /\/(?:trajectories|runs)\.html$/.test(referrer?.pathname || "");
    if (cameFromSite && !cameFromLog && history.length > 1) history.back();
    else location.assign("tasks.html");
  });

  function render(t) {
    const guide = guides[t.key];
    document.title = `${t.name} · Infrathon`;
    $("#t-group").textContent = `${cap(t.stage)} · ${cap(t.level)}`;
    $("#t-name").textContent = t.name;
    $("#t-summary").textContent = guide.reader_overview;
    $("#task-run-commands").open = false;
    $("#t-meta").replaceChildren(h("span", { text: `Experiment budget: ${t.budget_h} hours` }));
    const readerFacts = [...guide.reader_setup, { name: "Hardware", description: guide.reader_compute }];
    $("#t-reader-setup").replaceChildren(...readerFacts.map(row => h("div", {}, h("dt", { text: row.name }), h("dd", { text: row.description }))));
    $("#t-resources").replaceChildren(...items(guide.requirements));
    $("#t-metric-title").textContent = t.metric_info.label;
    $("#t-metric-meaning").textContent = guide.reader_metric.meaning;
    $("#t-score-rule").textContent = guide.reader_metric.rule;

    const setup = $("#t-setup"), directoryName = guide.directory.split("/").pop();
    const pull = miles[t.key] || t.key === "minference" ? 'scripts/infrathon/pull_images.sh "$TASK"' : 'INFRATHON_PULL=1 bash "$TASK_DIR/scripts/build_images.sh"';
    setup.replaceChildren(Docs.code(`TASK=${directoryName}\nTASK_DIR="${guide.directory}"\n"$TASK_DIR/assets/fetch.sh"\n.venv/bin/python scripts/infrathon/assets.py check "$TASK"\n${pull}`));
    if (guide.after_pull_command) setup.append(h("p", { text: "Prepare evaluator asset ownership using the pulled Judge image:" }), Docs.code(guide.after_pull_command));
    if (t.key === "flux-moe" || t.key === "sdv2") setup.prepend(h("p", {}, "Configure ", h("a", { class: "link", href: "docs.html#host-torch", text: "host CUDA PyTorch" }), " for the GPU-pair preflight."));
    if (miles[t.key]) {
      const entry = miles[t.key];
      setup.append(h("p", { text: "Choose a scratch directory on your data disk:" }), Docs.code(guide.scratch_setup));
      if (guide.config_setup) setup.append(h("p", {}, "Create the run configuration:") , Docs.code(guide.config_setup),
        h("p", {}, "Set the model, credentials, GPU indices, Judge port, ", h("code", { text: "SFORGE_AGENT_RUNTIME_DIR" }), ", and ", h("a", { class: "link", href: "docs.html#history", text: "candidate-history store" }), " in ", h("code", { text: `launch/${entry}/run.env` }), ". Use KEY=VALUE entries with absolute paths. Export asset and Hugging Face cache paths in your shell."));
    } else if (t.key === "serving") {
      setup.replaceChildren(Docs.code(`TASK=${directoryName}\nTASK_DIR="${guide.directory}"\n"$TASK_DIR/assets/fetch.sh"\n.venv/bin/python scripts/infrathon/assets.py check "$TASK"\nINFRATHON_PULL=1 DOCKER_BUILD_NETWORK=host bash "$TASK_DIR/scripts/build_images.sh"`));
      setup.append(
        h("p", {}, "The asset step also stages the 192 SWE-bench images. Follow the Running section of ", h("code", { text: `${guide.directory}/README.md` }), " for the backend and Direct-baseline setup."),
        h("h3", { text: "Start the backend" }),
        Docs.code('export KVBENCH_MODEL_PATH="${INFRATHON_ASSETS_ROOT:-$HOME/.cache/infrathon/assets}/$TASK/public/models/Qwen3.6-27B"\nexport KVBENCH_BACKEND_GPUS=0,1\nbash "$TASK_DIR/scripts/host_vllm_backend.sh" start'),
        h("p", {}, "Export the ", h("code", { text: "KVBENCH_VLLM_BASE_URL" }), " printed by the helper. Choose the two backend GPUs for your host."),
        h("h3", { text: "Prepare the host" }),
        h("ol", {},
          h("li", {}, "Measure the hidden and public Direct baselines on this backend boot. The task README’s Running section gives the baseline runner commands, nonce inputs, corpus path, and measurement-lock setup."),
          h("li", {}, "Initialize and register this task in the ", h("a", { class: "link", href: "docs.html#history", text: "candidate-history store" }), ", and export ", h("code", { text: "SFORGE_VERSION_STORE_ROOT" }), "."),
          h("li", {}, "Provide a host CONNECT proxy at ", h("code", { text: "127.0.0.1:18080" }), " that reaches your agent’s model API.")),
        h("h3", { text: "Configure and run" }),
        h("p", {}, "Save these settings in ", h("code", { text: "launch/concurrent-serving/run.env" }), ", using the backend URL and absolute paths from the preparation steps:"),
        Docs.code('KVBENCH_VLLM_BASE_URL=http://BACKEND_HOST:18000\nKVBENCH_HIDDEN_BASELINE_PATH=/absolute/path/hidden-direct.json\nKVBENCH_PUBLIC_BASELINE_PATH=/absolute/path/public-direct.json\nSFORGE_KVBENCH_NONCE_SOURCE=/absolute/path/v24.nonces\nSFORGE_VERSION_STORE_ROOT=/absolute/path/infrathon-version-store'));
    }
    if (guide.launch_command) {
      setup.append(h("h3", { text: "Launch" }));
      if (guide.launch_note) setup.append(h("p", { text: guide.launch_note }));
      if (guide.launch_setup) setup.append(Docs.code(guide.launch_setup));
      setup.append(Docs.code(guide.launch_command));
    }

    const info = t.metric_info, metricDetails = $("#t-metric-details");
    metricDetails.replaceChildren();
    $("#metric-calculation").open = false;
    if (info) {
      metricDetails.append(h("div", { class: "metric-formula", text: info.formula }), ...info.details.map(text => h("p", { text })));

      if (info.conditions.length) metricDetails.append(h("h4", { text: "When a score is valid" }), h("ul", {}, info.conditions.map(text => h("li", { text }))));
    }
    window.InfrathonTaskResults.render(t);
    const i = D.tasks.indexOf(t), prev = D.tasks[(i + D.tasks.length - 1) % D.tasks.length], next = D.tasks[(i + 1) % D.tasks.length];
    $("#t-pager").replaceChildren(
      h("a", { href: X.taskHref(prev.key) }, h("small", { text: "Previous task" }), prev.name),
      h("a", { class: "next", href: X.taskHref(next.key) }, h("small", { text: "Next task" }), next.name));
    Docs.refresh(t.key);
  }
  function route() {
    let key, section;
    try { [key, section] = decodeURIComponent(location.hash.slice(1)).split("/"); }
    catch { key = null; }
    const t = TASK[key] || D.tasks[0];
    const showCommands = ["run", "running", "resources", "setup"].includes(section);
    const showMetric = section === "evaluation" || section === "metric-details";
    section = { workspace: "setting", instructions: "setting", implementation: "setting", resources: "running", setup: "running", run: "running", evaluation: "metric-details" }[section] || section;
    const restoringScroll = currentKey === null && performance.getEntriesByType("navigation")[0]?.type === "back_forward";
    const changed = currentKey !== t.key;
    if (changed) { currentKey = t.key; render(t); }
    if (showCommands) $("#task-run-commands").open = true;
    if (showMetric) $("#metric-calculation").open = true;
    if (!restoringScroll) {
      if (section) requestAnimationFrame(() => document.getElementById(`task-${section}`)?.scrollIntoView());
      else window.scrollTo(0, 0);
    }
  }
  $("#t-pager").addEventListener("click", event => {
    const link = event.target.closest("a");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const url = new URL(link.href);
    url.search = location.search;
    location.replace(url.href);
  });
  window.addEventListener("hashchange", route);
  route();
})();
