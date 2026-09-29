from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path

import numpy as np

from nowcast.models.persistence import (
    EventValidationError,
    PersistenceNowcaster,
    UnsupportedLeadTimeError,
)


class PersistenceNowcasterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.observed_path = self.root / "observed.npy"
        self.observed = np.arange(3 * 2 * 2 * 2, dtype=np.float32).reshape(3, 2, 2, 2)
        np.save(self.observed_path, self.observed)
        self.event = {
            "schema_version": "1.0",
            "event_id": "synthetic-unit-test",
            "mode": "synthetic",
            "event_time_utc": "2026-01-01T00:10:00Z",
            "timestamps_utc": [
                "2026-01-01T00:00:00Z",
                "2026-01-01T00:05:00Z",
                "2026-01-01T00:10:00Z",
            ],
            "observed_array_path": str(self.observed_path),
            "channel_names": ["demo_a", "demo_b"],
            "channel_units": ["unit_a", "unit_b"],
            "quality_mask_path": None,
            "sources": [{
                "id": "unit-test",
                "availability": "synthetic",
                "provenance": "Generated in a temporary test directory",
            }],
            "grid": {
                "native_spacing_km": None,
                "effective_spacing_km": None,
                "crs": None,
                "bounds_wgs84": None,
            },
        }
        self.artifact_root = self.root / "artifacts"

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def _adapter(self) -> PersistenceNowcaster:
        return PersistenceNowcaster(artifact_root=self.artifact_root)

    def test_repeats_last_observation_and_preserves_metadata(self) -> None:
        forecast = self._adapter().predict(self.event, [30, 60])

        self.assertEqual(forecast["forecast_method"], "persistence")
        self.assertEqual(forecast["mode"], "synthetic")
        self.assertEqual(forecast["grid"], self.event["grid"])
        self.assertEqual(forecast["sources"], self.event["sources"])
        self.assertEqual(
            [frame["valid_time_utc"] for frame in forecast["frames"]],
            [
                "2026-01-01T00:40:00Z",
                "2026-01-01T00:40:00Z",
                "2026-01-01T01:10:00Z",
                "2026-01-01T01:10:00Z",
            ],
        )
        self.assertEqual(
            [(frame["variable"], frame["units"]) for frame in forecast["frames"][:2]],
            [("demo_a", "unit_a"), ("demo_b", "unit_b")],
        )
        for frame in forecast["frames"]:
            self.assertTrue(frame["image_url"].startswith("/api/v1/artifacts/"))
            filename = frame["image_url"].rsplit("/", 1)[-1]
            channel_index = int(filename.split("channel-")[1].split(".")[0])
            stored = np.load(self.artifact_root / forecast["run_id"] / filename)
            np.testing.assert_array_equal(stored, self.observed[-1, ..., channel_index])

    def test_targets_are_never_read_by_predict(self) -> None:
        target_path = self.root / "future-target.npy"
        np.save(target_path, np.full((2, 2, 2, 2), 9999, dtype=np.float32))
        event = copy.deepcopy(self.event)
        event["evaluation_target_array_path"] = str(target_path)
        mask = np.ones(self.observed.shape, dtype=bool)
        mask[-1, 0, 0, 0] = False
        mask_path = self.root / "quality-mask.npy"
        np.save(mask_path, mask)
        event["quality_mask_path"] = str(mask_path)
        first = self._adapter().predict(event, [30])
        target_path.unlink()
        second = self._adapter().predict(event, [30])

        first_file = self.artifact_root / first["run_id"] / first["frames"][0]["image_url"].rsplit("/", 1)[-1]
        second_file = self.artifact_root / second["run_id"] / second["frames"][0]["image_url"].rsplit("/", 1)[-1]
        np.testing.assert_array_equal(np.load(first_file), np.load(second_file))

    def test_masked_pixels_are_nan_and_valid_zeros_remain_zero(self) -> None:
        observed = self.observed.copy()
        observed[-1, 1, 1, 0] = 0
        np.save(self.observed_path, observed)
        mask = np.ones(observed.shape, dtype=bool)
        mask[-1, 0, 0, 0] = False
        mask[-1, 0, 1, 1] = False
        mask_path = self.root / "quality-mask.npy"
        np.save(mask_path, mask)
        self.event["quality_mask_path"] = str(mask_path)

        forecast = self._adapter().predict(self.event, [30, 60])

        for frame in forecast["frames"]:
            filename = frame["image_url"].rsplit("/", 1)[-1]
            channel = int(filename.split("channel-")[1].split(".")[0])
            stored = np.load(self.artifact_root / forecast["run_id"] / filename)
            valid = mask[-1, ..., channel]
            np.testing.assert_array_equal(stored[valid], observed[-1, ..., channel][valid])
            self.assertTrue(np.isnan(stored[~valid]).all())
            self.assertEqual(stored.dtype, np.float32)
        self.assertEqual(observed[-1, 1, 1, 0], 0)
        self.assertFalse(np.isnan(observed[-1, 1, 1, 0]))
        self.assertTrue(any("invalid pixels are NaN" in warning for warning in forecast["warnings"]))

    def test_spatial_and_singleton_channel_masks_broadcast_to_all_channels(self) -> None:
        for shape in (self.observed.shape[:3], (*self.observed.shape[:3], 1)):
            with self.subTest(shape=shape):
                mask = np.ones(shape, dtype=bool)
                mask[-1, 0, 0] = False
                mask_path = self.root / "quality-mask.npy"
                np.save(mask_path, mask)
                self.event["quality_mask_path"] = str(mask_path)
                forecast = self._adapter().predict(self.event, [30])
                for frame in forecast["frames"]:
                    filename = frame["image_url"].rsplit("/", 1)[-1]
                    stored = np.load(self.artifact_root / forecast["run_id"] / filename)
                    self.assertTrue(np.isnan(stored[0, 0]))

    def test_nonboolean_mask_is_rejected(self) -> None:
        mask_path = self.root / "quality-mask.npy"
        np.save(mask_path, np.ones(self.observed.shape, dtype=np.uint8))
        self.event["quality_mask_path"] = str(mask_path)
        with self.assertRaisesRegex(EventValidationError, "mask must be boolean"):
            self._adapter().predict(self.event, [30])

    def test_masked_integer_input_can_represent_missing_pixels(self) -> None:
        observed = self.observed.astype(np.uint8)
        np.save(self.observed_path, observed)
        mask = np.ones(observed.shape, dtype=bool)
        mask[-1, 0, 0, 0] = False
        mask_path = self.root / "quality-mask.npy"
        np.save(mask_path, mask)
        self.event["quality_mask_path"] = str(mask_path)

        forecast = self._adapter().predict(self.event, [30])
        filename = forecast["frames"][0]["image_url"].rsplit("/", 1)[-1]
        stored = np.load(self.artifact_root / forecast["run_id"] / filename)

        self.assertTrue(np.issubdtype(stored.dtype, np.floating))
        self.assertTrue(np.isnan(stored[0, 0]))
        self.assertEqual(stored[1, 1], observed[-1, 1, 1, 0])

    def test_metadata_only_event_is_rejected(self) -> None:
        event = copy.deepcopy(self.event)
        event["observed_array_path"] = None
        with self.assertRaisesRegex(EventValidationError, "metadata-only"):
            self._adapter().predict(event, [30])

    def test_invalid_array_shape_is_rejected(self) -> None:
        np.save(self.observed_path, np.zeros((3, 2, 2), dtype=np.float32))
        with self.assertRaisesRegex(EventValidationError, r"\[T,H,W,C\]"):
            self._adapter().predict(self.event, [30])

    def test_timestamp_and_channel_mismatches_are_rejected(self) -> None:
        event = copy.deepcopy(self.event)
        event["timestamps_utc"] = event["timestamps_utc"][:-1]
        with self.assertRaisesRegex(EventValidationError, "timestamps_utc length"):
            self._adapter().predict(event, [30])

        event = copy.deepcopy(self.event)
        event["channel_units"] = ["unit_a"]
        with self.assertRaisesRegex(EventValidationError, "channel_units length"):
            self._adapter().predict(event, [30])

    def test_invalid_and_unsupported_leads_are_rejected(self) -> None:
        for leads in ([], [0], [30, 30], [60, 30], [90], [30.0]):
            with self.subTest(leads=leads):
                with self.assertRaises(UnsupportedLeadTimeError):
                    self._adapter().predict(self.event, leads)

    def test_hazards_are_explicitly_unavailable(self) -> None:
        forecast = self._adapter().predict(self.event, [30])
        for hazard in forecast["hazards"].values():
            self.assertEqual(hazard["status"], "unavailable")
            self.assertIsNone(hazard["probability"])
            self.assertEqual(hazard["zones"], {"type": "FeatureCollection", "features": []})


if __name__ == "__main__":
    unittest.main()
