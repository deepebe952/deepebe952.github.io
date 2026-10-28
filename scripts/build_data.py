#!/usr/bin/env python3
"""Build the website's data bundle from the committed sources.

Inputs (all under ``data/``):
  tasks.json      task registry: names, levels, metrics, flags, ranking eligibility
  raw/runs.json   per-run scores and submissions (scripts/extract_dashboard.py)
  tokens.json     token and turn analysis summary

Output: ``site/data/infrathon.js``, which sets ``window.INFRATHON``.

Ranking uses the rank-score method of the paper (Eq. 5) applied to each run's best finite
valid score within its time budget. On a task, every configuration with a run is ranked by that score
(rank 1 = best, exact ties share the average rank; a run with no valid scored submission
ranks last) and earns 100 (n - rank) / (n - 1), where n is the number of configurations
that ran the task. A model's rank score is the mean over the tasks it ran.

The tests compare all 150 best-so-far results against Table 5 of the current paper.
"""
from __future__ import annotations

import json
import math
import random
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLASH_KMEANS_WORK_TFLOP_MS = 4694.344299  # equivalent TFLOP/s = this / weighted latency (ms)
BOOTSTRAP_SAMPLES = 10000
BOOTSTRAP_SEED = 20261023
# Compact submission status codes used in the bundle.
STATUS_CODE = {"valid": "v", "invalid": "x", "rejected": "r", "infrastructure": "n", "waiting": "w"}


def load():
    registry = json.loads((ROOT / "data/tasks.json").read_text())
    raw = json.loads((ROOT / "data/raw/runs.json").read_text())
    tokens = json.loads((ROOT / "data/tokens.json").read_text())
    return registry, raw, tokens


def to_score(task_key: str, value):
    """Orient every metric so larger is better (Flash-KMeans latency -> TFLOP/s)."""
    if value is None:
        return None
    if task_key == "flash-kmeans":
        return FLASH_KMEANS_WORK_TFLOP_MS / value if value > 0 else None
    return value


def average_ranks(scores: dict[str, float]) -> dict[str, float]:
    """Rank 1 = highest score; exact ties receive the average of their positions."""
    order = sorted(scores, key=lambda m: -scores[m])
    ranks: dict[str, float] = {}
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and scores[order[j + 1]] == scores[order[i]]:
            j += 1
        for m in order[i : j + 1]:
            ranks[m] = (i + j) / 2 + 1
        i = j + 1
    return ranks


def contributions(ranks: dict[str, float]) -> dict[str, float]:
    n = len(ranks)
    return {m: 100 * (n - r) / (n - 1) for m, r in ranks.items()} if n > 1 else {}


def rank_score(rows: list[dict[str, float]], models: list[str]) -> dict[str, float | None]:
    out = {}
    for m in models:
        vals = [r[m] for r in rows if m in r]
        out[m] = statistics.mean(vals) if vals else None
    return out


def run_summary(task_key: str, run: dict) -> dict:
    subs = [[p[0], to_score(task_key, p[1]), p[2]] for p in run["points"]]
    # Paper Eq. 39 admits only finite scores recorded within the task budget.
    # Check the native score too: infinite latency converts to finite throughput.
    # Keep every submission and its original status in the audit log below.
    valid = [s for p, s in zip(run["points"], subs)
             if s[2] == "valid"
             and p[1] is not None and math.isfinite(p[1])
             and s[1] is not None and math.isfinite(s[1])
             and math.isfinite(s[0]) and 0 <= s[0] <= run["budget_h"]]
    traj, best = [], None
    for t, s, _ in valid:
        if best is None or s > best:
            best = s
            traj.append([round(t, 3), round(s, 4)])
    counts = {k: 0 for k in STATUS_CODE}
    for s in subs:
        counts[s[2]] = counts.get(s[2], 0) + 1
    return {
        "best": 0 if best is None else round(best, 4),
        "best_at_h": traj[-1][0] if traj else None,
        "first_valid_h": round(valid[0][0], 3) if valid else None,
        "elapsed_h": round(run["elapsed_h"], 3) if run["elapsed_h"] is not None else None,
        "budget_h": run["budget_h"],
        "effort": run["effort"],
        "n_sub": len(subs),
        "counts": counts,
        "traj": traj,
        "subs": [[round(t, 3), None if s is None else round(s, 4), STATUS_CODE[st]] for t, s, st in subs],
    }


def percentile(xs: list[float], q: float) -> float:
    xs = sorted(xs)
    pos = (len(xs) - 1) * q
    lo, hi = int(pos), min(int(pos) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo)


def positions(scores: dict[str, float]) -> dict[str, int]:
    """Leaderboard position: 1 + number of models with a strictly higher score."""
    return {m: 1 + sum(1 for o in scores if scores[o] > scores[m]) for m in scores}


def kendall_tau(a: dict[str, float], b: dict[str, float]) -> float:
    ms = [m for m in a if m in b]
    conc = disc = 0
    for i in range(len(ms)):
        for j in range(i + 1, len(ms)):
            x = (a[ms[i]] - a[ms[j]]) * (b[ms[i]] - b[ms[j]])
            conc += x > 0
            disc += x < 0
    return (conc - disc) / (len(ms) * (len(ms) - 1) / 2)


