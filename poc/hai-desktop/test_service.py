"""Unit tests for the desktop service. A fake session runner stands in for
hai-agents — no real desktop is ever controlled by these tests.

Run: poc/hai-desktop/.venv/bin/python -m unittest discover -s poc/hai-desktop
"""

from __future__ import annotations

import os
import threading
import time
import unittest
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any, Optional

from fastapi.testclient import TestClient

import desktop_agent
from desktop_service import create_app
from schemas import map_h_status

TOKEN = "test-token-not-a-real-secret"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@dataclass
class FakeResult:
    status: str = "completed"
    answer: Any = "The result is 576."
    outcome: Optional[str] = "success"
    error: Optional[str] = None
    error_code: Optional[str] = None


class FakeSession:
    def __init__(self, result: FakeResult, block: bool = False):
        self.id = "h-session-fake"
        self._result = result
        self._release = threading.Event()
        if not block:
            self._release.set()
        self.cancelled = False

    def stream(self):
        class Event:
            pass

        yield Event()
        self._release.wait(timeout=10)

    def wait_for_completion(self) -> FakeResult:
        if self.cancelled and self._result.status == "completed":
            return FakeResult(status="interrupted", answer=None, outcome=None)
        return self._result

    def cancel(self) -> None:
        self.cancelled = True
        self._release.set()

    def release(self) -> None:
        self._release.set()


class FakeStarter:
    def __init__(self, result: FakeResult = FakeResult(), block: bool = False):
        self.calls = 0
        self.sessions: list[FakeSession] = []
        self._result = result
        self._block = block

    def __call__(self, instruction: str, max_time_s: float) -> FakeSession:
        self.calls += 1
        session = FakeSession(self._result, block=self._block)
        self.sessions.append(session)
        return session


def make_client(starter: FakeStarter) -> TestClient:
    return TestClient(create_app(session_starter=starter, token=TOKEN))


def post_task(client: TestClient, task_id: str = "task-1", **overrides: Any):
    body = {
        "taskId": task_id,
        "kylianSessionId": "session-1",
        "instruction": "Open Calculator and compute 4800 * 0.12.",
        "timeoutSeconds": 60,
        **overrides,
    }
    return client.post("/tasks", json=body, headers=AUTH)


