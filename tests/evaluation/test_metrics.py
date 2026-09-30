from __future__ import annotations

import unittest

import numpy as np

from nowcast.evaluation.metrics import (
    compare_methods_by_lead,
    contingency_metrics,
    continuous_metrics,
    evaluate_by_lead,
)


class EvaluationMetricTests(unittest.TestCase):
    def test_continuous_metrics(self) -> None:
        result = continuous_metrics(np.array([1.0, 3.0]), np.array([2.0, 5.0]))
        self.assertAlmostEqual(result["mae"], 1.5)
        self.assertAlmostEqual(result["rmse"], np.sqrt(2.5))

    def test_contingency_counts_and_scores(self) -> None:
        result = contingency_metrics(
            np.array([1.0, 1.0, 0.0, 0.0]),
            np.array([1.0, 0.0, 1.0, 0.0]),
            threshold=0.5,
        )
        self.assertEqual((result["hits"], result["misses"], result["false_alarms"]), (1, 1, 1))
        self.assertAlmostEqual(result["csi"], 1 / 3)
        self.assertAlmostEqual(result["pod"], 1 / 2)
        self.assertAlmostEqual(result["far"], 1 / 2)

    def test_undefined_denominators_return_none(self) -> None:
        result = contingency_metrics(np.zeros(4), np.zeros(4), threshold=1.0)
        self.assertIsNone(result["csi"])
        self.assertIsNone(result["pod"])
        self.assertIsNone(result["far"])

    def test_results_are_separate_by_lead(self) -> None:
        prediction = np.array([[[0.0, 1.0]], [[1.0, 1.0]]])
        target = np.array([[[0.0, 0.0]], [[1.0, 0.0]]])
        result = evaluate_by_lead(
            prediction,
            target,
            [30, 60],
            0.5,
            variable="synthetic_test_value",
            units="arbitrary_test_units",
        )
        self.assertEqual([item["lead_minutes"] for item in result["by_lead"]], [30, 60])
        self.assertEqual(result["sample_count"], 2)

    def test_shape_mismatch_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "shapes must match"):
            continuous_metrics(np.zeros((2, 2)), np.zeros((2, 3)))

    def test_method_comparison_records_identity_lead_mask_and_threshold(self) -> None:
        target = np.array([[[0.0, 2.0, np.nan]], [[0.0, 2.0, 4.0]]])
        predictions = {
            "persistence": np.array([[[0.0, 1.0, 9.0]], [[0.0, 2.0, 3.0]]]),
            "optical_flow": np.array([[[0.0, 2.0, np.nan]], [[0.0, np.nan, 4.0]]]),
        }
        valid_mask = np.array([[[True, True, False]], [[True, True, True]]])

        result = compare_methods_by_lead(
            predictions,
            target,
            [30, 60],
            1.5,
            event_id="separate-truth-test",
            variable="reflectivity",
            units="dBZ",
            valid_mask=valid_mask,
        )

        self.assertEqual(result["event_id"], "separate-truth-test")
        self.assertEqual(result["threshold"], 1.5)
        self.assertEqual(result["by_method"]["persistence"][0]["valid_count"], 2)
        self.assertEqual(result["by_method"]["optical_flow"][1]["valid_count"], 2)
        self.assertEqual(result["by_method"]["optical_flow"][1]["method"], "optical_flow")
        self.assertEqual(result["by_method"]["optical_flow"][1]["lead_minutes"], 60)

    def test_method_comparison_does_not_score_missing_as_zero(self) -> None:
        result = compare_methods_by_lead(
            {"optical_flow": np.array([[[np.nan, 0.0]]])},
            np.array([[[100.0, 0.0]]]),
            [30],
            1.0,
            event_id="mask-test",
            variable="reflectivity",
            units="dBZ",
        )

        score = result["by_method"]["optical_flow"][0]
        self.assertEqual(score["valid_count"], 1)
        self.assertEqual(score["mae"], 0.0)
        self.assertIsNone(score["csi"])

    def test_method_comparison_requires_boolean_valid_mask(self) -> None:
        with self.assertRaisesRegex(ValueError, "valid_mask must be boolean"):
            compare_methods_by_lead(
                {"persistence": np.zeros((1, 2))},
                np.zeros((1, 2)),
                [30],
                1.0,
                event_id="mask-test",
                variable="reflectivity",
                units="dBZ",
                valid_mask=np.ones((1, 2), dtype=np.uint8),
            )


if __name__ == "__main__":
    unittest.main()
