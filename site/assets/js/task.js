/* Task documentation: task.html#<key>/<section>. */
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
    $("#t-summary").textContent = guide.objective;
    $("#t-results-link").href = X.taskResultsHref(t.key);
    $("#task-run-commands").open = false;
    $("#t-meta").replaceChildren(h("span", { text: `${t.budget_h}-hour budget` }), h("span", { text: t.start === "seed" ? "Seed implementation" : "From scratch" }));
    $("#t-setting").replaceChildren(...inline(guide.setting));
    $("#t-interface").replaceChildren(...guide.interface.map(row => h("div", {}, h("dt", { text: row.name }), h("dd", {}, ...inline(row.description)))));
    $("#t-components").replaceChildren(h("table", { class: "doc-table task-components" },
      h("caption", { class: "sr-only", text: `Workspace components for ${t.name}` }),
      h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "Component" }), h("th", { scope: "col", text: "Purpose" }))),
      h("tbody", {}, guide.components.map(row => h("tr", {}, h("th", { scope: "row" }, ...inline(row.name)), h("td", {}, ...inline(row.description)))))));
    $("#t-resources").replaceChildren(...items(guide.requirements));
    $("#t-workflow").replaceChildren(...items(guide.workflow));
    $("#t-constraints").replaceChildren(...items(guide.constraints));
    $("#t-evaluation").textContent = guide.metric_summary;
    $("#t-validation").replaceChildren(...items(guide.validation));
    const publicTests = $("#t-public-tests");
    publicTests.replaceChildren();
    if (guide.test_commands) publicTests.append(h("h3", { text: "Public test" }), h("p", { text: "Inside the running Work environment:" }), Docs.code(guide.test_commands));

    const setup = $("#t-setup"), directoryName = guide.directory.split("/").pop();
    const pull = miles[t.key] || t.key === "minference" ? 'scripts/infrathon/pull_images.sh "$TASK"' : 'INFRATHON_PULL=1 bash "$TASK_DIR/scripts/build_images.sh"';
    setup.replaceChildren(Docs.code(`TASK=${directoryName}\nTASK_DIR="${guide.directory}"\n"$TASK_DIR/assets/fetch.sh"\n.venv/bin/python scripts/infrathon/assets.py check "$TASK"\n${pull}`));
    if (guide.after_pull_command) setup.append(h("p", { text: "Prepare evaluator asset ownership using the pulled Judge image:" }), Docs.code(guide.after_pull_command));
    if (t.key === "flux-moe" || t.key === "sdv2") setup.prepend(h("p", {}, "Configure ", h("a", { class: "link", href: "docs.html#host-torch", text: "host CUDA PyTorch" }), " for the GPU-pair preflight."));
    if (miles[t.key]) {
      const entry = miles[t.key];
      setup.append(h("p", { text: "Choose a scratch directory on your data disk:" }), Docs.code(guide.scratch_setup));
      setup.append(h("p", {}, "Create the run configuration:") , Docs.code(`cp launch/${entry}/codex.env.example launch/${entry}/run.env`),
        h("p", {}, "Set the model, credentials, GPU indices, ", h("code", { text: "SFORGE_AGENT_RUNTIME_DIR" }), ", and ", h("a", { class: "link", href: "docs.html#history", text: "candidate-history store" }), " in ", h("code", { text: `launch/${entry}/run.env` }), ". Use KEY=VALUE entries with absolute paths. Export asset and Hugging Face cache paths in your shell."),
        Docs.code(`launch/${entry}/run.sh --config launch/${entry}/run.env --dry-run\nlaunch/${entry}/run.sh --config launch/${entry}/run.env --foreground`));
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
        Docs.code('KVBENCH_VLLM_BASE_URL=http://BACKEND_HOST:18000\nKVBENCH_HIDDEN_BASELINE_PATH=/absolute/path/hidden-direct.json\nKVBENCH_PUBLIC_BASELINE_PATH=/absolute/path/public-direct.json\nSFORGE_KVBENCH_NONCE_SOURCE=/absolute/path/v24.nonces\nSFORGE_VERSION_STORE_ROOT=/absolute/path/infrathon-version-store'),
        h("p", {}, "With the backend, baselines, proxy, and store ready, start the agent:"),
        Docs.code(`${guide.launcher} \\\n  --config launch/concurrent-serving/run.env \\\n  --model MODEL_ID --effort max --hours ${t.budget_h} \\\n  --auth /path/to/auth.json`));
    } else if (guide.launcher) {
      if (t.key === "llada") setup.append(
        h("p", { text: "Set the model cache path and generate the quality-control archives on the host:" }),
        Docs.code('export LLADA_MODEL_REPO="$(.venv/bin/python scripts/infrathon/assets.py hub-cache)/models--GSAI-ML--LLaDA-8B-Instruct"\npython3 "$TASK_DIR/scripts/make_reference_archives.py" \\\n  --task-root "$TASK_DIR" --stress-extra-mib 61440'));
      setup.append(h("p", {}, "Start the run with your model and credentials. Use ", h("code", { text: `${guide.launcher} --help` }), " to set GPU allocation and other options."),
        Docs.code(`${guide.launcher} \\\n  --model MODEL_ID --effort max --hours ${t.budget_h} \\\n  --auth /path/to/auth.json`));
    }

    const info = t.metric_info, metricDetails = $("#t-metric-details");
    metricDetails.replaceChildren();
    $("#metric-calculation").open = false;
    if (info) {
      metricDetails.append(h("div", { class: "metric-formula", text: info.formula }), ...info.details.map(text => h("p", { text })));
      if (info.example) metricDetails.append(h("p", { class: "metric-example", text: info.example }));
      if (info.conditions.length) metricDetails.append(h("h4", { text: "Validation" }), h("ul", {}, info.conditions.map(text => h("li", { text }))));
    }
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
    if (section === "results") {
      const resultURL = new URL(X.taskResultsHref(t.key), location.href);
      resultURL.search = location.search;
      location.replace(resultURL.href);
      return;
    }
    const showCommands = section === "run";
    section = { workspace: "implementation", instructions: "implementation", resources: "running", setup: "running", run: "running", metric: "evaluation" }[section] || section;
    const changed = currentKey !== t.key;
    if (changed) { currentKey = t.key; render(t); }
    if (showCommands) $("#task-run-commands").open = true;
    if (section) requestAnimationFrame(() => document.getElementById(`task-${section}`)?.scrollIntoView());
    else window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
