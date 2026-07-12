"""Pydantic schemas for the Kylian local desktop service.

The wire contract between Kylian's Node backend (HaiDesktopComputerTaskAdapter)
and this service. Field names are camelCase to match Kylian's existing JSON
conventions. No H SDK types leak through this module.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

TaskStatus = Literal["queued", "running", "completed", "failed", "cancelled", "timed_out"]

TERMINAL_STATUSES: frozenset[str] = frozenset({"completed", "failed", "cancelled", "timed_out"})


class TaskRequest(BaseModel):
    """A structured desktop task submitted by the Kylian backend."""

    taskId: str = Field(min_length=1, max_length=128)
    kylianSessionId: str = Field(min_length=1, max_length=128)
    instruction: str = Field(min_length=1, max_length=4000)
    timeoutSeconds: int = Field(default=120, ge=10, le=900)


class TaskEvent(BaseModel):
    """A safe progress event: lifecycle kind only — never model output,
    screenshots, or chain-of-thought."""

    index: int
    at: str
    kind: str


class TaskRecord(BaseModel):
    """Task state returned by every task endpoint."""

    taskId: str
    status: TaskStatus
    hSessionId: Optional[str] = None
    outcome: Optional[str] = None
    answer: Optional[str] = None
    error: Optional[str] = None
    # Monotonic millisecond offsets from task acceptance (latency instrumentation).
    timings: Optional[dict[str, int]] = None


class TaskEventsPage(BaseModel):
    events: list[TaskEvent]
    next: int


def map_h_status(h_status: str, *, timed_out_by_watchdog: bool = False) -> TaskStatus:
    """Map an H session status onto the service's task status vocabulary.

    ``interrupted`` is what the H platform reports after ``session.cancel()``;
    the watchdog flag distinguishes our own timeout-cancel from a user cancel.
    """
    if h_status == "completed":
        return "completed"
    if h_status == "failed":
        return "failed"
    if h_status == "timed_out":
        return "timed_out"
    if h_status == "interrupted":
        return "timed_out" if timed_out_by_watchdog else "cancelled"
    if h_status == "queued":
        return "queued"
    # pending / running / paused / idle / awaiting_tool_results
    return "running"
