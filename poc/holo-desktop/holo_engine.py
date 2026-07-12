"""HoloDesktop execution engine for the Kylian desktop service.

Wraps the official embedded client (holo_desktop.agent_client) behind the same
session-handle shape the service already consumes for the hai-agents engine:
``start_desktop_session(instruction, max_time_s)`` → handle with ``id``,
``stream()``, ``wait_for_completion()``, ``cancel()``.

Key properties:
- One long-lived hai-agent-runtime daemon (``ensure_running``) shared across
  tasks — model and runs-dir are process-level settings per the official docs,
  and reuse removes the ~20s cold-start from every task after the first.
- ``run_turn`` (the same driver the CLI/MCP/ACP surfaces use) owns session
  creation, streaming, the desktop-turn lock, and stop handling.
- Events are projected to lifecycle kind strings only (``safe_kind``); model
  output, screenshots, and reasoning never leave this module.
"""

from __future__ import annotations

import asyncio
import json
import os
import queue
import threading
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Callable, Optional

import desktop_agent  # shared env loader + opt-in screenshot extractor (KYLIAN_LIVE_VIEW)

HOLO_DIR = Path(__file__).resolve().parent
RUNS_DIR = HOLO_DIR / "runs"

DEFAULT_MODEL = os.environ.get("HOLO_MODEL", "holo3-1-35b-a3b")
AGENT_PORT = int(os.environ.get("HOLO_AGENT_PORT", "18795"))
MAX_STEPS = int(os.environ.get("KYLIAN_HOLO_MAX_STEPS", "30"))

# Structural guard appended to every instruction (task normalization). It is
# operation-AGNOSTIC and defers to the task's own instructions about sending —
# the orchestrator authors operation-aware send/draft rules, and this guard must
# never contradict them with a blanket "do not send" clause.
TASK_GUARD = (
    "Complete exactly this task as written, then stop. Follow the task's own "
    "instructions about whether to send, submit, or leave a draft. Do not "
    "delete, purchase, or publish anything the task does not explicitly "
    "request. Do not interact with unrelated applications. Operate the "
    "graphical interface; do not open Terminal or run shell commands — in-app "
    "keyboard shortcuts such as Command+Shift+G in a file picker are allowed."
)


# Machine-readable artifact reporting. Every task is asked to end with this
# marker if it located a file, so the host never has to regex-scan prose for
# paths. The orchestrator still validates each path independently.
ARTIFACT_MARKER = "ARTIFACTS_JSON:"
ARTIFACT_DIRECTIVE = (
    f" If you located one or more local files, end your final answer with exactly one line "
    f'starting with "{ARTIFACT_MARKER}" followed by a JSON array of objects with "localPath" '
    f'(the real absolute path, never a placeholder like /Users/[username]) and "displayName" '
    f"(the file name). Example: {ARTIFACT_MARKER} "
    f'[{{"localPath": "/Users/you/Desktop/file.pdf", "displayName": "file.pdf"}}]. '
    f"If you located no files, omit this line."
)


def normalize_task(instruction: str) -> str:
    text = instruction.strip()
    if not text:
        return text
    if not text.endswith((".", "!", "?")):
        text += "."
    return f"{text} {TASK_GUARD}{ARTIFACT_DIRECTIVE}"


def parse_artifacts(answer: Optional[str]) -> tuple[list[dict[str, str]], Optional[str]]:
    """Extract the last ARTIFACTS_JSON line from an answer.

    Returns (artifacts, cleaned_summary). Malformed records are dropped;
    placeholder paths (containing '[' before the basename) are rejected. The
    marker line is stripped from the human-readable summary.
    """
    if not answer:
        return [], answer
    lines = answer.splitlines()
    kept: list[str] = []
    artifacts: list[dict[str, str]] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(ARTIFACT_MARKER):
            payload = stripped[len(ARTIFACT_MARKER):].strip()
            try:
                parsed = json.loads(payload)
            except (ValueError, TypeError):
                continue
            if not isinstance(parsed, list):
                continue
            for record in parsed:
                if not isinstance(record, dict):
                    continue
                local_path = record.get("localPath")
                display_name = record.get("displayName")
                if not isinstance(local_path, str) or not isinstance(display_name, str):
                    continue
                if not local_path.startswith("/") or "[" in local_path or "]" in local_path:
                    continue
                artifacts.append({"localPath": local_path, "displayName": display_name})
            # Drop the marker line from the summary; keep the last one's artifacts.
        else:
            kept.append(line)
    cleaned = "\n".join(kept).strip() or answer
    return artifacts, cleaned


# --- one background asyncio loop + one shared daemon/client -----------------

_loop: Optional[asyncio.AbstractEventLoop] = None
_loop_lock = threading.Lock()
_daemon: Any = None
_client: Any = None


