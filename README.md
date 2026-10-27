# Infrathon website

Static site for **Infrathon: 10,000 GPU-Hours Later, Can Frontier Models Solve Real-World Long-Horizon AI Infra Tasks?** Plain HTML, CSS, and JavaScript; charts render from committed data.

```
site/
  index.html                 paper header, leaderboard, task map, 25 task trajectories
  tasks.html                 searchable task catalogue
  task.html#<key>             task details, scores, trajectories, run trace
  analysis.html              Section 5: Q1 requirements, Q2 validation, Q3 improvement
  runs.html#<task>/<model>    submission logs and run table
  method.html                protocol, scoring, token accounting, citation
  assets/css/site.css        shared layout and themes
  assets/css/analysis.css    behavior figure components
  assets/js/core.js          shared data access, rank math, charts, navigation
  assets/js/<page>.js        page rendering
  assets/img/institutions/   institution artwork extracted from the paper
  data/infrathon.js          generated results and cost bundle
  data/behavior.js           generated Section 5 figure bundle
data/
  tasks.json                 task and model registry
  raw/runs.json              selected dashboard submissions
  tokens.json                paper cost totals and 150 per-task cost records
  behavior_figures.json      Section 5 measurements and source provenance
  behavior_original_figures.json  original Overleaf figure PDFs and section mapping
  author_links.json          verified author homepage links; null when unconfirmed
  institution_logos.json     paper logo extraction provenance
  framework_figure.json      original Overleaf framework figure provenance
scripts/
  extract_dashboard.py      dashboard ZIP → selected runs
  build_data.py             results, ranks, summaries → infrathon.js
  extract_behavior_figures.py  figure JSON → behavior.js; optional PDF extraction
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

The current source is `dashboard-latest-results-20261025.zip`: one selected page per task, with Astra OPD included and Qwen Concurrent agent-22 restored (best score 154.3333). The importer excludes Gemini, the voided LLaDA DeepSeek attempt, and Sol’s local Mamba-2 rerun. It supplements missing Astra OPD from the latest earlier run when needed. Independent final-artifact evaluations remain in raw records and do not determine the leaderboard.

Preview with `python3 -m http.server -d site 8000`.

## Scoring and interaction costs

The site follows paper Eq. 5. Each model is ranked by its best valid score within each task; exact ties share the average rank. A run without a valid scored submission receives zero. Its rank score is the mean of `100 × (K − rank) / (K − 1)` over selected tasks, with fixed `K = 6`. All six models cover all 25 tasks. Flash-KMeans latency is converted to equivalent throughput, preserving the ordering.

All 150 values match Table 5 of the current 50-page manuscript (the unchanged regression fixture retains the filename `tests/paper_table4.json` from the previous edition). `tests/test_paper_audit.py` also checks the six category scores and exact-tie behavior. Full-suite confidence intervals use the generated 10,000 bootstrap resamples; filtered subsets use 3,000 resamples in the browser.

Visible tokens follow Appendix B.4’s `o200k_base` definition: recorded agent text and tool-call content, excluding tool responses, repeated code-diff displays, and reasoning traces. Full-suite totals match current Figure 8. Filtered totals sum current Figure 15’s per-task values, which are rounded to thousands and displayed with `≈`. Summing these rounded cells does not reproduce the unrounded suite total exactly. Agent actions are integers and sum to 203,266. First-score medians are computed from the selected tasks’ scored runs. These statistics cover the 150 main-experiment runs and exclude the short-budget ablations.

Cost values were originally transcribed from Figures 7 and 14 of earlier manuscript revisions. All model totals and all 300 per-task token/action cells were checked against Figures 8 and 15 of the current 50-page PDF and are unchanged. `data/tokens.json` preserves the original extraction reference and hash alongside the current reference and verification hash. The dashboard ZIP does not contain the message trajectories needed to rerun tokenization.

The retained first-score distributions come from the October 25, 41-page manuscript’s Figure 5. That chart is now Figure 6, but its archived coordinates have not been re-extracted from the current PDF. `scripts/extract_paper_distributions.py` remains specific to the 41-page layout and rejects other page counts. Printed completion and repetition statistics retain their original Figure 11 provenance and have been checked against current Figure 12.

## Paper layout and figures

The homepage follows the paper title and author order, with 18 names in three desktop rows (5 / 7 / 6), 16 verified homepage links, numbered affiliations, and eight unlinked logos. Author rows wrap within their groups on narrow screens. Affiliation numbers and logo order follow the latest author-supplied reference: Washington, Ai2, Penn, Pyromind, Stanford, RadixArk, UT Austin, Northwestern. Zheyuan Xiao is affiliated with Washington. Seven logos preserve the PDF’s vector paths; Pyromind uses its original transparent image. `data/institution_logos.json` records the original PDF hash and extraction positions, not the display order. Paper, Code, Docker, and HuggingFace buttons are explicitly marked coming soon until public URLs are supplied.

Navigation follows the paper's order with concise labels: Architecture, Results, Behavior, Tasks, Trajectories. Existing page URLs remain valid. `method.html` displays Figure 1 directly from the Overleaf archive as a faithful SVG conversion, with the unchanged original PDF linked for full-size viewing; `data/framework_figure.json` records its source. Task Definition and Task Execution follow Sections 3.1 and 3.2. The task table includes a red hint inviting readers to open a task's details.

The task map spans the page. Results show all 25 trajectories in a three-column layout (operators, modules, systems), with training and inference as the two groups. Flash-KMeans uses a logarithmic throughput axis. The best observed score carries forward to the complete task budget, including DeepSeek GQA at 12 hours.

Analysis follows Section 5 and current Figures 9–12: task requirements use Figure 9, testing optimizations uses Figures 10–11, and continued improvement uses Figure 12. Each section links to its unchanged original PDFs from the Overleaf archive for comparison with the interactive charts; hashes are recorded in `data/behavior_original_figures.json`. Printed values are transcribed directly; unlabeled points and process ticks are recovered from vector coordinates and labeled approximate. The optional PDF extraction path requires PyMuPDF; normal builds use committed JSON and only Python’s standard library. Tests check printed anchors, the workload ranking reversal, two-process summaries, and bundle freshness. Previous Analysis links redirect to the corresponding question or homepage section.

The default theme is light, with a saved dark-theme preference and a navigation toggle. Charts use shared theme variables and responsive dimensions.

## Deployment

`.github/workflows/pages.yml` rebuilds both bundles, checks that committed bundles are current, runs data tests and local-reference/JavaScript checks, and deploys `site/` to GitHub Pages after a push to `main`. Pages is configured to use GitHub Actions.
