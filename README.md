# Infrathon website

Paper website for **Infrathon: Benchmarking Language Agents for Real-World, Long-Horizon AI Infra Optimization**. Plain HTML, CSS, and JavaScript, with committed measurements and original figure assets from the author-supplied Overleaf archive.

```
site/
  index.html                 paper overview, authors, task definition/execution, findings
  framework.html             Section 3: task definition, Table 2, task execution
  experimental-results.html Section 4: all seven subsections and Figures 2–8
  agent-behavior.html        Section 5: requirements, validation, improvement
  tasks.html                 Task Results → Tasks: searchable task catalogue
  trajectories.html#<task>/<model>  Task Results → Trajectories: submission logs
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
  assets/js/home.js          homepage section navigation and citation
  assets/js/experimental-results.js  leaderboard and selected task trajectories
  assets/js/<page>.js        page rendering
  assets/img/institutions/   institution artwork extracted from the paper
  assets/img/experimental-results/  original figure PDFs and vector SVG conversions
  data/infrathon.js          generated results and cost bundle
  data/behavior.js           generated Section 5 figure bundle
data/
  tasks.json                 task and model registry
  raw/runs.json              selected dashboard submissions
  tokens.json                paper cost totals and 150 per-task cost records
  behavior_figures.json      Section 5 measurements and source provenance
  behavior_original_figures.json  original Overleaf figure PDFs and section mapping
  experimental_figures.json  Figures 2–8 source archive, hashes, and display assets
  author_links.json          verified author homepage links; null when unconfirmed
  institution_logos.json     paper logo extraction provenance
  framework_figure.json      original Overleaf framework figure provenance
scripts/
  extract_dashboard.py      dashboard ZIP → selected runs
  build_data.py             results, ranks, summaries → infrathon.js
  extract_behavior_figures.py  figure JSON → behavior.js; optional PDF extraction
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

The authoritative paper source is `_AI_Infra____New_Template_Version___Zhengyu_Hu (1).zip` (SHA-256 `732678e3d954a4c605b1961abcdf994ebb22c1cd90b1a49683cd5caf2cd49cf5`), including `main.tex` and the original figure PDFs. To regenerate experimental figure assets, run `python3 scripts/extract_experimental_figures.py /path/to/overleaf.zip` with PyMuPDF installed; `--check` validates the committed assets without re-extracting them.

Preview with `python3 -m http.server -d site 8000`.

## Scoring and interaction costs

The site follows paper Eq. 5. Each model is ranked by its best valid score within each task; exact ties share the average rank. A run without a valid scored submission receives zero. Its rank score is the mean of `100 × (K − rank) / (K − 1)` over selected tasks, with fixed `K = 6`. All six models cover all 25 tasks. Flash-KMeans latency is converted to equivalent throughput, preserving the ordering.

All 150 values match Table 5 in the latest archive's `main.tex` (the unchanged regression fixture retains the filename `tests/paper_table4.json` from the previous edition). `tests/test_paper_audit.py` also checks the six category scores, exact-tie behavior, and Section 4.5's first-score action medians: 71 for Sol and 248 for Qwen. Full-suite confidence intervals use the generated 10,000 bootstrap resamples; filtered subsets use 3,000 resamples in the browser.

Visible tokens follow Appendix B.4’s `o200k_base` definition: recorded agent text and tool-call content, excluding tool responses, repeated code-diff displays, and reasoning traces. Full-suite totals match current Figure 8. Filtered totals sum current Figure 15’s per-task values, which are rounded to thousands and displayed with `≈`. Summing these rounded cells does not reproduce the unrounded suite total exactly. Agent actions are integers and sum to 203,266. First-score medians are computed from the selected tasks’ scored runs. These statistics cover the 150 main-experiment runs and exclude the short-budget ablations.

Cost values were originally transcribed from Figures 7 and 14 of earlier manuscript revisions. All 12 model totals and all 300 per-task token/action cells were checked against Figures 8 and 15 in the latest archive and are unchanged. `data/tokens.json` preserves original extraction references, earlier PDF verification, and the latest archive/member hashes. The dashboard ZIP does not contain the message trajectories needed to rerun tokenization.

The retained first-score distributions come from the October 25, 41-page manuscript’s Figure 5. These archived coordinates are not current Figure 6 data; the Experimental Results page uses the latest original figure asset. `scripts/extract_paper_distributions.py` remains specific to the 41-page layout and rejects other page counts. Printed completion and repetition statistics retain their original Figure 11 provenance and have been checked against current Figure 12. The main-experiment totals exclude the 72 additional short Astra/Claude runs in Section 4.3, which add 2,016 GPU-hours and reuse 12 primary runs to form 84 ablation trajectories.

## Paper layout and figures

The homepage (`index.html`) follows the paper title and author order, with 18 names in three desktop rows (5 / 7 / 6), 16 verified homepage links, numbered affiliations, and eight unlinked logos. Author rows wrap within their groups on narrow screens. Affiliation numbers and logo order follow the latest author-supplied reference: Washington, Ai2, Penn, Pyromind, Stanford, RadixArk, UT Austin, Northwestern. Zheyuan Xiao is affiliated with Washington. Seven logos preserve the PDF’s vector paths; Pyromind uses its original transparent image. `data/institution_logos.json` records the original PDF hash and extraction positions, not the display order. Paper, Code, Docker, and HuggingFace buttons are explicitly marked coming soon until public URLs are supplied.

The brand opens Home; the top-level navigation links are Framework (`framework.html`), Experimental Results (`experimental-results.html`), Agent Behavior (`agent-behavior.html`), and Task Results (`tasks.html`). Task Results has Tasks (`tasks.html`) and Trajectories (`trajectories.html`) subviews; both and task details keep Task Results active in the main navigation. Task detail URLs remain `task.html#<key>`.

