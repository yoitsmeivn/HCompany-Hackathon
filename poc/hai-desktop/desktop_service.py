"""Kylian local desktop service: authenticated HTTP wrapper around
hai-agents[desktop].

Runs as a third local process next to `npm run start:api` and `npm run dev:web`:

    poc/hai-desktop/.venv/bin/python -m uvicorn desktop_service:app \
        --app-dir poc/hai-desktop --host 127.0.0.1 --port 8790

Binds to 127.0.0.1 only and must never be exposed through a tunnel. Every
route except /health requires the bearer token shared with the Kylian backend
(KYLIAN_DESKTOP_SERVICE_TOKEN, loaded from the repo .env — never printed).
Exactly one desktop task runs at a time; progress events expose lifecycle
kinds only, never model output or screenshots.
"""

from __future__ import annotations

import hmac
import os
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.responses import JSONResponse

import desktop_agent
from schemas import (
    TERMINAL_STATUSES,
    TaskEvent,
    TaskEventsPage,
    TaskRecord,
    TaskRequest,
    map_h_status,
)

MAX_EVENTS_PER_TASK = 500
WATCHDOG_GRACE_S = 15


@dataclass
class TaskState:
    record: TaskRecord
    instruction: str
    timeout_seconds: int
    events: list[TaskEvent] = field(default_factory=list)
    session: Any = None
    cancel_requested: bool = False
    timed_out: bool = False
    lock: threading.Lock = field(default_factory=threading.Lock)

    def add_event(self, kind: str) -> None:
        with self.lock:
            if len(self.events) >= MAX_EVENTS_PER_TASK:
                return
            self.events.append(
                TaskEvent(index=len(self.events), at=datetime.now(timezone.utc).isoformat(), kind=kind)
            )

    def is_terminal(self) -> bool:
        return self.record.status in TERMINAL_STATUSES


def create_app(
    session_starter: Callable[[str, float], Any] = desktop_agent.start_desktop_session,
    token: Optional[str] = None,
) -> FastAPI:
    app = FastAPI(title="Kylian desktop service", docs_url=None, redoc_url=None)
    registry: dict[str, TaskState] = {}
    registry_lock = threading.Lock()

    def expected_token() -> str:
        value = token if token is not None else os.environ.get("KYLIAN_DESKTOP_SERVICE_TOKEN", "")
        if not value:
            # Fail closed: an unset token must never mean "no auth".
            raise HTTPException(status_code=503, detail="service token is not configured")
        return value

    def require_auth(authorization: Optional[str] = Header(default=None)) -> None:
        expected = expected_token()
        provided = ""
        if authorization and authorization.startswith("Bearer "):
            provided = authorization.removeprefix("Bearer ").strip()
        if not provided or not hmac.compare_digest(provided.encode(), expected.encode()):
            raise HTTPException(status_code=401, detail="invalid bearer token")

    def busy() -> bool:
        with registry_lock:
            return any(not state.is_terminal() for state in registry.values())

    def run_task(state: TaskState) -> None:
        record = state.record
        watchdog: Optional[threading.Timer] = None
        try:
            session = session_starter(state.instruction, float(state.timeout_seconds))
            state.session = session
            record.hSessionId = getattr(session, "id", None)
            record.status = "running"
            state.add_event("agent_started")

            def on_deadline() -> None:
                if not state.is_terminal():
                    state.timed_out = True
                    try:
                        session.cancel()
                    except Exception:
                        pass

            watchdog = threading.Timer(state.timeout_seconds + WATCHDOG_GRACE_S, on_deadline)
            watchdog.daemon = True
            watchdog.start()

            for event in session.stream():
                state.add_event(desktop_agent.safe_event_kind(event))

            result = session.wait_for_completion()
            record.status = map_h_status(str(result.status), timed_out_by_watchdog=state.timed_out)
            record.outcome = result.outcome
            record.answer = desktop_agent.safe_answer(result.answer)
            record.error = desktop_agent.safe_error(result.error, result.error_code)
        except Exception as exc:  # noqa: BLE001 — worker must never crash the service
            if not state.is_terminal():
                record.status = (
                    "timed_out" if state.timed_out else ("cancelled" if state.cancel_requested else "failed")
                )
                record.error = desktop_agent.safe_error(str(exc) or type(exc).__name__, None)
        finally:
            if watchdog is not None:
                watchdog.cancel()
            state.add_event(f"task_{record.status}")

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"status": "ok", "busy": busy()}

    @app.post("/tasks", dependencies=[Depends(require_auth)])
    def create_task(request: TaskRequest) -> JSONResponse:
        with registry_lock:
            existing = registry.get(request.taskId)
            if existing is not None:
                # Idempotent: re-posting a known taskId never starts a second session.
                return JSONResponse(status_code=200, content=existing.record.model_dump())
            if any(not state.is_terminal() for state in registry.values()):
                raise HTTPException(status_code=409, detail="a desktop task is already running")
            state = TaskState(
                record=TaskRecord(taskId=request.taskId, status="queued"),
                instruction=request.instruction,
                timeout_seconds=request.timeoutSeconds,
            )
            registry[request.taskId] = state
        state.add_event("task_queued")
        # Snapshot before the worker starts so the 202 body deterministically
        # reports the queued state instead of racing the thread.
        accepted = state.record.model_dump()
        worker = threading.Thread(target=run_task, args=(state,), daemon=True, name=f"task-{request.taskId}")
        worker.start()
        return JSONResponse(status_code=202, content=accepted)

    def get_state(task_id: str) -> TaskState:
        with registry_lock:
            state = registry.get(task_id)
        if state is None:
            raise HTTPException(status_code=404, detail="unknown task")
        return state

    @app.get("/tasks/{task_id}", dependencies=[Depends(require_auth)])
    def get_task(task_id: str) -> TaskRecord:
        return get_state(task_id).record

    @app.post("/tasks/{task_id}/cancel", dependencies=[Depends(require_auth)])
    def cancel_task(task_id: str) -> TaskRecord:
        state = get_state(task_id)
        if not state.is_terminal():
            state.cancel_requested = True
            session = state.session
            if session is not None:
                try:
                    session.cancel()
                except Exception:
                    pass
            state.add_event("cancel_requested")
        return state.record

    @app.get("/tasks/{task_id}/events", dependencies=[Depends(require_auth)])
    def get_events(task_id: str, from_index: int = Query(default=0, alias="from", ge=0)) -> TaskEventsPage:
        state = get_state(task_id)
        with state.lock:
            events = [event for event in state.events if event.index >= from_index]
            next_index = len(state.events)
        return TaskEventsPage(events=events, next=next_index)

    return app


# uvicorn entrypoint. load_env() only populates os.environ from the repo .env;
# a missing token fails closed per-request (503), so importing this module for
# tests never exits.
desktop_agent.load_env()
app = create_app()
