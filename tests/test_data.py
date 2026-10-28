"""Regression tests for the data pipeline.

The extraction is checked against all 150 best-so-far results in the current paper's Table 5.
"""
import json
import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import build_data  # noqa: E402

REGISTRY, RAW, TOKENS = build_data.load()
DATA = build_data.compute(REGISTRY, RAW, TOKENS)
PAPER_TABLE = json.loads((ROOT / "tests/paper_table4.json").read_text())


class RunSummary(unittest.TestCase):
    @staticmethod
    def fixture_run(points):
        return {"points": points, "budget_h": 12, "elapsed_h": 13, "effort": "max"}

    def test_only_finite_within_budget_scores_affect_performance(self):
        eligible = [[1, 10, "valid"], [12, 20, "valid"]]
        points = [[0.1, math.nan, "valid"], [0.2, math.inf, "valid"],
                  [0.3, -math.inf, "valid"], [0.5, 999, "invalid"],
                  *eligible, [12.0001, 999, "valid"]]
        baseline = build_data.run_summary("attn-qat", self.fixture_run(eligible))
        summary = build_data.run_summary("attn-qat", self.fixture_run(points))
        for key in ("best", "best_at_h", "first_valid_h", "traj"):
            self.assertEqual(summary[key], baseline[key], key)
        self.assertEqual(summary["best"], 20)
        self.assertEqual(summary["first_valid_h"], 1)
        self.assertEqual(summary["traj"], [[1, 10], [12, 20]])
        self.assertEqual(summary["n_sub"], 7)
        self.assertEqual(summary["counts"]["valid"], 6)
        self.assertEqual(summary["counts"]["invalid"], 1)
        self.assertEqual(len(summary["subs"]), 7)
        self.assertTrue(math.isnan(summary["subs"][0][1]))
        self.assertEqual(summary["subs"][1][1], math.inf)
        self.assertEqual(summary["subs"][2][1], -math.inf)
        self.assertEqual(summary["subs"][-1], [12.0, 999, "v"])

    def test_no_eligible_score_still_returns_zero_with_audit_records(self):
        # Infinite native latency would otherwise become a finite zero score.
        for task_key in ("attn-qat", "flash-kmeans"):
            with self.subTest(task=task_key):
                points = [[0.1, math.inf, "valid"], [0.2, None, "valid"],
                          [1, 10, "rejected"], [12.1, 1, "valid"]]
                summary = build_data.run_summary(task_key, self.fixture_run(points))
                self.assertEqual(summary["best"], 0)
                self.assertEqual(summary["traj"], [])
                self.assertIsNone(summary["best_at_h"])
                self.assertIsNone(summary["first_valid_h"])
                self.assertEqual(summary["n_sub"], 4)
                self.assertEqual(summary["counts"]["valid"], 3)
                self.assertEqual(summary["counts"]["rejected"], 1)
                self.assertEqual([s[2] for s in summary["subs"]], ["v", "v", "r", "v"])


class PaperNumbers(unittest.TestCase):
    def test_all_table_4_scores(self):
        for task in DATA["tasks"]:
            for model, expected in PAPER_TABLE[task["key"]].items():
                self.assertAlmostEqual(task["results"][model]["best"], expected, delta=0.0051,
                                       msg=f"{task['key']} {model}")

    def test_table_4_wins(self):
        self.assertEqual(DATA["ranking"]["wins"],
                         {"sol": 1, "claude": 17, "qwen": 1, "deepseek": 0, "glm": 0, "astra": 6})


