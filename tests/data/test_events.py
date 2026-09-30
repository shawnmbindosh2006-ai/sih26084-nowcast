import json
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from nowcast.data import EventValidationError, load_event
from nowcast.data.fixture import generate_fixture, write_json
from nowcast.data.mrms import DecodedFrame, MRMSReplayError, write_replay
from nowcast.data.sevir import fetch, investigate


class EventTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = generate_fixture(Path(self.temp.name) / "event")
        self.raw = json.loads(self.path.read_text())

    def save(self):
        write_json(self.path, self.raw)

    def reject(self):
        self.save()
        with self.assertRaises(EventValidationError):
            load_event(self.path)

    def test_deterministic_and_separate_targets(self):
        other = generate_fixture(Path(self.temp.name) / "other")
        for file in self.path.parent.iterdir():
            self.assertEqual(file.read_bytes(), (other.parent / file.name).read_bytes())
        event = load_event(self.path)
        self.assertEqual(np.load(event['observed_array_path']).shape, (12, 32, 32, 1))
        self.assertEqual(event['event_time_utc'], '2026-01-01T00:55:00Z')
        self.assertTrue(Path(event['observed_array_path']).is_absolute())

    def test_targets_never_opened_or_forwarded(self):
        (self.path.parent / 'evaluation-targets.npy').write_bytes(b'not a numpy file')
        self.raw['target_array_path'] = 'does-not-exist.npy'
        self.save()
        real_load = np.load
        with patch('nowcast.data.loader.np.load', wraps=real_load) as spy:
            event = load_event(self.path)
        self.assertEqual({Path(c.args[0]).name for c in spy.call_args_list}, {'observed.npy', 'quality-mask.npy'})
        self.assertNotIn('target_array_path', event)

    def test_unknown_geography_stays_null(self):
        self.assertIsNone(load_event(self.path)['grid']['bounds_wgs84'])

    def test_malformed_time_sequences(self):
        for value in ('bad', '2026-01-01T00:00:00', '2026-01-01T00:00:00+05:30', self.raw['timestamps_utc'][0]):
            with self.subTest(value=value):
                self.raw['timestamps_utc'][1] = value
                self.reject()

    def test_cadence_gap(self):
        self.raw['timestamps_utc'][1] = '2026-01-01T00:06:00Z'
        self.reject()

    def test_expected_cadence(self):
        with self.assertRaises(EventValidationError):
            load_event(self.path, expected_cadence_seconds=600)

    def test_missing_channel(self):
        self.raw['channel_names'] = []
        self.reject()

    def test_consumer_missing_channel(self):
        with self.assertRaises(EventValidationError):
            load_event(self.path, expected_channels={'vil': 'SEVIR_encoded_VIL'})

    def test_incompatible_units(self):
        self.raw['channel_units'] = ['mm/h']
        self.reject()

    def test_invalid_dimensions(self):
        np.save(self.path.parent / 'observed.npy', np.zeros((12, 32, 32)))
        self.reject()

    def test_invalid_mask(self):
        np.save(self.path.parent / 'quality-mask.npy', np.ones((12, 32, 32, 1), dtype=np.uint8))
        self.reject()

    def test_missing_values_require_mask(self):
        p = self.path.parent / 'observed.npy'
        data = np.load(p)
        data[:, 0, 0, :] = np.nan
        np.save(p, data)
        load_event(self.path)
        data[:, 1, 1, :] = np.nan
        np.save(p, data)
        self.reject()

    def test_vil_missing_code(self):
        self.raw['channel_names'] = ['vil']
        self.raw['channel_units'] = ['SEVIR_encoded_VIL']
        p = self.path.parent / 'observed.npy'
        data = np.load(p)
        data[:, 0, 0, :] = 255
        np.save(p, data)
        self.save()
        load_event(self.path)
        data[:, 1, 1, :] = 255
        np.save(p, data)
        self.reject()

    def test_resampling_requires_provenance(self):
        self.raw['grid'].update(native_spacing_km=2, effective_spacing_km=1)
        self.reject()

    def test_bad_geography(self):
        self.raw['grid']['bounds_wgs84'] = [80, 20, 70, 10]
        self.reject()

    def test_path_escape(self):
        self.raw['observed_array_path'] = '../outside.npy'
        self.reject()

    def test_synthetic_cannot_be_live(self):
        self.raw['mode'] = 'live'
        self.reject()

    def test_last_timestamp(self):
        self.raw['event_time_utc'] = self.raw['timestamps_utc'][0]
        self.reject()

    def test_budget_prevents_network(self):
        with patch('nowcast.data.sevir.urlopen') as request:
            with self.assertRaises(ValueError):
                fetch('https://example.invalid', self.path.parent / 'x', 101, 100)
            request.assert_not_called()
        with self.assertRaises(ValueError):
            investigate(self.path.parent / 'probe', 1_000_000_001)

    def test_oversized_container_is_never_fetched(self):
        def fake_fetch(url, destination, expected_size, budget):
            Path(destination).write_text('id,img_type,file_name,file_index\nS858968,vil,vil/example.h5,0\n')
            return {'bytes': 80, 'sha256': 'test-only'}
        with patch('nowcast.data.sevir.size', side_effect=[80, 200]), patch(
                'nowcast.data.sevir.fetch', side_effect=fake_fetch) as download:
            manifest = investigate(self.path.parent / 'probe', budget=100, download=True)
        self.assertEqual(manifest['status'], 'blocked_budget')
        self.assertEqual(download.call_count, 1)
        self.assertIsNone(manifest['objects'][0]['sha256'])

    def test_download_response_cannot_exceed_head_size(self):
        with patch('nowcast.data.sevir.urlopen', return_value=io.BytesIO(b'12345')):
            with self.assertRaises(ValueError):
                fetch('https://example.invalid', self.path.parent / 'partial', 4, 10)

    def test_access_block_preserves_manifest(self):
        directory = self.path.parent / 'blocked'
        with patch('nowcast.data.sevir.size', side_effect=OSError('test access denied')):
            result = investigate(directory)
        self.assertEqual(result['status'], 'blocked_access_or_catalog')
        self.assertEqual(json.loads((directory / 'manifest.json').read_text()), result)

    def test_mrms_replay_separates_observations_and_future_truth(self):
        base_grid = {
            'native_spacing_km': None, 'effective_spacing_km': None, 'crs': 'EPSG:4326',
            'bounds_wgs84': [-100.0, 30.0, -99.96, 30.03],
            'mrms_grid': {'grid_type': 'regular_ll', 'ni': 5, 'nj': 4,
                          'i_increment_degrees': 0.01, 'j_increment_degrees': 0.01,
                          'i_scans_negatively': False, 'j_scans_positively': True,
                          'latitude_first_degrees': 30.0, 'longitude_first_degrees': -100.0},
        }
        frames = []
        for index in range(6):
            value = np.full((4, 5), index, dtype=np.float32)
            valid = np.ones((4, 5), dtype=bool)
            valid[1, 1] = False
            frames.append(DecodedFrame(f'2020-10-14T00:{index * 2:02d}:00Z', value, valid, 'dBZ', base_grid))
        output = Path(self.temp.name) / 'mrms'
        event_path = write_replay(output, frames, [{'key': f'frame-{index}'} for index in range(6)], 2, 3)
        event = load_event(event_path, expected_channels={'reflectivity': 'dBZ'})
        self.assertEqual(np.load(event['observed_array_path']).shape, (4, 2, 3, 1))
        self.assertEqual(np.load(output / 'evaluation-targets.npy').shape, (2, 2, 3, 1))
        self.assertNotIn('target_array_path', event)
        self.assertEqual(event['mode'], 'replay')
        self.assertEqual(event['sources'][0]['availability'], 'archived_replay')
        self.assertEqual(event['grid']['bounds_wgs84'], [-99.99, 30.01, -99.97, 30.02])
        self.assertFalse(np.load(event['quality_mask_path'])[0, 0, 0, 0])
        self.assertEqual(np.load(event['observed_array_path'])[0, 0, 0, 0], 0.0)
        evaluation = json.loads((output / 'evaluation.json').read_text())
        self.assertEqual(evaluation['timestamps_utc'], ['2020-10-14T00:08:00Z', '2020-10-14T00:10:00Z'])
        self.assertEqual(json.loads((output / 'manifest.json').read_text())['region'], 'CONUS, United States')

    def test_mrms_replay_rejects_non_monotonic_times(self):
        grid = {'native_spacing_km': None, 'effective_spacing_km': None, 'crs': 'EPSG:4326',
                'bounds_wgs84': [-100, 30, -99, 31],
                'mrms_grid': {'i_increment_degrees': 0.01, 'j_increment_degrees': 0.01,
                              'i_scans_negatively': False, 'j_scans_positively': True,
                              'latitude_first_degrees': 30, 'longitude_first_degrees': -100}}
        frame = DecodedFrame('2020-10-14T00:00:00Z', np.zeros((2, 2), dtype=np.float32),
                             np.ones((2, 2), dtype=bool), 'dBZ', grid)
        with self.assertRaises(MRMSReplayError):
            write_replay(Path(self.temp.name) / 'bad-mrms', [frame] * 6, [{}] * 6, 1, 1)


if __name__ == '__main__':
    unittest.main()
