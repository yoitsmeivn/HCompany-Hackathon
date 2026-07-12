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


class TaskFrame(BaseModel):
    """A single desktop screenshot observed during a task. Only present when the
    live-view flag (KYLIAN_LIVE_VIEW=1) is on; omitted from the wire otherwise so
    the default event contract (kind only) is unchanged."""

    mediaType: str = Field(min_length=1, max_length=64)
    dataBase64: str = Field(min_length=1)


class TaskEvent(BaseModel):
    """A safe progress event: lifecycle kind only — never model output or
    chain-of-thought. Carries an optional desktop screenshot only when the
    operator has opted into live view (KYLIAN_LIVE_VIEW=1)."""

    index: int
    at: str
    kind: str
    frame: Optional[TaskFrame] = None


class ArtifactRef(BaseModel):
    """A file the desktop agent located, reported as a structured record.
    The Node ArtifactStore still validates each path independently."""

    localPath: str
    displayName: str


class TaskRecord(BaseModel):
    """Task state returned by every task endpoint."""

    taskId: str
    status: TaskStatus
    hSessionId: Optional[str] = None
    outcome: Optional[str] = None
    answer: Optional[str] = None
    error: Optional[str] = None
    # Files the agent reported via the ARTIFACTS_JSON marker (may be empty).
    artifacts: list[ArtifactRef] = []
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
