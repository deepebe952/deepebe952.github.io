#!/usr/bin/env python3
"""Extract the per-run records the website needs from a dashboard export.

Input is the dashboard zip (or its extracted directory) produced by the results
pipeline: ``dashboard/tasks/<task>/<cohort>/results.html``, each page embedding a
``<script id="dashboard-data">`` JSON block.

Selection rules (same as the paper's main table):
  * one cohort per task: the folder with the latest trailing YYYYMMDD date;
  * only the six evaluated configurations (Gemini, which ran on one task only, is dropped);
  * runs explicitly voided in the export are dropped (LLaDA DeepSeek first attempt);
  * Mamba-2 keeps Sol's cloud run, not its local NVL rerun.

Output (``data/raw/runs.json``) keeps scores, timestamps and submission statuses
only; internal report links, hostnames and image digests are not copied.

Usage: python scripts/extract_dashboard.py <dashboard.zip | dashboard dir> [-o data/raw/runs.json]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_RE = re.compile(r'<script id="dashboard-data" type="application/json"[^>]*>(.*?)</script>', re.S)
PAGE_RE = re.compile(r"(?:^|/)dashboard/tasks/([^/]+)/([^/]+)/results\.html$")
DATE_RE = re.compile(r"(\d{8})$")


def iter_pages(src: Path):
    """Yield (task_dir, cohort_dir, html) for every task page in a zip or directory."""
    if src.is_file():
        with zipfile.ZipFile(src) as z:
            for name in z.namelist():
                m = PAGE_RE.search(name)
                if m:
                    yield m.group(1), m.group(2), z.read(name).decode("utf-8")
    else:
        for p in sorted(src.rglob("results.html")):
            m = PAGE_RE.search(p.as_posix())
            if m:
                yield m.group(1), m.group(2), p.read_text(encoding="utf-8")


def keep_run(task_dir: str, run: dict) -> bool:
    label = run.get("model_label", "")
    if run.get("model") == "google/gemini-4-argon":
        return False
    if "已作废" in label:  # voided attempt, superseded by a full-budget rerun
        return False
    if task_dir == "tilelang-mamba2-v2" and run.get("model") == "gpt-6.1-sol" and "NVL" in label:
        return False  # the paper's table uses Sol's cloud run
    return True


def slim_run(run: dict, model_key: str) -> dict:
    points = []
    for p in run.get("points") or []:
        score = p.get("score") if p.get("status") == "valid" else None
        points.append([round(p["elapsed_h"], 4), score, p.get("status")])
    points.sort(key=lambda x: x[0])
    final = run.get("final") or {}
    return {
        "model": model_key,
        "label": run.get("model_label"),
        "effort": run.get("effort"),
        "budget_h": run.get("budget_hours"),
        "elapsed_h": run.get("elapsed_hours"),
        "complete_budget": run.get("complete_budget"),
        "started_at": run.get("started_at"),
        "final_score": run.get("final_score"),
        "final_valid": run.get("final_valid"),
        "final_suite": final.get("suite"),
        "best_score": run.get("best_score"),
        "counts": run.get("counts"),
        "points": points,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", type=Path)
    ap.add_argument("-o", "--out", type=Path, default=ROOT / "data/raw/runs.json")
    args = ap.parse_args()

    registry = json.loads((ROOT / "data/tasks.json").read_text())
    model_by_dash = {m["dashboard_id"]: m["key"] for m in registry["models"]}
    task_by_dash = {t["dash"]: t["key"] for t in registry["tasks"]}

    cohorts: dict[str, list] = {}
    for task_dir, cohort, html in iter_pages(args.source):
        cohorts.setdefault(task_dir, []).append((cohort, html))

    out = {"source": args.source.name, "tasks": {}}
    for task_dir, items in sorted(cohorts.items()):
        if task_dir not in task_by_dash:
            print(f"skip unknown task folder {task_dir}", file=sys.stderr)
            continue
        cohort, html = max(items, key=lambda it: DATE_RE.search(it[0]).group(1))
        data = json.loads(DATA_RE.search(html).group(1))
        runs = {}
        metric = None
        for run in data["runs"]:
            if not keep_run(task_dir, run):
                continue
            key = model_by_dash.get(run["model"])
            if key is None:
                continue
            if key in runs:
                raise SystemExit(f"{task_dir}/{cohort}: two runs for {key}")
            runs[key] = slim_run(run, key)
            metric = metric or run.get("metric")
        out["tasks"][task_by_dash[task_dir]] = {
            "dash": task_dir,
            "cohort": cohort,
            "generated_at": data.get("generated_at"),
            "metric": metric,
            "runs": runs,
        }
        print(f"{task_dir:<22} {cohort:<42} {len(runs)} runs", file=sys.stderr)

    missing = set(task_by_dash.values()) - set(out["tasks"])
    if missing:
        raise SystemExit(f"missing tasks: {sorted(missing)}")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {args.out.relative_to(ROOT)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
