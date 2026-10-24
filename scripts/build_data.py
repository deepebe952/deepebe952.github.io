#!/usr/bin/env python3
"""Build the website's data bundle from the committed sources.

Inputs (all under ``data/``):
  tasks.json      task registry: names, levels, metrics, flags, ranking eligibility
  raw/runs.json   per-run scores and submissions (scripts/extract_dashboard.py)
  tokens.json     token and turn analysis summary

Output: ``site/data/infrathon.js``, which sets ``window.INFRATHON``.

Ranking follows the paper's Eq. 6. On a task, the configurations with a numeric final are
ranked by score (rank 1 = best, exact ties share the average rank) and configuration m
earns 100 (n - rank) / (n - 1), where n is the number of ranked configurations. A model's
rank score is the mean over the tasks it is ranked on. Two views are published:

  all    every one of the 25 tasks; results are used as recorded, and a configuration
         without a numeric final (no run, no final, failed final) is left out of that
         task rather than counted as zero.
  paper  the paper's 17 tasks where all six configurations have a comparable final;
         here n = 6 on every task and the score is exactly Eq. 6.
"""
from __future__ import annotations

import json
import random
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLASH_KMEANS_WORK_TFLOP_MS = 4694.344299  # equivalent TFLOP/s = this / weighted latency (ms)
BOOTSTRAP_SAMPLES = 10000
BOOTSTRAP_SEED = 20261023
# Runs kept in the tables but not drawn on shared trajectory axes (paper, Appendix B).
HIDDEN_CURVES = {("mamba2", "astra")}
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
    valid = [s for s in subs if s[2] == "valid" and s[1] is not None]
    traj, best = [], None
    for t, s, _ in valid:
        if best is None or s > best:
            best = s
            traj.append([round(t, 3), round(s, 4)])
    final = to_score(task_key, run["final_score"])
    counts = {k: 0 for k in STATUS_CODE}
    for s in subs:
        counts[s[2]] = counts.get(s[2], 0) + 1
    return {
        "final": None if final is None else round(final, 4),
        "best": None if best is None else round(best, 4),
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
        vals = [t["results"][m]["final"] / max(t["results"][o]["final"] for o in t["ranks"]) for t in tasks if m in t["ranks"]]
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

    changes = []
    taus = []
    for t in tasks:
        fw = sorted(m for m, r in t["ranks"].items() if r == 1)
        bw = sorted(m for m, r in t["ranks_best"].items() if r == 1)
        if fw != bw:
            changes.append({"task": t["key"], "final_winner": fw, "best_winner": bw})
        common = {m: -t["ranks"][m] for m in t["ranks"] if m in t["ranks_best"]}
        if len(common) > 2:
            taus.append(kendall_tau(common, {m: -t["ranks_best"][m] for m in common}))
    return {
        "n": len(tasks),
        "tasks": [t["key"] for t in tasks],
        "rank_score": {m: None if v is None else round(v, 2) for m, v in rs.items()},
        "rank_score_best": {m: None if v is None else round(v, 2) for m, v in rank_score([t["contrib_best"] for t in tasks], models).items()},
        "coverage": coverage,
        "wins": wins,
        "mean_relative": rel,
        "rank_counts": rank_counts,
        "bootstrap": bootstrap,
        "leave_one_out": loo,
        "winner_changes": changes,
        "mean_kendall_tau": round(statistics.mean(taus), 3),
    }


def compute(registry, raw, tokens) -> dict:
    models = [m["key"] for m in registry["models"]]
    tasks_out = []
    for t in registry["tasks"]:
        src = raw["tasks"][t["key"]]
        results = {m: run_summary(t["key"], r) for m, r in src["runs"].items()}
        for m, r in results.items():
            r["flag"] = t["flags"].get(m)
            r["hide_curve"] = (t["key"], m) in HIDDEN_CURVES
        finals = {m: r["final"] for m, r in results.items() if r["final"] is not None}
        bests = {m: r["best"] for m, r in results.items() if r["best"] is not None}
        ranks, ranks_best = average_ranks(finals), average_ranks(bests)
        unflagged = {m: v for m, v in finals.items() if t["flags"].get(m) in (None, "x")}
        paper_winner = max(unflagged, key=unflagged.get) if len(unflagged) >= 2 and t["key"] != "opd" else None
        entry = {k: t[k] for k in ("key", "name", "short", "stage", "level", "budget_h", "metric", "start", "gpus", "target", "summary", "ranked")}
        entry.update({
            "exclusion": t.get("exclusion"),
            "flags": t["flags"],
            "unit": "TFLOP/s (equiv.)" if t["key"] == "flash-kmeans" else (src["metric"] or {}).get("unit"),
            "cohort": src["cohort"],
            "winner": min(ranks, key=ranks.get) if ranks else None,
            "paper_winner": paper_winner,
            "results": results,
            "ranks": ranks,
            "ranks_best": ranks_best,
            "contrib": {m: round(v, 4) for m, v in contributions(ranks).items()},
            "contrib_best": {m: round(v, 4) for m, v in contributions(ranks_best).items()},
        })
        if t["ranked"]:
            assert set(finals) == set(models), f"{t['key']}: paper-ranked task needs six finals"
        tasks_out.append(entry)

    paper = [t for t in tasks_out if t["ranked"]]
    groups = {}
    for stage in ("training", "inference"):
        for level in ("operator", "module", "system"):
            sel = [t for t in paper if t["stage"] == stage and t["level"] == level]
            groups[f"{stage}/{level}"] = {"n": len(sel), "rank_score": {m: round(v, 2) for m, v in rank_score([t["contrib"] for t in sel], models).items()}}

    drops, n_compared = [], 0
    for t in tasks_out:
        for m, r in t["results"].items():
            if r["final"] is None or r["best"] is None or r["flag"] in ("P", "F", "*"):
                continue
            n_compared += 1
            change = r["final"] / r["best"] - 1 if r["best"] > 0 else 0.0
            if change <= -0.10:
                drops.append({"task": t["key"], "model": m, "best": r["best"], "final": r["final"], "change": round(change, 4)})
    drops.sort(key=lambda d: d["change"])

    first_valid = {}
    for m in models:
        hs = [t["results"][m]["first_valid_h"] for t in tasks_out if m in t["results"] and t["results"][m]["first_valid_h"] is not None]
        first_valid[m] = {"median_h": round(statistics.median(hs), 2), "n": len(hs)}
    status_totals = {m: {k: sum(t["results"][m]["counts"][k] for t in tasks_out if m in t["results"]) for k in STATUS_CODE} for m in models}

    return {
        "snapshot": "2026-10-23",
        "source": raw["source"],
        "models": registry["models"],
        "flag_legend": registry["flag_legend"],
        "tasks": tasks_out,
        "views": {"all": view_summary(tasks_out, models), "paper": view_summary(paper, models)},
        "paper_groups": groups,
        "summary": {
            "n_runs": sum(len(t["results"]) for t in tasks_out),
            "n_submissions": sum(t["results"][m]["n_sub"] for t in tasks_out for m in t["results"]),
            "first_valid": first_valid,
            "status_totals": status_totals,
        },
        "drops": {"rows": drops, "n_compared": n_compared},
        "tokens": tokens,
    }


def main() -> int:
    data = compute(*load())
    out = ROOT / "site/data/infrathon.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    out.write_text("/* Generated by scripts/build_data.py. Do not edit. */\nwindow.INFRATHON=" + body + ";\n")
    print(f"wrote {out.relative_to(ROOT)} ({len(body) / 1024:.0f} KB)", file=sys.stderr)
    for view, v in data["views"].items():
        print(f"  [{view}: {v['n']} tasks]", file=sys.stderr)
        for m in sorted(v["rank_score"], key=lambda m: -(v["rank_score"][m] or -1)):
            b = v["bootstrap"][m]
            print(f"    {m:<9} {v['rank_score'][m]:6.2f}  CI [{b['lo']:5.1f}, {b['hi']:5.1f}]  P1 {b['p_pos'][0]:.3f}  wins {v['wins'][m]:>2}  cov {v['coverage'][m]}  rel {v['mean_relative'][m]:.3f}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
