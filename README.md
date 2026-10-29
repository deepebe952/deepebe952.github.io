# Infrathon website

Paper website for **Infrathon: Benchmarking Language Agents for Real-World, Long-Horizon AI Infra Optimization**. Plain HTML, CSS, and JavaScript, with committed measurements and original figure assets from the author-supplied Overleaf archive.

```
site/
  index.html                 paper identity, leaderboard, task map, all task trajectories
  framework.html             Section 3: task definition, Table 2, task execution
  experimental-results.html Section 4: all seven subsections and original Figures 2–8
  agent-behavior.html        Section 5: requirements, validation, improvement, overall answer
  tasks.html                 task documentation directory, grouped by stage and level
  trajectories.html#<task>/<model>  run log reached from task details
  docs.html                  installation, assets, Docker, launchers, outputs
  task.html#<key>/<section>   unified task goal, metric, results, settings, running details
  task-results.html#<key>     compatibility redirect → task.html#<key>
  architecture.html         compatibility redirect → framework.html#overview
  method.html                compatibility redirect → framework.html#overview
  results.html               compatibility redirect → experimental-results.html
  behavior.html              compatibility redirect → agent-behavior.html
  analysis.html              compatibility redirect → agent-behavior.html
  runs.html                  compatibility redirect → trajectories.html
  assets/css/site.css        shared layout and themes
  assets/css/framework.css   framework definitions and task inventory
  assets/css/experimental-results.css  experimental figures and expansion dialog
  assets/css/agent-behavior.css  behavior figure components
  assets/css/docs.css        documentation sidebar, article, contents, code blocks
  assets/css/tasks.css       task documentation directory
  assets/css/task-results.css  individual task result layout
  assets/js/core.js          shared data access, rank math, charts, navigation
  assets/js/section-tabs.js  single-section views, deep links, keyboard navigation
  assets/js/home.js          homepage scoring notes and legacy anchors
  assets/js/home-results.js  leaderboard, task map, filterable task rows with trajectories
  assets/js/experimental-results.js  figure expansion and section navigation
  assets/js/docs.js          task search, shared documentation navigation, command copying
  assets/js/task-results.js  task charts and per-model results
  assets/js/<page>.js        page rendering
  assets/img/institutions/   institution artwork extracted from the paper
  assets/img/experimental-results/  original figure PDFs and vector SVG conversions
  data/infrathon.js          generated results and cost bundle
  data/docs.js               generated guides for all 25 tasks
  data/behavior.js           archived digitized Section 5 figure bundle
data/
  tasks.json                 task and model registry
  task_metrics.json          short metric explanations, formulas, conditions, source provenance
  task_guides.json           task settings, interfaces, metric summaries, source hashes
  setup_sources.json         setup documentation sources and mock release URLs
  raw/runs.json              selected dashboard submissions
  tokens.json                paper cost totals and 150 per-task cost records
  behavior_figures.json      Section 5 measurements and source provenance
  behavior_original_figures.json  original PDFs, display SVGs, source hashes, section mapping
  experimental_figures.json  Figures 2–8 source archive, hashes, and display assets
  author_links.json          verified author homepage links; null when unconfirmed
  institution_logos.json     paper logo extraction provenance
  framework_figure.json      original Overleaf framework figure provenance
scripts/
  extract_dashboard.py      dashboard ZIP → selected runs
  build_data.py             results, ranks, summaries → infrathon.js
  build_docs.py             task guides → docs.js
  extract_behavior_figures.py  archived figure JSON → behavior.js; optional PDF extraction
  export_behavior_figures.py   original Section 5 PDFs → SVG assets and manifest
  extract_experimental_figures.py  Overleaf figure PDFs → SVG assets and manifest
  extract_paper_distributions.py  archived 41-page manuscript Figure 5 extraction
  check_site.py              local links, anchors, bundle structure, leaked local paths
  check_documentation_sources.py  task and setup sources against the public repository and paper
```

## Updating results

```bash
python3 scripts/extract_dashboard.py /path/to/dashboard-results.zip
python3 scripts/build_data.py
python3 scripts/build_docs.py
python3 scripts/extract_behavior_figures.py
python3 -m unittest discover -s tests -v
python3 scripts/check_site.py
```

