"""Bounded decoder for a fixed NOAA MRMS archived-replay sequence."""
from __future__ import annotations

import argparse
import gc
import gzip
import hashlib
import json
import re
import shutil
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np

from .fixture import write_json

BASE_URL = "https://noaa-mrms-pds.s3.amazonaws.com/"
MAX_DOWNLOAD_BYTES = 10_000_000
PRODUCT = "MergedReflectivityQCComposite_00.50"
PRODUCT_UNITS = "dBZ"
DEFAULT_KEYS = (
    "CONUS/MergedReflectivityQCComposite_00.50/20201014/"
    "MRMS_MergedReflectivityQCComposite_00.50_20201014-000022.grib2.gz",
    "CONUS/MergedReflectivityQCComposite_00.50/20201014/"
    "MRMS_MergedReflectivityQCComposite_00.50_20201014-000239.grib2.gz",
    "CONUS/MergedReflectivityQCComposite_00.50/20201014/"
    "MRMS_MergedReflectivityQCComposite_00.50_20201014-000438.grib2.gz",
    "CONUS/MergedReflectivityQCComposite_00.50/20201014/"
    "MRMS_MergedReflectivityQCComposite_00.50_20201014-000631.grib2.gz",
    "CONUS/MergedReflectivityQCComposite_00.50/20201014/"
    "MRMS_MergedReflectivityQCComposite_00.50_20201014-000832.grib2.gz",
    "CONUS/MergedReflectivityQCComposite_00.50/20201014/"
    "MRMS_MergedReflectivityQCComposite_00.50_20201014-001027.grib2.gz",
)
_FILENAME_TIME = re.compile(r"_(\d{8}-\d{6})\.grib2\.gz$")


class MRMSReplayError(ValueError):
    """The archived replay cannot be built without losing data provenance."""


@dataclass(frozen=True)
class DecodedFrame:
    timestamp_utc: str
    values: np.ndarray
    valid: np.ndarray
    units: str
    grid: dict[str, object]