def _ensure_loop() -> asyncio.AbstractEventLoop:
    global _loop
    with _loop_lock:
        if _loop is None:
            loop = asyncio.new_event_loop()
            threading.Thread(target=loop.run_forever, daemon=True, name="holo-loop").start()
            _loop = loop
    return _loop


async def _ensure_client() -> Any:
    """Start or attach to the runtime once; reuse the client across tasks."""
    global _daemon, _client
    if _client is not None:
        return _client
    from holo_desktop.agent_client import AgentApiClient, SpawnConfig, ensure_running
    from holo_desktop.settings import load_holo_settings

    RUNS_DIR.mkdir(exist_ok=True)
    _daemon = await ensure_running(
        SpawnConfig(port=AGENT_PORT, model=DEFAULT_MODEL, runs_dir=RUNS_DIR),
        settings=load_holo_settings(),
    )
    _client = AgentApiClient(_daemon.base_url, _daemon.token)
    return _client


def shutdown() -> None:
    """Release the client and stop a runtime we spawned (uvicorn shutdown hook)."""
    loop, client, daemon = _loop, _client, _daemon
    if loop is None:
        return

    async def _close() -> None:
        if client is not None:
            await client.aclose()
        if daemon is not None:
            await daemon.aclose()

    try:
        asyncio.run_coroutine_threadsafe(_close(), loop).result(timeout=10)
    except Exception:
        pass


async def _default_turn_runner(client: Any, session: Any, task: str, *, max_steps: int, max_time_s: float, on_event: Any) -> Any:
    from holo_desktop.agent_client.session_runner import run_turn

    return await run_turn(client, session, task, max_steps=max_steps, max_time_s=max_time_s, on_event=on_event)


def _safe_kind(event: Any) -> str:
    """Envelope type plus the inner agent-event discriminator — nothing else."""
    data = getattr(event, "data", None)
    inner = data.get("kind") if isinstance(data, dict) else None
    event_type = str(getattr(event, "type", "event"))
    return f"{event_type}:{inner}" if inner else event_type


class HoloSessionHandle:
    """Shape-compatible with the hai engine's SessionHandle as consumed by
    desktop_service.run_task: id / stream() / wait_for_completion() / cancel()."""

    def __init__(self, instruction: str, max_time_s: float, turn_runner: Optional[Callable[..., Any]] = None):
        self._events: "queue.Queue[Any]" = queue.Queue()
        self._session: Any = None
        self._loop = _ensure_loop()
        self._turn_runner = turn_runner or _default_turn_runner
        self._future = asyncio.run_coroutine_threadsafe(self._run(instruction, max_time_s), self._loop)

    @property
    def id(self) -> Optional[str]:
        return getattr(self._session, "session_id", None) if self._session is not None else None

    async def _run(self, instruction: str, max_time_s: float) -> Any:
        from holo_desktop.agent_client.session_runner import Session

        client = await _ensure_client()
        self._session = Session()

        async def on_event(event: Any) -> None:
            # Opt-in live view: mine the base64 screenshot from the runtime event
            # before it is discarded; off by default (no frame ever leaves here).
            frame = desktop_agent.extract_frame(event) if desktop_agent.live_view_enabled() else None
            self._events.put(SimpleNamespace(safe_kind=_safe_kind(event), frame=frame))

        try:
            return await self._turn_runner(
                client, self._session, instruction, max_steps=MAX_STEPS, max_time_s=max_time_s, on_event=on_event
            )
        finally:
            self._events.put(None)  # sentinel: stream() ends

    def stream(self):
        while True:
            item = self._events.get()
            if item is None:
                return
            yield item

    def wait_for_completion(self) -> Any:
        try:
            outcome = self._future.result()
        except asyncio.CancelledError:
            return SimpleNamespace(status="interrupted", answer=None, outcome=None, error=None, error_code=None, artifacts=[])
        status = getattr(getattr(outcome, "status", None), "value", None) or "failed"
        # IDLE counts as a successful turn end per the official session runner.
        if status in ("completed", "idle"):
            status = "completed"
        raw_answer = getattr(outcome, "answer", "") or None
        artifacts, answer = parse_artifacts(raw_answer)
        return SimpleNamespace(
            status=status, answer=answer, outcome=None,
            error=getattr(outcome, "error", None), error_code=None, artifacts=artifacts,
        )

    def cancel(self) -> None:
        session_id = self.id
        if session_id is None:
            self._future.cancel()
            return

        async def _cancel() -> None:
            try:
                client = await _ensure_client()
                await client.cancel(session_id)
            except Exception:
                pass

        asyncio.run_coroutine_threadsafe(_cancel(), self._loop)


def start_desktop_session(instruction: str, max_time_s: float) -> HoloSessionHandle:
    return HoloSessionHandle(normalize_task(instruction), max_time_s)
