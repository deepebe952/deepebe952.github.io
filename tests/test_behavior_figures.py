"""Check the recovered Section 5 measurements against independent paper facts."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from extract_behavior_figures import bundle

DATA = json.loads((ROOT / "data/behavior_figures.json").read_text())


class BehaviorFigures(unittest.TestCase):
    def test_contract_figures(self):
        rows = DATA["fig8"]["logprob"]
        self.assertEqual(len(rows), 9)
        breadth = [r["difference_millinats"] for r in rows if r["breadth_one"]]
        controls = [r["difference_millinats"] for r in rows if not r["breadth_one"]]
        self.assertEqual((min(breadth), max(breadth)), (12.94, 17.87))
        self.assertEqual((min(controls), max(controls)), (2.36, 2.69))
        for points in DATA["fig8"]["error_tolerance_ratio"].values():
            self.assertEqual(len(points), 11)
            self.assertTrue(all(0 < value < 1 for value in points))

    def test_repairs_match_paper(self):
        forward = DATA["fig9"]["latency_ms"][0]
        self.assertEqual((forward["before"], forward["after"]), (74.23, 25.75))
        for row in DATA["fig9"]["launches"]:
            self.assertEqual(row["before"], 2 * row["after"])

    def test_workload_reversal_and_process_summaries(self):
        panels = DATA["fig10"]["panels"]
        self.assertEqual(len(panels), 3)
        self.assertEqual([[v["split"] for v in p["variants"]] for p in panels], [[1, 4], [1, 2, 4], [1, 2, 4]])
        for row, expected in zip(panels[0]["variants"], ([1.745, 8.020], [2.341, 3.695])):
            for actual, target in zip(row["medians_ms"], expected):
                self.assertAlmostEqual(actual, target, delta=.001)
        split1, split4 = panels[0]["variants"]
        self.assertLess(split1["medians_ms"][0], split4["medians_ms"][0])
        self.assertGreater(split1["medians_ms"][1], split4["medians_ms"][1])
        for panel in panels:
            for variant in panel["variants"]:
                for median, processes in zip(variant["medians_ms"], variant["process_medians_ms"]):
                    self.assertEqual(len(processes), 2)
                    self.assertAlmostEqual(median, sum(processes) / 2, delta=.0001)

    def test_published_bundle_is_current(self):
        self.assertEqual((ROOT / "site/data/behavior.js").read_text(), bundle(DATA))


if __name__ == "__main__":
    unittest.main()
