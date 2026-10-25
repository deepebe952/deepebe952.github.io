"""Regression tests for the data pipeline.

The extraction is checked against all 150 best-so-far results in the current paper's Table 4.
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
PAPER_TABLE = json.loads((ROOT / "tests/paper_table4.json").read_text())


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


if __name__ == "__main__":
    unittest.main()