def view_summary(tasks: list[dict], models: list[str]) -> dict:
    rows = [t["contrib"] for t in tasks]
    rs = rank_score(rows, models)
    wins = {m: sum(1 for t in tasks if t["ranks"].get(m) == 1) for m in models}
    coverage = {m: sum(1 for t in tasks if m in t["ranks"]) for m in models}
    rel = {}
    for m in models:
        vals = [(t["results"][m]["best"] or 0) / max(t["results"][o]["best"] or 0 for o in t["ranks"]) for t in tasks if m in t["ranks"]]
        rel[m] = round(statistics.mean(vals), 3)
    rank_counts = {m: [sum(1 for t in tasks if m in t["ranks"] and round(t["ranks"][m]) == k) for k in range(1, 7)] for m in models}

    rng = random.Random(BOOTSTRAP_SEED)
    samples = {m: [] for m in models}
    pos_hist = {m: [0] * len(models) for m in models}
    for _ in range(BOOTSTRAP_SAMPLES):
        pick = [rows[rng.randrange(len(rows))] for _ in rows]
        r = {m: v for m, v in rank_score(pick, models).items() if v is not None}
        for m, p in positions(r).items():
            pos_hist[m][p - 1] += 1
        for m, v in r.items():
            samples[m].append(v)
    bootstrap = {m: {"lo": round(percentile(samples[m], 0.025), 1), "hi": round(percentile(samples[m], 0.975), 1),
                     "p_pos": [round(c / BOOTSTRAP_SAMPLES, 4) for c in pos_hist[m]]} for m in models}

    base = positions({m: v for m, v in rs.items() if v is not None})
    lead = sorted(m for m in base if base[m] == 1)
    loo = {"leader_changes": [], "order_changes": 0, "pos_range": {m: [base[m], base[m]] for m in base}}
    for t in tasks:
        r = {m: v for m, v in rank_score([x["contrib"] for x in tasks if x is not t], models).items() if v is not None}
        pos = positions(r)
        if pos != base:
            loo["order_changes"] += 1
        if sorted(m for m in pos if pos[m] == 1) != lead:
            loo["leader_changes"].append(t["key"])
        for m in pos:
            loo["pos_range"][m] = [min(loo["pos_range"][m][0], pos[m]), max(loo["pos_range"][m][1], pos[m])]
    return {
        "n": len(tasks),
        "rank_score": {m: None if v is None else round(v, 2) for m, v in rs.items()},
        "coverage": coverage,
        "wins": wins,
        "mean_relative": rel,
        "rank_counts": rank_counts,
        "bootstrap": bootstrap,
        "leave_one_out": loo,
    }


def compute(registry, raw, tokens) -> dict:
    models = [m["key"] for m in registry["models"]]
    tasks_out = []
    for t in registry["tasks"]:
        src = raw["tasks"][t["key"]]
        results = {m: run_summary(t["key"], r) for m, r in src["runs"].items()}
        for m, r in results.items():
            r["flag"] = t["flags"].get(m)
        # Every configuration that ran the task is ranked; a run with no valid score ranks last.
        scores = {m: (r["best"] if r["best"] is not None else float("-inf")) for m, r in results.items()}
        ranks = average_ranks(scores)
        entry = {k: t[k] for k in ("key", "name", "short", "stage", "level", "budget_h", "metric", "start", "gpus", "target", "summary")}
        entry.update({
            "note": t.get("note"),
            "flags": t["flags"],
            "unit": "TFLOP/s (equiv.)" if t["key"] == "flash-kmeans" else (src["metric"] or {}).get("unit"),
            "cohort": src["cohort"],
            "winner": min(ranks, key=ranks.get),
            "results": results,
            "ranks": ranks,
            "contrib": {m: round(v, 4) for m, v in contributions(ranks).items()},
        })
        tasks_out.append(entry)

    first_valid = {}
    for m in models:
        hs = [t["results"][m]["first_valid_h"] for t in tasks_out if m in t["results"] and t["results"][m]["first_valid_h"] is not None]
        first_valid[m] = {"median_h": round(statistics.median(hs), 2), "n": len(hs)}
    status_totals = {m: {k: sum(t["results"][m]["counts"][k] for t in tasks_out if m in t["results"]) for k in STATUS_CODE} for m in models}

    return {
        "snapshot": raw.get("snapshot") or "2026-10-23",
        "source": raw["source"],
        "models": registry["models"],
        "flag_legend": registry["flag_legend"],
        "tasks": tasks_out,
        "ranking": view_summary(tasks_out, models),
        "summary": {
            "n_runs": sum(len(t["results"]) for t in tasks_out),
            "n_submissions": sum(t["results"][m]["n_sub"] for t in tasks_out for m in t["results"]),
            "first_valid": first_valid,
            "status_totals": status_totals,
        },
        "tokens": tokens,
    }


def main() -> int:
    data = compute(*load())
    out = ROOT / "site/data/infrathon.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    out.write_text("/* Generated by scripts/build_data.py. Do not edit. */\nwindow.INFRATHON=" + body + ";\n")
    print(f"wrote {out.relative_to(ROOT)} ({len(body) / 1024:.0f} KB)", file=sys.stderr)
    v = data["ranking"]
    for m in sorted(v["rank_score"], key=lambda m: -v["rank_score"][m]):
        b = v["bootstrap"][m]
        print(f"  {m:<9} {v['rank_score'][m]:6.2f}  CI [{b['lo']:5.1f}, {b['hi']:5.1f}]  P1 {b['p_pos'][0]:.3f}  wins {v['wins'][m]:>2}  ran {v['coverage'][m]}  rel {v['mean_relative'][m]:.3f}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
