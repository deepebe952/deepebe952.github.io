# Infrathon website

Paper website for **Infrathon: Benchmarking Language Agents for Real-World, Long-Horizon AI Infra Optimization**. Plain HTML, CSS, and JavaScript, with committed measurements and original figure assets from the author-supplied Overleaf archive.

```
site/
  index.html                 paper identity, leaderboard, task map, all task trajectories
  framework.html             Section 3: task definition, Table 2, task execution
  experimental-results.html Section 4: all seven subsections and original Figures 2–8
  agent-behavior.html        Section 5: requirements, validation, improvement, overall answer
  tasks.html                 compatibility redirect → index.html#results
  trajectories.html#<task>/<model>  run log reached from task details
  task.html#<key>             task details, scores, trajectories, run trace
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
  assets/js/core.js          shared data access, rank math, charts, navigation
  assets/js/home.js          homepage scoring notes and legacy anchors
  assets/js/home-results.js  leaderboard, task map, filterable task rows with trajectories
  assets/js/experimental-results.js  figure expansion and section navigation
  assets/js/<page>.js        page rendering
  assets/img/institutions/   institution artwork extracted from the paper
  assets/img/experimental-results/  original figure PDFs and vector SVG conversions
  data/infrathon.js          generated results and cost bundle
  data/behavior.js           archived digitized Section 5 figure bundle
data/
  tasks.json                 task and model registry
  task_metrics.json          short metric explanations, formulas, conditions, source provenance
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
  extract_behavior_figures.py  archived figure JSON → behavior.js; optional PDF extraction
  export_behavior_figures.py   original Section 5 PDFs → SVG assets and manifest
  extract_experimental_figures.py  Overleaf figure PDFs → SVG assets and manifest
  extract_paper_distributions.py  archived 41-page manuscript Figure 5 extraction
  check_site.py              local links, anchors, bundle structure, leaked local paths
```

## Updating results

```bash
python3 scripts/extract_dashboard.py /path/to/dashboard-results.zip
python3 scripts/build_data.py
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

The homepage (`index.html`) follows the paper title and author order, with 18 names in three desktop rows (5 / 7 / 6), 16 verified homepage links, numbered affiliations, and eight unlinked logos. Author rows wrap within their groups on narrow screens. Affiliation numbers and logo order follow the latest author-supplied reference: Washington, Ai2, Penn, Pyromind, Stanford, RadixArk, UT Austin, Northwestern. Zheyuan Xiao is affiliated with Washington. Seven logos preserve the PDF’s vector paths; Pyromind uses its original transparent image. `data/institution_logos.json` records the original PDF hash and extraction positions, not the display order. Paper, Code, Docker, and HuggingFace buttons are explicitly marked coming soon until public URLs are supplied.

The brand opens Home; the top-level navigation links are Framework (`framework.html`), Experimental Results (`experimental-results.html`), and Agent Behavior (`agent-behavior.html`). There is no Task Results tab or standalone trajectory navigation. Task detail URLs remain `task.html#<key>`; their per-model Run log links open `trajectories.html#<task>/<model>`. The log page stays scoped to that task, supports switching models, and provides a return link to its task page. The global all-runs directory is removed.

Home keeps the paper title in two equally sized lines, three author rows, institutions, and resource links, followed by a filterable leaderboard, a full-width task map, and 25 task rows. Each row pairs the task name and optimization target with its category, budget, metric, best configuration, and a compact trajectory chart. Rows omit Start and All six columns, open task details, and stack their content on small screens. Stage, level, and search filters share saved history state with the selected model highlight; filtering hides existing rows without rebuilding charts. The leaderboard omits mean-relative performance and bootstrap first-place probability; visible output tokens are totals across the selected main runs, explicitly excluding reasoning traces. Scoring and token definitions remain collapsed at `#score-notes`. The homepage citation block and shared site footer are removed.

Framework follows Section 3: original Figure 1; Section 3.1's W/P/E/R/T definitions and complete Table 2 inventory; Section 3.2's Work/Controller/Judge feedback loop, integrity checks, private evaluation, and continuation mechanisms. `data/framework_figure.json` records the original extraction and verifies that the latest archive's figure is unchanged. Inventory rows link to task details.

Experimental Results follows all seven Section 4 subsections, beginning with Main Results and Optimization Trajectories. Every section uses the paper's original corresponding vector image (Figures 2–8), with figure expansion, and retains its analysis. The interactive leaderboard and 25 task rows remain on Home. The paper's original Figure 3 shows 12 illustrative tasks through recorded run endpoints; homepage and task-detail charts carry best known scores through the full task budget.

Old Architecture/Method, Results, Behavior/Analysis, and Runs URLs preserve queries and route to their canonical pages. The former Tasks page redirects to `index.html#results`. Experimental Results `#leaderboard`/`#results` now refer to its restored paper sections; `#score-notes`/`#map` open the homepage components. Legacy stage/level trajectory anchors fall back to the homepage task rows. Legacy citation anchors open the homepage overview. Run deep links retain their task/model selection; an unscoped log URL returns to the homepage task list.

Task detail pages have a visible Back button. Visits from the task list return through browser history; direct or external arrivals fall back to the homepage task rows. Search, stage, level, and highlighted model are saved on the homepage history entry.

Agent Behavior (`agent-behavior.html`) follows all four Section 5 subsections, including Overall Answer and Future directions. It retains the paper’s case narratives: what the agent attempted, what the checks observed, and what happened next. Task requirements use original Figure 9, testing optimizations uses Figures 10–11, and continued improvement uses Figure 12. Each complete figure is a vector-glyph SVG exported directly from its corresponding Overleaf PDF, with an expansion dialog and no raw-PDF links. The additional reading context comes from the paper’s behavior-methods appendix: Figure 10’s five-call check differs from the full-case profiles, Figure 12’s pooled rates weight submissions rather than runs, and the 141-run repeat and 143-run later-record analyses have different inclusion rules. `data/behavior_original_figures.json` records the latest archive and main.tex hashes, subsection mapping, PDF/SVG hashes, and dimensions. The historical digitized data and its checks remain available but no longer render this page. Previous Analysis links and individual panel anchors remain supported.

The default theme is light, with a saved dark-theme preference and a navigation toggle. Charts use shared theme variables and responsive dimensions.

## Deployment

`.github/workflows/pages.yml` rebuilds both bundles, checks that committed bundles are current, runs data tests, original-figure integrity checks, and local-reference/JavaScript checks, and deploys `site/` to GitHub Pages after a push to `main`. Pages is configured to use GitHub Actions.
