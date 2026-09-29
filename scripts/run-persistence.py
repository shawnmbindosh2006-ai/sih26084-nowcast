#!/usr/bin/env python3
"""Run the CPU persistence adapter from an EventBundle JSON file."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT / "src"))

from nowcast.models.persistence import PersistenceNowcaster  # noqa: E402


def _resolve_manifest_paths(event: dict, manifest_path: Path) -> dict:
    for key in ("observed_array_path", "quality_mask_path"):
        value = event.get(key)
        if isinstance(value, str) and not Path(value).is_absolute():
            event[key] = str((manifest_path.parent / value).resolve())
    return event


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("event", type=Path, help="Path to EventBundle JSON")
    parser.add_argument("--lead-minutes", type=int, nargs="+", required=True)
    parser.add_argument("--artifact-root", type=Path, default=REPOSITORY_ROOT / "runs")
    arguments = parser.parse_args()

    manifest_path = arguments.event.resolve()
    event = _resolve_manifest_paths(json.loads(manifest_path.read_text(encoding="utf-8")), manifest_path)
    forecast = PersistenceNowcaster(arguments.artifact_root).predict(
        event, arguments.lead_minutes
    )
    print(json.dumps(forecast, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