Home keeps the paper title, three author rows, institutions, and resource links, followed by a subsection navigation and a single reading column: Introduction, Task Definition, Task Execution, and Experimental Results. Introduction and Results use all ten sentences of the active paper abstract, in order; the framework paragraphs and Figure 1 caption use original Section 3 sentences. Only LaTeX formatting, mathematical symbols, and cross-references are converted for HTML. Source markers on the paragraphs identify these excerpts. Numeric summary cards and rewritten summaries are omitted. Citation is collapsed at `index.html#cite`.

Framework follows Section 3: original Figure 1; Section 3.1's W/P/E/R/T definitions and complete Table 2 inventory; Section 3.2's Work/Controller/Judge feedback loop, integrity checks, private evaluation, and continuation mechanisms. `data/framework_figure.json` records the original extraction and verifies that the latest archive's figure is unchanged. Inventory rows link to task details.

Experimental Results follows all seven Section 4 subsections in order: Main Results, Optimization Trajectories, One Long Run versus Multiple Short Runs, Ranking Variation with Time Budget, Cost to the First Scored Submission, Performance Gains in the Second Half, and Token and Interaction Counts Across All Tasks. Figures 2–8 accompany their analysis, including the latest two-model time-allocation comparison. Original figure assets retain their vector geometry; Figure 3 uses interactive trajectories for the paper's 12 illustrative tasks. The leaderboard remains filterable, with scoring/token definitions collapsed at `#score-notes`. Complete task results and submission histories remain under Task Results.

Old Architecture/Method, Results, Behavior/Analysis, and Runs URLs are redirect stubs, preserving query strings and routing old sections to their canonical pages. Homepage `#architecture`/`#framework` and execution/specification links open Framework; `#map` opens its task inventory. Homepage leaderboard, scoring-note, and results links open Experimental Results. Legacy `#ranking`/`#tokens` open scoring notes, and `#configs` opens the leaderboard. Results citation links return to `index.html#cite`. Task and run-selection hashes remain unchanged.

Task detail pages have a visible Back button. Visits from another site page return through browser history; direct or external arrivals go to Tasks. Task filters and search text are saved on their history entry so returning restores the list without applying old filters to a new visit.

Agent Behavior (`agent-behavior.html`) follows Section 5 and current Figures 9–12: task requirements use Figure 9, testing optimizations uses Figures 10–11, and continued improvement uses Figure 12. All panels are interactive UI components, without original-PDF links. `data/behavior_original_figures.json` retains the original extraction and verifies that all four latest archive PDFs are byte-for-byte unchanged. Printed values are transcribed directly; unlabeled points and process ticks are recovered from vector coordinates and labeled approximate. The optional PDF extraction path requires PyMuPDF; normal builds use committed JSON and only Python’s standard library. Tests check printed anchors, the workload ranking reversal, two-process summaries, and bundle freshness. Previous Analysis links redirect to the corresponding question or Experimental Results section.

The default theme is light, with a saved dark-theme preference and a navigation toggle. Charts use shared theme variables and responsive dimensions.

## Deployment

`.github/workflows/pages.yml` rebuilds both bundles, checks that committed bundles are current, runs data tests and local-reference/JavaScript checks, and deploys `site/` to GitHub Pages after a push to `main`. Pages is configured to use GitHub Actions.
