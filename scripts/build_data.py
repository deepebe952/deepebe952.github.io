#!/usr/bin/env python3
"""Build the website's data bundle from the committed sources.

Inputs (all under ``data/``):
  tasks.json      task registry: names, levels, metrics, flags, ranking eligibility
  raw/runs.json   per-run scores and submissions (scripts/extract_dashboard.py)
  tokens.json     token and turn analysis summary

Output: ``site/data/infrathon.js``, which sets ``window.INFRATHON``.

Ranking follows the paper (Eq. 6): on each ranked task the K = 6 configurations are
ranked by final score (rank 1 = best, exact ties share the average rank), and
RankScore(G) = 100 / (|G| (K-1)) * sum over tasks of (K - rank).
"""
from __future__ import annotations

import json
import random
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
K = 6
FLASH_KMEANS_WORK_TFLOP_MS = 4694.344299  # equivalent TFLOP/s = this / weighted latency (ms)
BOOTSTRAP_SAMPLES = 10000
BOOTSTRAP_SEED = 20261023
# Runs kept in the tables but not drawn on shared trajectory axes (paper, Appendix B).
HIDDEN_CURVES = {("mamba2", "astra")}
# Compact submission status codes used in the bundle.
STATUS_CODE = {"valid": "v", "invalid": "x", "infrastructure": "n", "waiting": "w"}


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
        avg = (i + j) / 2 + 1
        for m in order[i : j + 1]:
            ranks[m] = avg
        i = j + 1
    return ranks


def rank_score(rank_rows: list[dict[str, float]], models: list[str]) -> dict[str, float]:
    n = len(rank_rows)
    return {m: 100 * sum(K - r[m] for r in rank_rows) / (n * (K - 1)) for m in models}