class SiteData(unittest.TestCase):
    def test_coverage(self):
        self.assertEqual(len(DATA["tasks"]), 25)
        self.assertEqual(DATA["summary"]["n_runs"], 150)
        levels = {}
        for t in DATA["tasks"]:
            levels[(t["stage"], t["level"])] = levels.get((t["stage"], t["level"]), 0) + 1
        self.assertEqual(levels, {("training", "operator"): 3, ("training", "module"): 2, ("training", "system"): 5,
                                  ("inference", "operator"): 8, ("inference", "module"): 3, ("inference", "system"): 4})
        # All six configurations cover all 25 tasks, including Astra’s earlier OPD run.
        self.assertEqual(DATA["ranking"]["coverage"], {"sol": 25, "claude": 25, "qwen": 25, "deepseek": 25, "glm": 25, "astra": 25})
        self.assertEqual(sum(DATA["ranking"]["wins"].values()), 25)

    def test_best_during_run(self):
        t = {x["key"]: x for x in DATA["tasks"]}
        self.assertAlmostEqual(t["flash-kmeans"]["results"]["claude"]["best"], 208.8314, places=3)
        self.assertAlmostEqual(t["kvzip"]["results"]["sol"]["best_at_h"], 5.757, places=3)
        # A run without a valid scored submission ranks last on its task.
        wan = t["wan22"]
        self.assertEqual(wan["results"]["glm"]["best"], 0)
        self.assertEqual(wan["ranks"]["glm"], 6)

    def test_rank_score_is_eq5(self):
        for t in DATA["tasks"]:
            n = len(t["ranks"])
            for m, r in t["ranks"].items():
                self.assertAlmostEqual(t["contrib"][m], 100 * (n - r) / (n - 1), places=3)

    def test_serving_restores_agent_22(self):
        serving = next(t for t in DATA["tasks"] if t["key"] == "serving")
        qwen = serving["results"]["qwen"]
        self.assertEqual(qwen["n_sub"], 22)
        self.assertEqual(qwen["counts"]["valid"], 19)
        self.assertEqual(qwen["best"], 154.3333)
        self.assertEqual(qwen["subs"][-1], [23.318, 154.3333, "v"])
        self.assertEqual(serving["winner"], "qwen")
        self.assertEqual(serving["ranks"]["qwen"], 1)

    def test_opd_includes_earlier_astra_run(self):
        opd = next(t for t in DATA["tasks"] if t["key"] == "opd")
        self.assertEqual(opd["results"]["astra"]["best"], 15.1678)
        self.assertEqual(opd["results"]["astra"]["n_sub"], 11)
        self.assertEqual(opd["results"]["astra"]["elapsed_h"], 24)
        self.assertEqual(RAW["tasks"]["opd"]["runs"]["astra"]["id"], "opd-astra-max-24h-20261018-102917")

    def test_no_final_artifact_fields(self):
        bundle = (ROOT / "site/data/infrathon.js").read_text()
        self.assertNotIn('"final"', bundle)

    def test_reasoning_effort(self):
        self.assertTrue(all(r["effort"] == "max" for t in DATA["tasks"] for r in t["results"].values()))

    def test_bundle_is_fresh(self):
        bundle = (ROOT / "site/data/infrathon.js").read_text()
        body = json.dumps(DATA, ensure_ascii=False, separators=(",", ":"))
        self.assertIn(body, bundle, "site/data/infrathon.js is stale; run scripts/build_data.py")


class PaperDistributions(unittest.TestCase):
    def test_digitized_times_match_independent_run_histories(self):
        recovered = TOKENS["first_score_distributions"]["metrics"]["elapsed"]
        for model, row in recovered.items():
            actual = sorted(t["results"][model]["first_valid_h"] for t in DATA["tasks"]
                            if t["results"][model]["first_valid_h"] is not None)
            self.assertEqual(len(actual), len(row["points"]))
            for a, b in zip(actual, row["points"]):
                self.assertAlmostEqual(a, b, delta=.001, msg=model)

    def test_figure5_counts_and_summaries(self):
        for metric, models in TOKENS["first_score_distributions"]["metrics"].items():
            self.assertEqual(sum(len(row["points"]) for row in models.values()), 149)
            for model, row in models.items():
                self.assertEqual(len(row["points"]), 24 if model == "glm" else 25)
                self.assertTrue(all(v > 0 for v in row["points"]))
                for key, q in (("q1", .25), ("median", .5), ("q3", .75)):
                    expected = build_data.percentile(row["points"], q)
                    self.assertAlmostEqual(row[key], expected, delta=max(.001, expected * .0001))
                if metric == "actions":
                    for v in row["points"]:
                        self.assertAlmostEqual(v, round(v), delta=.01)

    def test_figure11_uses_matching_denominators(self):
        behavior = TOKENS["behavior"]
        for half in behavior["halves"]:
            self.assertEqual(sum(half["counts"]), behavior["n_runs"])
        for case, gain in zip(behavior["completion"], [24.8, 3.1, 14.0]):
            self.assertAlmostEqual((case["after"] / case["before"] - 1) * 100, gain, delta=.05)


if __name__ == "__main__":
    unittest.main()