The selected run source is `dashboard-latest-results-20261025.zip`: one selected page per task, with Astra OPD included and Qwen Concurrent agent-22 restored (best score 154.3333). The importer excludes Gemini, the voided LLaDA DeepSeek attempt, and Sol’s local Mamba-2 rerun. It supplements missing Astra OPD from the latest earlier run when needed. Independent final-artifact evaluations remain in raw records and do not determine the leaderboard.

The authoritative paper source is `_AI_Infra____New_Template_Version___Zhengyu_Hu (1).zip` (SHA-256 `732678e3d954a4c605b1961abcdf994ebb22c1cd90b1a49683cd5caf2cd49cf5`), including `main.tex` and the original figure PDFs. To regenerate experimental figure assets, run `python3 scripts/extract_experimental_figures.py /path/to/overleaf.zip` with PyMuPDF installed; `--check` validates the committed assets without re-extracting them. Agent Behavior uses `python3 scripts/export_behavior_figures.py /path/to/overleaf.zip`; `--check /path/to/overleaf.zip` additionally verifies source bytes and section mapping without writing files.

Preview with `python3 -m http.server -d site 8000`.

## Scoring and interaction costs

Every task has a source-checked metric description in `data/task_metrics.json`, based on the latest Overleaf paper's task appendix and the matching release task specifications. The file records the paper archive hash, documentation revision, and source-document hashes. The bundle includes the display content as `task.metric_info`; provenance stays in the source file. Homepage rows use compact `home_label` units or expressions (for example, `TFLOPS` or `Accuracy gain / training hour`); task details explain the full metric, formula, aggregation, baseline, and scoring conditions. Descriptions do not change any measured score, submission, trajectory, or ranking calculation.

The site follows paper Eq. 5. Each model is ranked by its best finite, valid score within each task's time budget; exact ties share the average rank. A run without a valid scored submission receives zero. Its rank score is the mean of `100 × (K − rank) / (K − 1)` over selected tasks, with fixed `K = 6`. All six models cover all 25 tasks. Flash-KMeans latency is converted to equivalent throughput, preserving the ordering. Budget and finiteness checks apply to performance summaries; submission records and status counts retain the original observations.

All 150 values match Table 5 in the latest archive's `main.tex` (the unchanged regression fixture retains the filename `tests/paper_table4.json` from the previous edition). `tests/test_paper_audit.py` also checks the six category scores, exact-tie behavior, and Section 4.5's first-score action medians: 71 for Sol and 248 for Qwen. The website adds confidence intervals, which are not reported in the paper: the full suite uses 10,000 task-bootstrap resamples; filtered subsets use 3,000 resamples in the browser.

Visible tokens follow Appendix B.4’s `o200k_base` definition: recorded agent text and tool-call content, excluding tool responses, repeated code-diff displays, and reasoning traces. Full-suite totals match current Figure 8. Filtered totals sum current Figure 15’s per-task values, which are rounded to thousands and displayed with `≈`. Summing these rounded cells does not reproduce the unrounded suite total exactly. Agent actions are integers and sum to 203,266. First-score medians are computed from the selected tasks’ scored runs. These statistics cover the 150 main-experiment runs and exclude the short-budget ablations.

Cost values were originally transcribed from Figures 7 and 14 of earlier manuscript revisions. All 12 model totals and all 300 per-task token/action cells were checked against Figures 8 and 15 in the latest archive and are unchanged. `data/tokens.json` preserves original extraction references, earlier PDF verification, and the latest archive/member hashes. The dashboard ZIP does not contain the message trajectories needed to rerun tokenization.

The retained first-score distributions come from the October 25, 41-page manuscript’s Figure 5. These archived coordinates are not current Figure 6 data; the Experimental Results page uses the latest original figure asset. `scripts/extract_paper_distributions.py` remains specific to the 41-page layout and rejects other page counts. Printed completion and repetition statistics retain their original Figure 11 provenance and have been checked against current Figure 12. The main-experiment totals exclude the 72 additional short Astra/Claude runs in Section 4.3, which add 2,016 GPU-hours and reuse 12 primary runs to form 84 ablation trajectories.

