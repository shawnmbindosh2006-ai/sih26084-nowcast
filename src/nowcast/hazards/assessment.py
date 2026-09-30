"""Conservative hazard assessments for events without validated methods."""

from typing import Any


def empty_zones() -> dict[str, Any]:
    return {"type": "FeatureCollection", "features": []}


def unavailable(reason: str, *, units: str | None = None) -> dict[str, Any]:
    return {
        "status": "unavailable",
        "probability": None,
        "units": units,
        "method": None,
        "reason": reason,
        "zones": empty_zones(),
        "estimated_arrival_utc": None,
        "timing_uncertainty_minutes": None,
    }


def assess_hazards(*, has_observations: bool, has_geography: bool) -> dict[str, Any]:
    if not has_observations:
        reason = "No observation array is present in the metadata-only fixture."
    else:
        reason = "No validated hazard method or calibration is configured."
    if not has_geography:
        reason += " Geographic bounds are unknown; no hazard zones or arrival estimates can be derived."
    return {
        "storm_intensity_proxy": unavailable(
            "VIL/intensity proxy disabled: the fixture has no documented VIL encoding or threshold."
            + (" Geographic bounds are unknown." if not has_geography else ""),
            units="not_available",
        ),
        "hail": unavailable(reason),
        "lightning": unavailable(reason, units="not_available"),
        "downburst": unavailable(reason, units="not_available"),
        "cloudburst": unavailable(reason),
    }