def wait_for_terminal(client: TestClient, task_id: str, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        record = client.get(f"/tasks/{task_id}", headers=AUTH).json()
        if record["status"] in {"completed", "failed", "cancelled", "timed_out"}:
            return record
        time.sleep(0.02)
    raise AssertionError(f"task {task_id} did not settle: {record}")


class AuthTests(unittest.TestCase):
    def test_health_needs_no_auth(self):
        client = make_client(FakeStarter())
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_missing_and_wrong_token_are_rejected(self):
        client = make_client(FakeStarter())
        self.assertEqual(client.get("/tasks/x").status_code, 401)
        self.assertEqual(
            client.get("/tasks/x", headers={"Authorization": "Bearer wrong"}).status_code, 401
        )

    def test_unconfigured_token_fails_closed(self):
        client = TestClient(create_app(session_starter=FakeStarter(), token=None))
        import os

        original = os.environ.pop("KYLIAN_DESKTOP_SERVICE_TOKEN", None)
        try:
            self.assertEqual(client.get("/tasks/x", headers=AUTH).status_code, 503)
        finally:
            if original is not None:
                os.environ["KYLIAN_DESKTOP_SERVICE_TOKEN"] = original


class ValidationTests(unittest.TestCase):
    def test_rejects_bad_payloads(self):
        client = make_client(FakeStarter())
        self.assertEqual(post_task(client, instruction="").status_code, 422)
        self.assertEqual(post_task(client, taskId="").status_code, 422)
        self.assertEqual(post_task(client, kylianSessionId="").status_code, 422)
        self.assertEqual(post_task(client, timeoutSeconds=5).status_code, 422)
        self.assertEqual(post_task(client, timeoutSeconds=100_000).status_code, 422)


class LifecycleTests(unittest.TestCase):
    def test_happy_path_completes_with_answer(self):
        starter = FakeStarter()
        client = make_client(starter)
        response = post_task(client)
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["status"], "queued")
        record = wait_for_terminal(client, "task-1")
        self.assertEqual(record["status"], "completed")
        self.assertEqual(record["hSessionId"], "h-session-fake")
        self.assertEqual(record["outcome"], "success")
        self.assertIn("576", record["answer"])
        self.assertIsNone(record["error"])

    def test_duplicate_task_id_is_idempotent(self):
        starter = FakeStarter()
        client = make_client(starter)
        post_task(client)
        wait_for_terminal(client, "task-1")
        again = post_task(client)
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.json()["taskId"], "task-1")
        self.assertEqual(starter.calls, 1)

    def test_second_active_task_is_rejected(self):
        starter = FakeStarter(block=True)
        client = make_client(starter)
        post_task(client, task_id="task-a")
        response = post_task(client, task_id="task-b")
        self.assertEqual(response.status_code, 409)
        starter.sessions[0].release()
        wait_for_terminal(client, "task-a")
        # After the first task settles a new one is accepted again.
        self.assertEqual(post_task(client, task_id="task-c").status_code, 202)
        deadline = time.monotonic() + 5
        while len(starter.sessions) < 2 and time.monotonic() < deadline:
            time.sleep(0.02)
        starter.sessions[-1].release()
        wait_for_terminal(client, "task-c")

    def test_cancel_maps_to_cancelled(self):
        starter = FakeStarter(block=True)
        client = make_client(starter)
        post_task(client)
        deadline = time.monotonic() + 5
        while not starter.sessions and time.monotonic() < deadline:
            time.sleep(0.02)
        response = client.post("/tasks/task-1/cancel", headers=AUTH)
        self.assertEqual(response.status_code, 200)
        record = wait_for_terminal(client, "task-1")
        self.assertEqual(record["status"], "cancelled")
        self.assertTrue(starter.sessions[0].cancelled)

    def test_failed_session_surfaces_safe_error(self):
        starter = FakeStarter(
            result=FakeResult(status="failed", answer=None, outcome=None, error="no_answer template", error_code="no_answer")
        )
        client = make_client(starter)
        post_task(client)
        record = wait_for_terminal(client, "task-1")
        self.assertEqual(record["status"], "failed")
        self.assertIn("no_answer", record["error"])

    def test_timed_out_session_maps_to_timed_out(self):
        starter = FakeStarter(result=FakeResult(status="timed_out", answer=None, outcome=None, error_code="timeout"))
        client = make_client(starter)
        post_task(client)
        record = wait_for_terminal(client, "task-1")
        self.assertEqual(record["status"], "timed_out")

    def test_unknown_task_is_404(self):
        client = make_client(FakeStarter())
        self.assertEqual(client.get("/tasks/nope", headers=AUTH).status_code, 404)


class EventTests(unittest.TestCase):
    def test_events_are_safe_and_paginated(self):
        starter = FakeStarter()
        client = make_client(starter)
        post_task(client)
        wait_for_terminal(client, "task-1")
        page = client.get("/tasks/task-1/events", headers=AUTH).json()
        kinds = [event["kind"] for event in page["events"]]
        self.assertIn("task_queued", kinds)
        self.assertIn("agent_started", kinds)
        self.assertIn("task_completed", kinds)
        for event in page["events"]:
            self.assertEqual(sorted(event.keys()), ["at", "index", "kind"])
        rest = client.get(f"/tasks/task-1/events?from={page['next']}", headers=AUTH).json()
        self.assertEqual(rest["events"], [])

    def test_no_credentials_in_any_response(self):
        starter = FakeStarter()
        client = make_client(starter)
        post_task(client)
        record = wait_for_terminal(client, "task-1")
        page = client.get("/tasks/task-1/events", headers=AUTH).json()
        for blob in (str(record), str(page)):
            self.assertNotIn(TOKEN, blob)


