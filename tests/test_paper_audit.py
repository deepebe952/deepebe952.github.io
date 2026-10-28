"""Independent checks against Eq. 5 and published score/cost measurements.

Costs were extracted from Figures 7 and 14 of the 49-page paper and verified
against Figures 8 and 15 in the latest Overleaf archive. Token cells are rounded
to thousands; action cells are integer counts, not a fresh tokenizer pass.
"""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_data

REGISTRY, RAW, TOKENS = build_data.load()
MODEL_ORDER = [m["key"] for m in REGISTRY["models"]]
TABLE5 = json.loads((ROOT / "tests/paper_table4.json").read_text())


class PaperRankingAudit(unittest.TestCase):
    def test_eq5_matches_paper_category_scores(self):
        # Six panels of Figure 2, each in the paper's model order.
        expected = {
            ("training", "operator"): [46.7, 93.3, 46.7, 26.7, 0, 86.7],
            ("training", "module"): [60, 90, 40, 10, 10, 90],
            ("training", "system"): [52, 92, 44, 32, 8, 72],
            ("inference", "operator"): [60, 95, 37.5, 35, 7.5, 65],
            ("inference", "module"): [53.3, 80, 33.3, 40, 6.7, 86.7],
            ("inference", "system"): [45, 90, 45, 25, 20, 75],
        }
        rows = {}
        for task in REGISTRY["tasks"]:
            # Table 5 was renumbered from Table 4; all 150 printed cells agree.
            ranks = build_data.average_ranks(TABLE5[task["key"]])
            rows.setdefault((task["stage"], task["level"]), []).append(build_data.contributions(ranks))
        for group, printed in expected.items():
            actual = build_data.rank_score(rows[group], MODEL_ORDER)
            for model, value in zip(MODEL_ORDER, printed):
                self.assertAlmostEqual(actual[model], value, delta=.051, msg=f"{group}: {model}")
        overall = build_data.rank_score([row for group in rows.values() for row in group], MODEL_ORDER)
        self.assertEqual(overall, {"sol": 53.6, "claude": 91.2, "qwen": 40.8,
                                   "deepseek": 30.4, "glm": 8.8, "astra": 75.2})

    def test_exact_ties_receive_average_ranks(self):
        scores = dict(zip(MODEL_ORDER, [10, 10, 6, 5, 0, 0]))
        self.assertEqual(build_data.average_ranks(scores),
                         dict(zip(MODEL_ORDER, [1.5, 1.5, 3, 4, 5.5, 5.5])))


class PaperTokenAudit(unittest.TestCase):
    def test_first_score_action_medians_match_section45(self):
        # Latest main.tex Section 4.5: median actions before matched scored feedback.
        # The October 25 highlight had 253 for Qwen; the current paper reports 248.
        self.assertEqual(TOKENS["highlights"]["first_actions_sol"], 71)
        self.assertEqual(TOKENS["highlights"]["first_actions_qwen"], 248)

    def test_every_primary_run_has_a_cost_record(self):
        records = TOKENS["per_task"]
        self.assertEqual(set(records), {t["key"] for t in REGISTRY["tasks"]})
        self.assertEqual(sum(len(v) for v in records.values()), 150)
        for task, models in records.items():
            self.assertEqual(set(models), set(MODEL_ORDER), task)
            for model, value in models.items():
                self.assertIsInstance(value["visible_output_k"], int)
                self.assertGreater(value["visible_output_k"], 0)
                self.assertIsInstance(value["actions"], int)
                self.assertGreater(value["actions"], 0)
        # First and last rows pin down matrix orientation and task/model ordering.
        self.assertEqual([records["attn-qat"][m]["visible_output_k"] for m in MODEL_ORDER],
                         [141, 305, 159, 218, 79, 253])
        self.assertEqual([records["serving"][m]["actions"] for m in MODEL_ORDER],
                         [1940, 606, 1799, 843, 675, 1943])

    def test_figure14_cost_totals_match_figure7(self):
        printed_tokens = dict(zip(MODEL_ORDER, [4.64, 7.35, 8.18, 5.94, 3.60, 6.68]))
        printed_actions = dict(zip(MODEL_ORDER, [36.8, 22.8, 37.1, 31.1, 24.1, 51.4]))
        action_count = 0
        token_k = 0
        for model in MODEL_ORDER:
            summed_tokens_k = sum(v[model]["visible_output_k"] for v in TOKENS["per_task"].values())
            summed_actions = sum(v[model]["actions"] for v in TOKENS["per_task"].values())
            self.assertEqual(round(summed_tokens_k / 1000, 2), printed_tokens[model])
            self.assertEqual(TOKENS["models"][model]["visible_output_m"], printed_tokens[model])
            self.assertEqual(round(summed_actions / 1000, 1), printed_actions[model])
            self.assertEqual(TOKENS["models"][model]["actions_k"], printed_actions[model])
            action_count += summed_actions
            token_k += summed_tokens_k
        self.assertEqual(action_count, 203266)
        self.assertEqual(action_count, TOKENS["highlights"]["actions"])
        self.assertEqual(TOKENS["highlights"]["visible_output_m"], 36.39)
        # Each of 150 cells is rounded to 1k; the sum is not an exact-token total.
        self.assertAlmostEqual(token_k / 1000, TOKENS["highlights"]["visible_output_m"], delta=150 * .0005)


if __name__ == "__main__":
    unittest.main()
