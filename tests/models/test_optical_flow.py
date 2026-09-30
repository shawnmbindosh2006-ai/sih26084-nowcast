from __future__ import annotations

import copy
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from nowcast.models.optical_flow import (
    OpticalFlowNowcaster,
    OpticalFlowPersistenceRouter,
    OpticalFlowRuntimeError,
    optical_flow_readiness,
)
from nowcast.models.persistence import PersistenceNowcaster, UnsupportedLeadTimeError


def _zero_motion(history: np.ndarray, *, verbose: bool = False) -> np.ndarray:
    del verbose
    return np.zeros((2, *history.shape[1:]), dtype=np.float32)


def _repeat_extrapolation(field: np.ndarray, velocity: np.ndarray, timesteps, **kwargs) -> np.ndarray:
    del velocity, kwargs
    return np.repeat(np.asarray(field)[None, ...], len(timesteps), axis=0)


class OpticalFlowNowcasterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.observed = np.zeros((3, 32, 32, 1), dtype=np.float32)
        for frame_index in range(3):
            self.observed[frame_index, 10:18, 8 + frame_index : 16 + frame_index, 0] = 35.0
        self.observed[-1, 25, 25, 0] = 0.0
        self.observed_path = self.root / "observed.npy"
        np.save(self.observed_path, self.observed)
        self.mask = np.ones(self.observed.shape, dtype=bool)
        self.mask[:, 0, 0, 0] = False
        self.mask_path = self.root / "quality-mask.npy"
        np.save(self.mask_path, self.mask)
        self.event = {
            "schema_version": "1.0",
            "event_id": "synthetic-optical-flow-test",
            "mode": "synthetic",
            "event_time_utc": "2026-01-01T00:10:00Z",
            "timestamps_utc": [
                "2026-01-01T00:00:00Z",
                "2026-01-01T00:05:00Z",
                "2026-01-01T00:10:00Z",
            ],
            "observed_array_path": str(self.observed_path),
            "channel_names": ["reflectivity"],
            "channel_units": ["dBZ"],
            "quality_mask_path": str(self.mask_path),
            "sources": [
                {
                    "id": "synthetic-unit-test",
                    "availability": "synthetic",
                    "provenance": "Generated only for deterministic plumbing tests",
                }
            ],
            "grid": {
                "native_spacing_km": None,
                "effective_spacing_km": None,
                "crs": None,
                "bounds_wgs84": None,
            },
        }
        self.artifact_root = self.root / "artifacts"
        self.fake_runtime = patch(
            "nowcast.models.optical_flow._load_pysteps",
            return_value=("1.21.5-test-double", _zero_motion, _repeat_extrapolation),
        )

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def _adapter(self) -> OpticalFlowNowcaster:
        return OpticalFlowNowcaster(artifact_root=self.artifact_root)

    def _stored_arrays(self, forecast: dict) -> list[np.ndarray]:
        run_dir = self.artifact_root / forecast["run_id"]
        return [
            np.load(run_dir / frame["image_url"].rsplit("/", 1)[-1])
            for frame in forecast["frames"]
        ]

    def test_output_shape_leads_times_units_and_provenance(self) -> None:
        with self.fake_runtime:
            forecast = self._adapter().predict(self.event, [30, 60])

        self.assertEqual(forecast["forecast_method"], "optical_flow")
        self.assertEqual(forecast["mode"], "synthetic")
        self.assertEqual(forecast["supported_lead_times_minutes"], [30, 60])
        self.assertEqual(forecast["sources"], self.event["sources"])
        self.assertEqual(forecast["grid"], self.event["grid"])
        self.assertEqual(
            [frame["valid_time_utc"] for frame in forecast["frames"]],
            ["2026-01-01T00:40:00Z", "2026-01-01T01:10:00Z"],
        )
        self.assertTrue(all(frame["variable"] == "reflectivity" for frame in forecast["frames"]))
        self.assertTrue(all(frame["units"] == "dBZ" for frame in forecast["frames"]))
        self.assertEqual([array.shape for array in self._stored_arrays(forecast)], [(32, 32)] * 2)

    def test_quality_mask_true_is_valid_invalid_is_nan_and_valid_zero_remains(self) -> None:
        with self.fake_runtime:
            forecast = self._adapter().predict(self.event, [30, 60])

        for stored in self._stored_arrays(forecast):
            self.assertTrue(np.isnan(stored[0, 0]))
            self.assertEqual(stored[25, 25], 0.0)
            self.assertFalse(np.isnan(stored[25, 25]))
            self.assertEqual(stored.dtype, np.float32)

    def test_future_targets_are_not_read(self) -> None:
        target_path = self.root / "future-target.npy"
        np.save(target_path, np.full((2, 32, 32, 1), 9999.0, dtype=np.float32))
        event = copy.deepcopy(self.event)
        event["evaluation_target_array_path"] = str(target_path)
        with self.fake_runtime:
            first = self._adapter().predict(event, [30])
        target_path.unlink()
        with self.fake_runtime:
            second = self._adapter().predict(event, [30])

        np.testing.assert_equal(self._stored_arrays(first)[0], self._stored_arrays(second)[0])

    def test_unsupported_leads_reject_before_runtime_load(self) -> None:
        for leads in ([90], [180], [360], [30, 60, 90]):
            with self.subTest(leads=leads):
                with patch(
                    "nowcast.models.optical_flow._load_pysteps",
                    side_effect=AssertionError("runtime must not load"),
                ):
                    with self.assertRaises(UnsupportedLeadTimeError):
                        self._adapter().predict(self.event, leads)

    def test_small_source_timestamp_jitter_is_accepted(self) -> None:
        event = copy.deepcopy(self.event)
        event["timestamps_utc"][1] = "2026-01-01T00:05:20Z"
        with self.fake_runtime:
            forecast = self._adapter().predict(event, [30])
        self.assertEqual(forecast["forecast_method"], "optical_flow")

    def test_large_nonuniform_cadence_is_rejected(self) -> None:
        event = copy.deepcopy(self.event)
        event["timestamps_utc"][1] = "2026-01-01T00:04:00Z"
        with self.assertRaisesRegex(ValueError, "within 30 seconds"):
            self._adapter().predict(event, [30])

    def test_public_readiness_checks_runtime_and_event(self) -> None:
        with self.fake_runtime:
            readiness = optical_flow_readiness(self.event)
        self.assertTrue(readiness.available)
        self.assertEqual(readiness.version, "1.21.5-test-double")

        event = copy.deepcopy(self.event)
        event["timestamps_utc"][1] = "2026-01-01T00:04:00Z"
        with self.fake_runtime:
            unavailable = optical_flow_readiness(event)
        self.assertFalse(unavailable.available)
        self.assertIn("within 30 seconds", unavailable.reason)

    def test_runtime_failure_routes_to_honestly_labelled_persistence(self) -> None:
        optical_flow = self._adapter()
        persistence = PersistenceNowcaster(
            artifact_root=self.artifact_root,
            supported_lead_times_minutes=(30, 60),
        )
        router = OpticalFlowPersistenceRouter(optical_flow, persistence)
        with patch(
            "nowcast.models.optical_flow._load_pysteps",
            side_effect=OpticalFlowRuntimeError("test failure"),
        ):
            forecast = router.predict(self.event, [30])

        self.assertEqual(forecast["forecast_method"], "persistence")
        self.assertTrue(any("routed to persistence fallback" in item for item in forecast["warnings"]))

    @unittest.skipUnless(importlib.util.find_spec("pysteps"), "pySTEPS runtime not installed")
    def test_real_pysteps_lucas_kanade_semilagrangian_smoke(self) -> None:
        forecast = self._adapter().predict(self.event, [30, 60])

        self.assertEqual(forecast["model"]["version"], "1.21.5")
        self.assertEqual(len(forecast["frames"]), 2)
        for stored in self._stored_arrays(forecast):
            self.assertEqual(stored.shape, (32, 32))
            self.assertTrue(np.isnan(stored[0, 0]))


if __name__ == "__main__":
    unittest.main()