def _timestamp_from_key(key: str) -> str:
    match = _FILENAME_TIME.search(key)
    if match is None:
        raise MRMSReplayError("MRMS filename does not contain a UTC timestamp")
    return datetime.strptime(match.group(1), "%Y%m%d-%H%M%S").replace(
        tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def _header_size(url: str) -> int:
    with urlopen(Request(url, method="HEAD"), timeout=30) as response:
        value = response.headers.get("Content-Length")
    if value is None:
        raise MRMSReplayError("MRMS object size is unknown")
    return int(value)


def _download(url: str, destination: Path, expected_size: int, remaining: int) -> dict[str, object]:
    if expected_size <= 0 or expected_size > remaining:
        raise MRMSReplayError("MRMS selection exceeds the download budget")
    digest, received = hashlib.sha256(), 0
    with destination.open("xb") as output:
        with urlopen(url, timeout=30) as response:
            while chunk := response.read(min(1024 * 1024, remaining - received + 1)):
                received += len(chunk)
                if received > expected_size or received > remaining:
                    raise MRMSReplayError("MRMS response exceeded inspected size or budget")
                digest.update(chunk)
                output.write(chunk)
    if received != expected_size:
        raise MRMSReplayError("MRMS download is incomplete")
    return {"bytes": received, "sha256": digest.hexdigest()}


def _get(codes, handle: object, key: str, default: object = None) -> object:
    try:
        return codes.codes_get(handle, key)
    except codes.CodesInternalError:
        return default


def _longitude(value: float) -> float:
    return value - 360.0 if value > 180.0 else value


def decode_grib(path: str | Path, timestamp_utc: str) -> DecodedFrame:
    """Decode one gzip-compressed MRMS GRIB2 file, retaining the native grid."""
    try:
        import eccodes as codes
    except ImportError as exc:
        raise MRMSReplayError("MRMS decoding requires eccodes; install configs/data/requirements-mrms.txt") from exc
    temporary_path = None
    handle = None
    stream = None
    try:
        with gzip.open(path, "rb") as compressed, tempfile.NamedTemporaryFile(
                suffix=".grib2", delete=False) as temporary:
            shutil.copyfileobj(compressed, temporary)
            temporary_path = temporary.name
        stream = open(temporary_path, "rb")
        handle = codes.codes_grib_new_from_file(stream)
        if handle is None:
            raise MRMSReplayError("MRMS file does not contain a GRIB message")
        try:
            grid_type = _get(codes, handle, "gridType")
            ni, nj = int(_get(codes, handle, "Ni")), int(_get(codes, handle, "Nj"))
            if grid_type != "regular_ll" or ni <= 0 or nj <= 0:
                raise MRMSReplayError("unsupported MRMS grid; expected regular latitude/longitude")
            encoded_units = str(_get(codes, handle, "units"))
            if encoded_units not in ("unknown", PRODUCT_UNITS):
                raise MRMSReplayError(f"unexpected MRMS units: {encoded_units}")
            units = PRODUCT_UNITS
            values = np.asarray(codes.codes_get_values(handle), dtype=np.float32).reshape(nj, ni)
            missing_value = _get(codes, handle, "missingValue", np.nan)
            valid = np.isfinite(values)
            if missing_value is not None and np.isfinite(missing_value):
                valid &= values != float(missing_value)
            bitmap = _get(codes, handle, "bitmapPresent", 0)
            if bitmap:
                try:
                    valid &= np.asarray(codes.codes_get_array(handle, "bitmap", int), dtype=bool).reshape(nj, ni)
                except codes.CodesInternalError:
                    pass
            lat_first, lat_last = (float(_get(codes, handle, key)) for key in
                                   ("latitudeOfFirstGridPointInDegrees", "latitudeOfLastGridPointInDegrees"))
            lon_first, lon_last = (float(_get(codes, handle, key)) for key in
                                   ("longitudeOfFirstGridPointInDegrees", "longitudeOfLastGridPointInDegrees"))
            i_increment = float(_get(codes, handle, "iDirectionIncrementInDegrees"))
            j_increment = float(_get(codes, handle, "jDirectionIncrementInDegrees"))
            grid = {
                "native_spacing_km": None, "effective_spacing_km": None,
                "crs": "EPSG:4326",
                "bounds_wgs84": [min(_longitude(lon_first), _longitude(lon_last)), min(lat_first, lat_last),
                                  max(_longitude(lon_first), _longitude(lon_last)), max(lat_first, lat_last)],
                "mrms_grid": {"grid_type": grid_type, "ni": ni, "nj": nj,
                              "i_increment_degrees": i_increment, "j_increment_degrees": j_increment,
                              "i_scans_negatively": bool(_get(codes, handle, "iScansNegatively", 0)),
                              "j_scans_positively": bool(_get(codes, handle, "jScansPositively", 0)),
                              "latitude_first_degrees": lat_first, "longitude_first_degrees": _longitude(lon_first)},
            }
        finally:
            if handle is not None:
                codes.codes_release(handle)
                handle = None
                gc.collect()
            if stream is not None:
                stream.close()
    finally:
        if temporary_path is not None:
            try:
                Path(temporary_path).unlink(missing_ok=True)
            except PermissionError:
                pass
    return DecodedFrame(timestamp_utc, values, valid, units, grid)


def _subset_grid(grid: dict[str, object], row_start: int, col_start: int,
                 height: int, width: int) -> dict[str, object]:
    native = grid["mrms_grid"]
    assert isinstance(native, dict)
    lat_start = float(native["latitude_first_degrees"])
    lon_start = float(native["longitude_first_degrees"])
    j_sign = 1 if native["j_scans_positively"] else -1
    i_sign = -1 if native["i_scans_negatively"] else 1
    j_step = float(native["j_increment_degrees"])
    i_step = float(native["i_increment_degrees"])
    lats = (lat_start + j_sign * j_step * row_start,
            lat_start + j_sign * j_step * (row_start + height - 1))
    lons = (_longitude(lon_start + i_sign * i_step * col_start),
            _longitude(lon_start + i_sign * i_step * (col_start + width - 1)))
    return {"native_spacing_km": None, "effective_spacing_km": None, "crs": grid["crs"],
            "bounds_wgs84": [min(lons), min(lats), max(lons), max(lats)],
            "mrms_grid": {**native, "subset_row_start": row_start, "subset_col_start": col_start,
                          "subset_height": height, "subset_width": width,
                          "resampling": "none; native grid crop"}}


def write_replay(directory: str | Path, frames: list[DecodedFrame], source_objects: list[dict[str, object]],
                 crop_height: int = 128, crop_width: int = 128) -> Path:
    """Write a four-observation/two-future EventBundle without target leakage."""
    if len(frames) != 6:
        raise MRMSReplayError("replay requires exactly six frames: four observed and two future")
    if crop_height <= 0 or crop_width <= 0:
        raise MRMSReplayError("crop dimensions must be positive")
    timestamps = [frame.timestamp_utc for frame in frames]
    if timestamps != sorted(timestamps) or len(set(timestamps)) != len(timestamps):
        raise MRMSReplayError("MRMS timestamps must be strictly increasing")
    reference = frames[0]
    if any(frame.values.shape != reference.values.shape or frame.units != reference.units or frame.grid != reference.grid
           for frame in frames[1:]):
        raise MRMSReplayError("MRMS frames do not share a native grid and units")
    rows, cols = reference.values.shape
    if crop_height > rows or crop_width > cols:
        raise MRMSReplayError("crop exceeds MRMS native grid")
    row_start, col_start = (rows - crop_height) // 2, (cols - crop_width) // 2
    data = np.stack([frame.values[row_start:row_start + crop_height, col_start:col_start + crop_width]
                     for frame in frames], axis=0)[..., None]
    valid = np.stack([frame.valid[row_start:row_start + crop_height, col_start:col_start + crop_width]
                      for frame in frames], axis=0)[..., None]
    data[~valid] = 0.0
    root = Path(directory)
    root.mkdir(parents=True, exist_ok=True)
    np.save(root / "observed.npy", data[:4], allow_pickle=False)
    np.save(root / "quality-mask.npy", valid[:4], allow_pickle=False)
    np.save(root / "evaluation-targets.npy", data[4:], allow_pickle=False)
    grid = _subset_grid(reference.grid, row_start, col_start, crop_height, crop_width)
    event = {"schema_version": "1.0", "event_id": "mrms-conus-20201014-000022-replay", "mode": "replay",
             "event_time_utc": timestamps[3], "timestamps_utc": timestamps[:4],
             "observed_array_path": "observed.npy", "quality_mask_path": "quality-mask.npy",
             "channel_names": ["reflectivity"], "channel_units": [reference.units],
             "sources": [{"id": "noaa-mrms", "availability": "archived_replay",
                          "provenance": "NOAA MRMS CONUS archived MergedReflectivityQCComposite; United States data, not Indian observations."}],
             "grid": grid}
    write_json(root / "event.json", event)
    write_json(root / "evaluation.json", {"event_id": event["event_id"], "mode": "replay",
               "target_array_path": "evaluation-targets.npy", "timestamps_utc": timestamps[4:],
               "units": reference.units, "purpose": "archived future truth; excluded from inference"})
    manifest = {"source": "NOAA MRMS public S3", "source_url": BASE_URL, "product": PRODUCT,
                "region": "CONUS, United States", "mode": "archived_replay", "units": reference.units,
                "observed_timestamps_utc": timestamps[:4], "future_truth_timestamps_utc": timestamps[4:],
                "objects": source_objects, "crop": grid["mrms_grid"],
                "files": {name: {"bytes": (root / name).stat().st_size,
                                  "sha256": hashlib.sha256((root / name).read_bytes()).hexdigest()}
                          for name in ("observed.npy", "quality-mask.npy", "evaluation-targets.npy", "event.json", "evaluation.json")}}
    write_json(root / "manifest.json", manifest)
    return root / "event.json"


def build_replay(directory: str | Path, budget: int = MAX_DOWNLOAD_BYTES,
                 decoder=decode_grib) -> Path:
    """Download one bounded public sequence and build its EventBundle artifacts."""
    if not isinstance(budget, int) or not 0 < budget <= MAX_DOWNLOAD_BYTES:
        raise MRMSReplayError("budget must be 1..10,000,000 bytes")
    root = Path(directory)
    root.mkdir(parents=True, exist_ok=False)
    raw = root / "raw"
    raw.mkdir()
    remaining, objects, frames = budget, [], []
    try:
        for index, key in enumerate(DEFAULT_KEYS):
            url = BASE_URL + key
            expected = _header_size(url)
            destination = raw / f"frame-{index:02d}.grib2.gz"
            record = {"key": key, "url": url, "head_bytes": expected, "timestamp_utc": _timestamp_from_key(key)}
            record.update(_download(url, destination, expected, remaining))
            remaining -= expected
            objects.append(record)
            frames.append(decoder(destination, record["timestamp_utc"]))
        return write_replay(root, frames, objects)
    except Exception as exc:
        write_json(root / "manifest.json", {"source": "NOAA MRMS public S3", "product": PRODUCT,
                   "region": "CONUS, United States", "mode": "archived_replay", "budget_bytes": budget,
                   "objects": objects, "status": "blocked", "error": str(exc)})
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory")
    parser.add_argument("--budget-bytes", type=int, default=MAX_DOWNLOAD_BYTES)
    args = parser.parse_args()
    print(build_replay(args.directory, args.budget_bytes))
