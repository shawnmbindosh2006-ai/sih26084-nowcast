"""Honest array metrics with explicit undefined-denominator handling."""

from __future__ import annotations

from math import sqrt
from typing import Any, Sequence

import numpy as np


def _paired_numeric_arrays(prediction: Any, target: Any) -> tuple[np.ndarray, np.ndarray]:
    predicted = np.asarray(prediction)
    observed = np.asarray(target)
    if predicted.shape != observed.shape:
        raise ValueError("prediction and target shapes must match")
    if predicted.size == 0:
        raise ValueError("prediction and target arrays must not be empty")
    if not np.issubdtype(predicted.dtype, np.number) or not np.issubdtype(
        observed.dtype, np.number
    ):
        raise ValueError("prediction and target arrays must be numeric")
    if not np.isfinite(predicted).all() or not np.isfinite(observed).all():
        raise ValueError("prediction and target arrays must contain only finite values")
    return predicted.astype(np.float64, copy=False), observed.astype(np.float64, copy=False)


def continuous_metrics(prediction: Any, target: Any) -> dict[str, float]:
    predicted, observed = _paired_numeric_arrays(prediction, target)
    difference = predicted - observed
    mse = float(np.mean(np.square(difference)))
    return {"mae": float(np.mean(np.abs(difference))), "rmse": sqrt(mse)}


def _ratio_or_none(numerator: int, denominator: int) -> float | None:
    return None if denominator == 0 else numerator / denominator


def contingency_metrics(
    prediction: Any, target: Any, threshold: float
) -> dict[str, int | float | None]:
    predicted, observed = _paired_numeric_arrays(prediction, target)
    if not np.isfinite(threshold):
        raise ValueError("threshold must be finite")
    predicted_event = predicted >= threshold
    observed_event = observed >= threshold
    hits = int(np.count_nonzero(predicted_event & observed_event))
    misses = int(np.count_nonzero(~predicted_event & observed_event))
    false_alarms = int(np.count_nonzero(predicted_event & ~observed_event))
    return {
        "threshold": float(threshold),
        "hits": hits,
        "misses": misses,
        "false_alarms": false_alarms,
        "csi": _ratio_or_none(hits, hits + misses + false_alarms),
        "pod": _ratio_or_none(hits, hits + misses),
        "far": _ratio_or_none(false_alarms, hits + false_alarms),
    }


def evaluate_by_lead(
    prediction: Any,
    target: Any,
    lead_times_minutes: Sequence[int],
    threshold: float,
    *,
    variable: str,
    units: str,
) -> dict[str, Any]:
    predicted, observed = _paired_numeric_arrays(prediction, target)
    leads = tuple(lead_times_minutes)
    if predicted.ndim < 2 or predicted.shape[0] != len(leads):
        raise ValueError("array axis 0 must match lead_times_minutes")
    if not leads or any(isinstance(value, bool) or not isinstance(value, int) for value in leads):
        raise ValueError("lead_times_minutes must contain integers")
    if tuple(sorted(set(leads))) != leads:
        raise ValueError("lead_times_minutes must be unique and strictly increasing")
    results = []
    for index, lead_minutes in enumerate(leads):
        results.append(
            {
                "lead_minutes": lead_minutes,
                **continuous_metrics(predicted[index], observed[index]),
                **contingency_metrics(predicted[index], observed[index], threshold),
            }
        )
    return {
        "variable": variable,
        "units": units,
        "sample_count": int(predicted.shape[0]),
        "definitions": {
            "hit": "prediction >= threshold and target >= threshold",
            "miss": "prediction < threshold and target >= threshold",
            "false_alarm": "prediction >= threshold and target < threshold",
        },
        "by_lead": results,
    }