## Paper layout and figures

Published charts and tables use descriptive titles without paper numbering. Source manifests and legacy anchors retain their original identifiers; figure expansion uses the displayed title.

Framework, Experimental Results, and Agent Behavior use tabs to display one section at a time. Page titles remain visible, and section or figure URLs open the corresponding section. Existing figure expansion remains available.

The homepage (`index.html`) follows the paper title and author order, with 18 names in three desktop rows (5 / 7 / 6), 16 verified homepage links, numbered affiliations, and eight unlinked logos. Author rows wrap within their groups on narrow screens. Affiliation numbers and logo order follow the latest author-supplied reference: Washington, Ai2, Penn, Pyromind, Stanford, RadixArk, UT Austin, Northwestern. Zheyuan Xiao is affiliated with Washington. Seven logos preserve the PDF’s vector paths; Pyromind uses its original transparent image. `data/institution_logos.json` records the original PDF hash and extraction positions, not the display order. Paper, Code, Docker, and HuggingFace buttons are explicitly marked coming soon until public URLs are supplied.

The brand opens Home; the top-level navigation links are Framework (`framework.html`), Experimental Results (`experimental-results.html`), Agent Behavior (`agent-behavior.html`), Tasks (`tasks.html`), and Docs (`docs.html`). Discord links to the author-provided invite. There is no Task Results tab or standalone trajectory navigation. Task descriptions and results share `task.html#<key>` with `/<section>` anchors. Homepage task rows, map tiles, and the task directory open this unified page. Its per-model Run log links open `trajectories.html#<task>/<model>`. The log page supports switching models and returns to the task page. The global all-runs directory is removed.

Home keeps the paper title in two equally sized lines, three author rows, institutions, and resource links, followed by a filterable leaderboard, a full-width task map, and 25 task rows. Each row pairs the task name and optimization target with its category, budget, metric, best configuration, and a compact trajectory chart. Rows omit Start and All six columns, open individual task results, and stack their content on small screens. Stage, level, and search filters share saved history state with the selected model highlight; filtering hides existing rows without rebuilding charts. The leaderboard omits mean-relative performance and bootstrap first-place probability; visible output tokens are totals across the selected main runs, explicitly excluding reasoning traces. Scoring and token definitions remain collapsed at `#score-notes`. The homepage citation block and shared site footer are removed.

Framework follows Section 3: original Figure 1; Section 3.1's W/P/E/R/T definitions and complete Table 2 inventory; Section 3.2's Work/Controller/Judge roles, integrity checks, and private evaluation. `data/framework_figure.json` records the original extraction and verifies that the latest archive's figure is unchanged. Inventory rows link to task details.

Experimental Results follows all seven Section 4 subsections, beginning with Main Results and Optimization Trajectories. Every section uses the paper's original corresponding vector image (Figures 2–8), with figure expansion, and retains its analysis. The interactive leaderboard and 25 task rows remain on Home. The paper's original Figure 3 shows 12 illustrative tasks through recorded run endpoints; homepage and task-detail charts carry best known scores through the full task budget.

Old Architecture/Method, Results, Behavior/Analysis, and Runs URLs preserve queries and route to their canonical pages. The Tasks page lists the 25 tasks; legacy task-key anchors open the matching task. Old `task-results.html#<key>` links redirect to `task.html#<key>` while preserving queries. Existing `task.html#<key>/results` anchors open the results within the unified page. Experimental Results `#leaderboard`/`#results` now refer to its restored paper sections; `#score-notes`/`#map` open the homepage components. Legacy stage/level trajectory anchors fall back to the homepage task rows. Legacy citation anchors open the homepage overview. Run deep links retain their task/model selection; an unscoped log URL returns to the homepage task list.

Task pages have a visible Back button. Visits from Home or the task directory return through browser history; direct or external arrivals fall back to `tasks.html`. Search, stage, level, and highlighted model are saved on the homepage history entry. Adjacent-task, sidebar-task, and contents navigation replace the current task entry, preserving the original return destination.

