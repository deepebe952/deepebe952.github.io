"""Regression tests for the data pipeline.

The extraction is checked against the paper's published final-artifact numbers (Figure 3,
Table 13); the site itself ranks each run's best valid score during the run.
"""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import build_data  # noqa: E402

REGISTRY, RAW, TOKENS = build_data.load()
DATA = build_data.compute(REGISTRY, RAW, TOKENS)
PAPER = build_data.paper_figures(REGISTRY, RAW)

# Paper, Figure 3: mean rank score per stage x level (Sol, Claude, Qwen, DeepSeek, GLM, Astra).
FIGURE_3 = {
    "training/operator": (33.3, 93.3, 53.3, 33.3, 0.0, 86.7),
    "training/module": (80.0, 0.0, 60.0, 40.0, 20.0, 100.0),
    "training/system": (73.3, 86.7, 40.0, 13.3, 6.7, 80.0),
    "inference/operator": (45.0, 95.0, 45.0, 45.0, 10.0, 60.0),
    "inference/module": (53.3, 80.0, 33.3, 40.0, 6.7, 86.7),
    "inference/system": (40.0, 93.3, 60.0, 13.3, 20.0, 73.3),
}
FIGURE_3_N = {"training/operator": 3, "training/module": 1, "training/system": 3,
              "inference/operator": 4, "inference/module": 3, "inference/system": 3}
# Paper, Table 13: mean relative score and task wins on the 17-task common subset.
TABLE_13_REL = (0.797, 0.966, 0.735, 0.655, 0.530, 0.872)
TABLE_13_WINS = (1, 10, 0, 0, 0, 6)
MODELS = ("sol", "claude", "qwen", "deepseek", "glm", "astra")


class PaperNumbers(unittest.TestCase):
    """The extracted runs reproduce the paper's final-artifact results."""

    def test_figure_3(self):
        self.assertEqual(PAPER["n"], 17)
        for group, expected in FIGURE_3.items():
            got = PAPER["groups"][group]
            self.assertEqual(got["n"], FIGURE_3_N[group], group)
            for m, v in zip(MODELS, expected):
                self.assertAlmostEqual(got["rank_score"][m], v, delta=0.05, msg=f"{group} {m}")

    def test_table_13_aggregate(self):
        for m, rel, wins in zip(MODELS, TABLE_13_REL, TABLE_13_WINS):
            self.assertAlmostEqual(PAPER["mean_relative"][m], rel, delta=0.0005, msg=m)
            self.assertEqual(PAPER["wins"][m], wins, m)


class SiteData(unittest.TestCase):
    def test_coverage(self):
        self.assertEqual(len(DATA["tasks"]), 25)
        self.assertEqual(DATA["summary"]["n_runs"], 149)
        levels = {}
        for t in DATA["tasks"]:
            levels[(t["stage"], t["level"])] = levels.get((t["stage"], t["level"]), 0) + 1
        self.assertEqual(levels, {("training", "operator"): 3, ("training", "module"): 2, ("training", "system"): 5,
                                  ("inference", "operator"): 8, ("inference", "module"): 3, ("inference", "system"): 4})
        # Astra has no run on Miles OPD; everyone else ran all 25 tasks.
        self.assertEqual(DATA["ranking"]["coverage"], {"sol": 25, "claude": 25, "qwen": 25, "deepseek": 25, "glm": 25, "astra": 24})
        self.assertEqual(sum(DATA["ranking"]["wins"].values()), 25)

    def test_best_during_run(self):
        t = {x["key"]: x for x in DATA["tasks"]}
        self.assertAlmostEqual(t["flash-kmeans"]["results"]["claude"]["best"], 208.8314, places=3)
        self.assertAlmostEqual(t["kvzip"]["results"]["sol"]["best_at_h"], 5.757, places=3)
        # A run without a valid scored submission ranks last on its task.
        wan = t["wan22"]
        self.assertIsNone(wan["results"]["glm"]["best"])
        self.assertEqual(wan["ranks"]["glm"], 6)

    def test_rank_score_is_eq6(self):
        for t in DATA["tasks"]:
            n = len(t["ranks"])
            for m, r in t["ranks"].items():
                self.assertAlmostEqual(t["contrib"][m], 100 * (n - r) / (n - 1), places=3)

    def test_serving_matches_personal_export(self):
        serving = next(t for t in DATA["tasks"] if t["key"] == "serving")
        qwen = serving["results"]["qwen"]
        self.assertEqual(qwen["n_sub"], 21)
        self.assertEqual(qwen["counts"]["valid"], 18)
        self.assertEqual(qwen["best"], 149.9)
        self.assertEqual(qwen["subs"][-1], [22.295, 144.7333, "v"])
        self.assertEqual(serving["winner"], "claude")
        self.assertEqual(serving["ranks"]["qwen"], 2)

    def test_no_final_artifact_fields(self):
        bundle = (ROOT / "site/data/infrathon.js").read_text()
        self.assertNotIn('"final"', bundle)

    def test_reasoning_effort(self):
        self.assertTrue(all(r["effort"] == "max" for t in DATA["tasks"] for r in t["results"].values()))

    def test_bundle_is_fresh(self):
        bundle = (ROOT / "site/data/infrathon.js").read_text()
        body = json.dumps(DATA, ensure_ascii=False, separators=(",", ":"))
        self.assertIn(body, bundle, "site/data/infrathon.js is stale; run scripts/build_data.py")


if __name__ == "__main__":
    unittest.main()
