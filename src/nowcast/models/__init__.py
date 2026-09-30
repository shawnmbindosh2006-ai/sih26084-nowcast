"""Forecast model adapters owned by the model integration module."""

from .persistence import (
    DEFAULT_SUPPORTED_LEAD_TIMES_MINUTES,
    EventValidationError,
    PersistenceNowcaster,
    UnsupportedLeadTimeError,
    predict,
)
from .optical_flow import (
    DEFAULT_HISTORY_FRAMES,
    OPTICAL_FLOW_SUPPORTED_LEAD_TIMES_MINUTES,
    OpticalFlowNowcaster,
    OpticalFlowPersistenceRouter,
    OpticalFlowRuntimeError,
)

__all__ = [
    "DEFAULT_SUPPORTED_LEAD_TIMES_MINUTES",
    "EventValidationError",
    "PersistenceNowcaster",
    "UnsupportedLeadTimeError",
    "predict",
    "DEFAULT_HISTORY_FRAMES",
    "OPTICAL_FLOW_SUPPORTED_LEAD_TIMES_MINUTES",
    "OpticalFlowNowcaster",
    "OpticalFlowPersistenceRouter",
    "OpticalFlowRuntimeError",
]
