"""Honest array metrics with explicit undefined-denominator handling."""

from __future__ import annotations

from math import sqrt
from typing import Any, Mapping, Sequence

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


def compare_methods_by_lead(
    predictions: Mapping[str, Any],
    target: Any,
    lead_times_minutes: Sequence[int],
    threshold: float,
    *,
    event_id: str,
    variable: str,
    units: str,
    valid_mask: Any | None = None,
) -> dict[str, Any]:
    """Compare forecast methods against separately loaded future truth.

    ``valid_mask=True`` means a sample is eligible for evaluation.  Each method
    is additionally intersected with finite forecast and truth values, so a
    missing optical-flow pixel is never scored as a numeric zero.  Targets are
    supplied directly to this evaluation function and remain outside every
    provider's ``predict`` interface.
    """

    if not isinstance(predictions, Mapping) or not predictions:
        raise ValueError("predictions must be a non-empty method mapping")
    if not isinstance(event_id, str) or not event_id:
        raise ValueError("event_id must be a non-empty string")
    observed = np.asarray(target)
    if observed.size == 0 or not np.issubdtype(observed.dtype, np.number):
        raise ValueError("target must be a non-empty numeric array")
    leads = tuple(lead_times_minutes)
    if observed.ndim < 2 or observed.shape[0] != len(leads):
        raise ValueError("target axis 0 must match lead_times_minutes")
    if not leads or any(isinstance(value, bool) or not isinstance(value, int) for value in leads):
        raise ValueError("lead_times_minutes must contain integers")
    if tuple(sorted(set(leads))) != leads:
        raise ValueError("lead_times_minutes must be unique and strictly increasing")
    if not np.isfinite(threshold):
        raise ValueError("threshold must be finite")

    if valid_mask is None:
        eligible = np.ones(observed.shape, dtype=bool)
    else:
        raw_mask = np.asarray(valid_mask)
        if raw_mask.dtype != np.bool_:
            raise ValueError("valid_mask must be boolean; True means valid")
        try:
            eligible = np.broadcast_to(raw_mask, observed.shape)
        except ValueError as exc:
            raise ValueError("valid_mask must broadcast to target shape") from exc

    by_method: dict[str, Any] = {}
    for method, prediction in predictions.items():
        if not isinstance(method, str) or not method:
            raise ValueError("prediction method names must be non-empty strings")
        predicted = np.asarray(prediction)
        if predicted.shape != observed.shape:
            raise ValueError(f"prediction shape for {method} must match target shape")
        if not np.issubdtype(predicted.dtype, np.number):
            raise ValueError(f"prediction for {method} must be numeric")
        method_results = []
        for index, lead_minutes in enumerate(leads):
            score_mask = (
                eligible[index]
                & np.isfinite(observed[index])
                & np.isfinite(predicted[index])
            )
            valid_count = int(np.count_nonzero(score_mask))
            if valid_count == 0:
                raise ValueError(
                    f"no valid prediction/target pairs for {method} at +{lead_minutes} minutes"
                )
            predicted_values = predicted[index][score_mask]
            observed_values = observed[index][score_mask]
            method_results.append(
                {
                    "event_id": event_id,
                    "method": method,
                    "lead_minutes": lead_minutes,
                    "valid_count": valid_count,
                    "valid_fraction": valid_count / int(observed[index].size),
                    **continuous_metrics(predicted_values, observed_values),
                    **contingency_metrics(predicted_values, observed_values, threshold),
                }
            )
        by_method[method] = method_results

    return {
        "event_id": event_id,
        "variable": variable,
        "units": units,
        "lead_times_minutes": list(leads),
        "threshold": float(threshold),
        "valid_mask_semantics": "True=eligible; finite prediction/target intersection is scored",
        "by_method": by_method,
    }
