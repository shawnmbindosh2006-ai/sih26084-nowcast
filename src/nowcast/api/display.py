"""Deterministic, non-georeferenced preview PNGs for numeric forecast planes."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

import numpy as np


def _chunk(kind: bytes, payload: bytes) -> bytes:
    body = kind + payload
    return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def write_display_png(numeric_path: Path, png_path: Path) -> dict:
    """Render a 2-D array as grayscale RGBA; non-finite cells are transparent."""
    values = np.load(numeric_path, allow_pickle=False)
    if values.ndim != 2 or not np.issubdtype(values.dtype, np.number):
        raise ValueError("forecast artifact must be a numeric [H,W] array")
    valid = np.isfinite(values)
    height, width = values.shape
    rgba = np.zeros((height, width, 4), dtype=np.uint8)
    low = high = None
    if valid.any():
        finite = values[valid].astype(np.float64)
        low, high = float(finite.min()), float(finite.max())
        gray = np.rint((finite - low) * 255 / (high - low)).astype(np.uint8) if high > low else np.full(finite.shape, 128, dtype=np.uint8)
        rgba[valid, :3] = gray[:, None]
        rgba[valid, 3] = 255
    rows = b"".join(b"\x00" + row.tobytes() for row in rgba)
    description = b"Description\x00Display-only per-frame grayscale; invalid cells transparent; not rainfall"
    png = (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", struct.pack(">2I5B", width, height, 8, 6, 0, 0, 0))
        + _chunk(b"tEXt", description)
        + _chunk(b"IDAT", zlib.compress(rows))
        + _chunk(b"IEND", b"")
    )
    png_path.write_bytes(png)
    return {
        "method": "per-frame linear grayscale preview; not a calibrated physical color scale",
        "valid_pixels": int(valid.sum()),
        "missing_pixels": int(valid.size - valid.sum()),
        "display_min": low,
        "display_max": high,
    }