class ExtractFrameTests(unittest.TestCase):
    """extract_frame is shape-agnostic: it handles event.data as a dict (holo)
    and as an object (hai), and returns None on anything unrecognized."""

    def test_extracts_from_dict_event(self):
        event = SimpleNamespace(
            data={"kind": "observation", "image": {"type": "base64", "media_type": "image/png", "source": "ZZ"}}
        )
        frame = desktop_agent.extract_frame(event)
        self.assertIsNotNone(frame)
        self.assertEqual(frame.mediaType, "image/png")
        self.assertEqual(frame.dataBase64, "ZZ")

    def test_extracts_from_object_event(self):
        image = SimpleNamespace(type="base64", media_type="image/jpeg", source="QQ")
        event = SimpleNamespace(data=SimpleNamespace(kind="observation_event", screenshot=image))
        frame = desktop_agent.extract_frame(event)
        self.assertIsNotNone(frame)
        self.assertEqual(frame.dataBase64, "QQ")

    def test_extracts_from_data_url(self):
        event = SimpleNamespace(data={"kind": "obs", "screenshot": "data:image/jpeg;base64,DDDD"})
        frame = desktop_agent.extract_frame(event)
        self.assertIsNotNone(frame)
        self.assertEqual(frame.dataBase64, "DDDD")

    def test_unknown_shape_returns_none(self):
        self.assertIsNone(desktop_agent.extract_frame(SimpleNamespace(data={"kind": "act_event"})))


class LiveViewTests(unittest.TestCase):
    """With KYLIAN_LIVE_VIEW=1 the newest event carries a screenshot; older
    frames are dropped and frameless events keep the exact 3-key shape."""

    def setUp(self):
        self._original = os.environ.get("KYLIAN_LIVE_VIEW")
        os.environ["KYLIAN_LIVE_VIEW"] = "1"

    def tearDown(self):
        if self._original is None:
            os.environ.pop("KYLIAN_LIVE_VIEW", None)
        else:
            os.environ["KYLIAN_LIVE_VIEW"] = self._original

    def _frame_starter(self):
        class ImgEvent:
            def __init__(self, b64: str):
                self.data = {"kind": "observation_event", "image": {"type": "base64", "media_type": "image/jpeg", "source": b64}}

        class FrameSession:
            id = "h-session-frames"

            def stream(self):
                yield ImgEvent("AAAA")
                yield ImgEvent("BBBB")

            def wait_for_completion(self):
                return FakeResult()

            def cancel(self):
                pass

        return lambda instruction, max_time_s: FrameSession()

    def test_only_the_newest_frame_survives_and_shape_stays_exact(self):
        client = TestClient(create_app(session_starter=self._frame_starter(), token=TOKEN))
        post_task(client)
        wait_for_terminal(client, "task-1")
        events = client.get("/tasks/task-1/events", headers=AUTH).json()["events"]

        framed = [event for event in events if "frame" in event]
        self.assertEqual(len(framed), 1, "only the latest screenshot is retained")
        self.assertEqual(framed[0]["frame"], {"mediaType": "image/jpeg", "dataBase64": "BBBB"})
        self.assertEqual(sorted(framed[0].keys()), ["at", "frame", "index", "kind"])
        for event in events:
            if "frame" not in event:
                self.assertEqual(sorted(event.keys()), ["at", "index", "kind"])


class MappingTests(unittest.TestCase):
    def test_status_mapping(self):
        self.assertEqual(map_h_status("completed"), "completed")
        self.assertEqual(map_h_status("failed"), "failed")
        self.assertEqual(map_h_status("timed_out"), "timed_out")
        self.assertEqual(map_h_status("interrupted"), "cancelled")
        self.assertEqual(map_h_status("interrupted", timed_out_by_watchdog=True), "timed_out")
        self.assertEqual(map_h_status("queued"), "queued")
        for running_like in ("pending", "running", "paused", "idle", "awaiting_tool_results"):
            self.assertEqual(map_h_status(running_like), "running")


if __name__ == "__main__":
    unittest.main()
