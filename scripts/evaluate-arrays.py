#!/usr/bin/env python3
"""Evaluate prediction and target arrays with axis 0 representing lead time."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT / "src"))

from nowcast.evaluation.metrics import evaluate_by_lead  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("prediction", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument("--lead-minutes", type=int, nargs="+", required=True)
    parser.add_argument("--threshold", type=float, required=True)
    parser.add_argument("--variable", required=True)
    parser.add_argument("--units", required=True)
    arguments = parser.parse_args()

    prediction = np.load(arguments.prediction, allow_pickle=False)
    target = np.load(arguments.target, allow_pickle=False)
    result = evaluate_by_lead(
        prediction,
        target,
        arguments.lead_minutes,
        arguments.threshold,
        variable=arguments.variable,
        units=arguments.units,
    )
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
