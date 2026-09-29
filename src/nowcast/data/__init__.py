"""EventBundle v1 input artifacts; no model or API dependencies."""
from .loader import EventBundle, EventValidationError, load_event

__all__ = ["EventBundle", "EventValidationError", "load_event"]