def run_summary(task_key: str, run: dict) -> dict:
    pts = run["points"]
    subs = [[p[0], to_score(task_key, p[1]), p[2]] for p in pts]
    valid = [s for s in subs if s[2] == "valid" and s[1] is not None]
    traj, best = [], None
    for t, s, _ in valid:
        if best is None or s > best:
            best = s
            traj.append([round(t, 3), round(s, 4)])
    final = to_score(task_key, run["final_score"])
    counts = {"valid": 0, "invalid": 0, "infrastructure": 0, "waiting": 0}
    for s in subs:
        counts[s[2]] = counts.get(s[2], 0) + 1
    return {
        "final": None if final is None else round(final, 4),
        "best": None if best is None else round(best, 4),
        "first_valid_h": round(valid[0][0], 3) if valid else None,
        "first_sub_h": round(subs[0][0], 3) if subs else None,
        "first_try_valid": bool(subs) and subs[0][2] == "valid",
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
    ms = list(a)
    conc = disc = 0
    for i in range(len(ms)):
        for j in range(i + 1, len(ms)):
            x = (a[ms[i]] - a[ms[j]]) * (b[ms[i]] - b[ms[j]])
            if x > 0:
                conc += 1
            elif x < 0:
                disc += 1
    total = len(ms) * (len(ms) - 1) / 2
    return (conc - disc) / total


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
        unflagged = {m: v for m, v in finals.items() if t["flags"].get(m) in (None, "x")}
        winner = max(unflagged, key=unflagged.get) if len(unflagged) >= 2 and t["key"] != "opd" else None
        metric = src["metric"] or {}
        entry = {k: t[k] for k in ("key", "name", "stage", "level", "budget_h", "metric", "start", "gpus", "target", "summary", "ranked")}
        entry.update({
            "exclusion": t.get("exclusion"),
            "flags": t["flags"],
            "unit": "TFLOP/s (equiv.)" if t["key"] == "flash-kmeans" else metric.get("unit"),
            "cohort": src["cohort"],
            "winner": winner,
            "results": results,
        })
        if t["ranked"]:
            assert set(finals) == set(models), f"{t['key']}: ranked task needs six finals"
            entry["ranks"] = average_ranks(finals)
            bests = {m: results[m]["best"] if results[m]["best"] is not None else float("-inf") for m in models}
            entry["ranks_best"] = average_ranks(bests)
        tasks_out.append(entry)

    ranked = [t for t in tasks_out if t["ranked"]]
    groups = {"all": ranked}
    for stage in ("training", "inference"):
        groups[stage] = [t for t in ranked if t["stage"] == stage]
        for level in ("operator", "module", "system"):
            groups[f"{stage}/{level}"] = [t for t in ranked if t["stage"] == stage and t["level"] == level]
    for level in ("operator", "module", "system"):
        groups[level] = [t for t in ranked if t["level"] == level]

    leaderboard = {}
    for g, ts in groups.items():
        leaderboard[g] = {
            "n": len(ts),
            "tasks": [t["key"] for t in ts],
            "rank_score": {m: round(v, 2) for m, v in rank_score([t["ranks"] for t in ts], models).items()},
            "rank_score_best": {m: round(v, 2) for m, v in rank_score([t["ranks_best"] for t in ts], models).items()},
        }

    # Mean relative score and wins on the common subset (paper Table 13, Eq. 7).
    rel = {m: statistics.mean(t["results"][m]["final"] / max(t["results"][o]["final"] for o in models) for t in ranked) for m in models}
    wins = {m: sum(1 for t in ranked if t["winner"] == m) for m in models}
    rank_counts = {m: [sum(1 for t in ranked if round(t["ranks"][m]) == k) for k in range(1, K + 1)] for m in models}
    rank_range = {m: [min(t["ranks"][m] for t in ranked), max(t["ranks"][m] for t in ranked)] for m in models}

    # Bootstrap over tasks: how much does the overall ordering move if the task set changes?
    rng = random.Random(BOOTSTRAP_SEED)
    rows = [t["ranks"] for t in ranked]
    samples = {m: [] for m in models}
    pos_hist = {m: [0] * K for m in models}
    for _ in range(BOOTSTRAP_SAMPLES):
        pick = [rows[rng.randrange(len(rows))] for _ in rows]
        rs = rank_score(pick, models)
        for m, p in positions(rs).items():
            pos_hist[m][p - 1] += 1
        for m in models:
            samples[m].append(rs[m])
    bootstrap = {
        m: {
            "lo": round(percentile(samples[m], 0.025), 1),
            "hi": round(percentile(samples[m], 0.975), 1),
            "p_pos": [round(c / BOOTSTRAP_SAMPLES, 4) for c in pos_hist[m]],
        }
        for m in models
    }

    # Leave-one-task-out: does removing a single task change the leader or the order?
    base_pos = positions(leaderboard["all"]["rank_score"])
    loo = {"leader_changes": [], "order_changes": 0, "pos_range": {m: [base_pos[m], base_pos[m]] for m in models}}
    for t in ranked:
        rs = rank_score([r["ranks"] for r in ranked if r is not t], models)
        pos = positions(rs)
        if pos != base_pos:
            loo["order_changes"] += 1
        lead = [m for m in models if pos[m] == 1]
        if lead != [m for m in models if base_pos[m] == 1]:
            loo["leader_changes"].append({"removed": t["key"], "leaders": lead})
        for m in models:
            lo, hi = loo["pos_range"][m]
            loo["pos_range"][m] = [min(lo, pos[m]), max(hi, pos[m])]

    # Final artifact vs best interaction score.
    endpoint = {
        "winner_changes": [
            {"task": t["key"], "final_winner": t["winner"], "best_winner": min(models, key=lambda m: t["ranks_best"][m])}
            for t in ranked
            if min(models, key=lambda m: t["ranks_best"][m]) != t["winner"]
        ],
        "mean_kendall_tau": round(statistics.mean(kendall_tau({m: -t["ranks"][m] for m in models}, {m: -t["ranks_best"][m] for m in models}) for t in ranked), 3),
    }
    drops = []
    n_compared = 0
    for t in tasks_out:
        for m, r in t["results"].items():
            if r["final"] is None or r["best"] is None or r["flag"] in ("P", "F", "*"):
                continue
            n_compared += 1
            change = r["final"] / r["best"] - 1 if r["best"] > 0 else 0.0
            if change <= -0.10:
                drops.append({"task": t["key"], "model": m, "best": r["best"], "final": r["final"], "change": round(change, 4)})
    drops.sort(key=lambda d: d["change"])
    endpoint["drops"] = drops
    endpoint["n_compared"] = n_compared

    # Time to first valid scored submission, from the submission logs (all 149 runs).
    first_valid = {}
    for m in models:
        hs = [t["results"][m]["first_valid_h"] for t in tasks_out if m in t["results"] and t["results"][m]["first_valid_h"] is not None]
        subs = [t["results"][m]["n_sub"] for t in tasks_out if m in t["results"]]
        first_valid[m] = {"median_h": round(statistics.median(hs), 2), "n": len(hs), "median_submissions": statistics.median(subs)}

    head_to_head = {a: {b: sum(1 for t in ranked if t["ranks"][a] < t["ranks"][b]) for b in models if b != a} for a in models}

    total_subs = sum(t["results"][m]["n_sub"] for t in tasks_out for m in t["results"])
    return {
        "snapshot": "2026-10-23",
        "source": raw["source"],
        "models": registry["models"],
        "flag_legend": registry["flag_legend"],
        "tasks": tasks_out,
        "groups": leaderboard,
        "summary": {
            "n_runs": sum(len(t["results"]) for t in tasks_out),
            "n_submissions": total_subs,
            "mean_relative": {m: round(v, 3) for m, v in rel.items()},
            "wins": wins,
            "rank_counts": rank_counts,
            "rank_range": rank_range,
            "bootstrap": bootstrap,
            "bootstrap_samples": BOOTSTRAP_SAMPLES,
            "leave_one_out": loo,
            "head_to_head": head_to_head,
            "first_valid": first_valid,
        },
        "endpoint": endpoint,
        "tokens": tokens,
    }


def main() -> int:
    data = compute(*load())
    out = ROOT / "site/data/infrathon.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    out.write_text("/* Generated by scripts/build_data.py. Do not edit. */\nwindow.INFRATHON=" + body + ";\n")
    lb = data["groups"]["all"]
    print(f"wrote {out.relative_to(ROOT)} ({len(body) / 1024:.0f} KB)", file=sys.stderr)
    for m in sorted(lb["rank_score"], key=lambda m: -lb["rank_score"][m]):
        b = data["summary"]["bootstrap"][m]
        print(f"  {m:<9} rank score {lb['rank_score'][m]:6.2f}  95% CI [{b['lo']:5.1f}, {b['hi']:5.1f}]  wins {data['summary']['wins'][m]:>2}  rel {data['summary']['mean_relative'][m]:.3f}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