Agent Behavior (`agent-behavior.html`) follows all four Section 5 subsections, including Overall Answer and Future directions. It retains the paper’s case narratives: what the agent attempted, what the checks observed, and what happened next. Task requirements use original Figure 9, testing optimizations uses Figures 10–11, and continued improvement uses Figure 12. Each complete figure is a vector-glyph SVG exported directly from its corresponding Overleaf PDF, with an expansion dialog and no raw-PDF links. The behavior-methods appendix supplies the five-call check definition and the inclusion rules for repeat and later-record analyses. `data/behavior_original_figures.json` records the latest archive and main.tex hashes, subsection mapping, PDF/SVG hashes, and dimensions. The historical digitized data and its checks remain available but no longer render this page. Previous Analysis links and individual panel anchors remain supported.

The default theme is white, with Inter body text, a saved dark-theme preference, and a navigation toggle. Charts use shared theme variables and responsive dimensions.

## Documentation

The setup guide follows the `infrathon` repository at `https://github.com/deepebe952/infrathon`, revision `eb72a9ce8a4067766b0ffaf99ea23659102b617a`. The local source checkout is `../infrathon`. Its task READMEs, Work contracts, public tests, Judge code, task configurations, and launchers are the current code references; the former `ultrainfrabench-release/docs/tasks` directory is not the release documentation source. The guide covers host requirements, repository installation, Codex and Claude Code runtime downloads, agent CLI version selection, asset fetching, direct Docker pulls using recorded hardware-specific tags, local image preparation, candidate history, launching a kernel task, and submission outputs. Public Code, Docker, and Dataset buttons currently use author-approved `example.com` placeholders, with one release-status line. Replace these URLs in `site/docs.html` and `data/setup_sources.json` when published.

Docs contains the general setup guide and section navigation. Tasks has its own searchable directory and 25 unified task pages. Each page presents the task introduction and metric summary once, followed by best scores, optimization trajectories, submission history, and the per-model results table. Task setup follows the results and explains the model and data or synthetic workload, workload settings, starting point, editable scope, and hardware. Detailed metric calculations and validity checks, then environment setup and launch commands, appear in disclosures. Document sidebars and contents collapse on mobile.

`data/task_guides.json` records each task's source files, launcher, source hashes, reader-oriented descriptions, and result-page summaries. Metric explanations follow the paper and `data/task_metrics.json`. `data/setup_sources.json` records the setup sources and code revision. The audit found unchanged task interfaces and scoring code across the former and current repositories, but changed launcher defaults and flags. Task hardware follows the paper's independent Worker and Judge allocations, recorded in `gpu_allocation_source`; examples explicitly use 12- or 24-hour experiment budgets. Launchers that default to one shared GPU select their `--legacy-dual-gpu` path with separate `WORK_GPU` and `JUDGE_GPU` values. All 25 task pages include Launch commands. The nine two-GPU workloads expose a shared-pair launcher in the public checkout; their commands and configuration steps are displayed with a brief shared-GPU note, as authorized by the author. The hardware description above them records the paper experiment allocation. Concurrent serving uses CPU Worker/Judge containers and a dedicated two-GPU backend, as in the paper. `scripts/build_docs.py` checks registry coverage and required content fields and emits display fields into `site/data/docs.js`; archived code-interface and public-test descriptions remain in the source data.

Run `python3 scripts/check_documentation_sources.py` with the sibling source checkout and paper archive present to verify source paths, hashes, task IDs, launchers, and example budgets. Use `--repo` and `--paper` for other locations. This check also parses the documented shell commands without executing them. A source revision update requires reviewing changed files and refreshing their recorded hashes.

Setup commands were checked against the release code and launcher help. The candidate-history example was exercised in temporary stores. Docker pulls, image builds, and GPU runs have not been executed as part of the website update.

## Deployment

`.github/workflows/pages.yml` rebuilds the results, documentation, and archived behavior bundles, checks that committed bundles are current, runs data tests, original-figure integrity checks, and local-reference/JavaScript checks, and deploys `site/` to GitHub Pages after a push to `main`. Pages is configured to use GitHub Actions.
