"""Regression tests: the site's numbers must reproduce the paper's published figures."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import build_data  # noqa: E402

DATA = build_data.compute(*build_data.load())

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
    def test_coverage(self):
        self.assertEqual(len(DATA["tasks"]), 25)
        self.assertEqual(DATA["summary"]["n_runs"], 149)
        self.assertEqual(DATA["groups"]["all"]["n"], 17)
        levels = {}
        for t in DATA["tasks"]:
            levels[(t["stage"], t["level"])] = levels.get((t["stage"], t["level"]), 0) + 1
        self.assertEqual(levels, {("training", "operator"): 3, ("training", "module"): 2, ("training", "system"): 5,
                                  ("inference", "operator"): 8, ("inference", "module"): 3, ("inference", "system"): 4})

    def test_figure_3(self):
        for group, expected in FIGURE_3.items():
            got = DATA["groups"][group]
            self.assertEqual(got["n"], FIGURE_3_N[group], group)
            for m, v in zip(MODELS, expected):
                self.assertAlmostEqual(got["rank_score"][m], v, delta=0.05, msg=f"{group} {m}")

    def test_table_13_aggregate(self):
        for m, rel, wins in zip(MODELS, TABLE_13_REL, TABLE_13_WINS):
            self.assertAlmostEqual(DATA["summary"]["mean_relative"][m], rel, delta=0.0005, msg=m)
            self.assertEqual(DATA["summary"]["wins"][m], wins, m)

    def test_flash_kmeans_conversion(self):
        fk = next(t for t in DATA["tasks"] if t["key"] == "flash-kmeans")
        self.assertAlmostEqual(fk["results"]["claude"]["final"], 206.08, delta=0.01)

    def test_flagged_entries(self):
        mi = next(t for t in DATA["tasks"] if t["key"] == "minference")
        self.assertIsNone(mi["results"]["astra"]["final"])
        self.assertEqual(mi["results"]["deepseek"]["flag"], "†")
        opd = next(t for t in DATA["tasks"] if t["key"] == "opd")
        self.assertNotIn("astra", opd["results"])
        self.assertIsNone(opd["winner"])

    def test_bundle_is_fresh(self):
        bundle = (ROOT / "site/data/infrathon.js").read_text()
        body = json.dumps(DATA, ensure_ascii=False, separators=(",", ":"))
        self.assertIn(body, bundle, "site/data/infrathon.js is stale; run scripts/build_data.py")


if __name__ == "__main__":
    unittest.main()
