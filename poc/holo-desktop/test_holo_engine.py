"""Unit tests for the HoloDesktop engine and its service integration.

A fake turn runner and fake client stand in for holo_desktop — no runtime is
spawned and no real desktop is controlled.

Run: poc/holo-desktop/.venv/bin/python -m unittest discover -s poc/holo-desktop
"""

from __future__ import annotations

import sys
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "hai-desktop"))

import holo_engine
from holo_engine import HoloSessionHandle, normalize_task


def outcome(status: str = "completed", answer: str = "The result is 1,200.", error=None):
    return SimpleNamespace(status=SimpleNamespace(value=status), answer=answer, error=error, session_id="holo-s-1")


class FakeClient:
    def __init__(self):
        self.cancelled: list[str] = []

    async def cancel(self, session_id: str) -> None:
        self.cancelled.append(session_id)

    async def aclose(self) -> None:
        pass


def make_runner(result, events=("agent_event", "agent_event"), record=None):
    async def runner(client, session, task, *, max_steps, max_time_s, on_event):
        if record is not None:
            record.append({"client": client, "task": task, "max_steps": max_steps, "max_time_s": max_time_s})
        session.session_id = "holo-s-1"
        for kind in events:
            await on_event(SimpleNamespace(type=kind, data={"kind": "act_event"}))
        return result

    return runner


class EngineTests(unittest.TestCase):
    def setUp(self):
        holo_engine._client = FakeClient()  # prevents runtime spawn

    def tearDown(self):
        holo_engine._client = None

    def test_normalize_task_appends_guard_and_punctuation(self):
        normalized = normalize_task("Open Finder and locate the resume PDF")
        self.assertTrue(normalized.startswith("Open Finder and locate the resume PDF."))
        self.assertIn("Complete exactly this task, then stop", normalized)
        self.assertIn("do not open Terminal or run shell commands", normalized)
        self.assertIn("Do not send, submit, or delete anything", normalized)
        self.assertEqual(normalize_task("Do it now!").count("!"), 1)

    def test_completed_turn_streams_safe_events_and_answer(self):
        handle = HoloSessionHandle("task", 120, turn_runner=make_runner(outcome()))
        kinds = [event.safe_kind for event in handle.stream()]
        self.assertEqual(kinds, ["agent_event:act_event", "agent_event:act_event"])
        for event_kind in kinds:  # lifecycle discriminators only — no content fields
            self.assertNotIn("screenshot", event_kind)
        result = handle.wait_for_completion()
        self.assertEqual(result.status, "completed")
        self.assertIn("1,200", result.answer)
        self.assertEqual(handle.id, "holo-s-1")

    def test_idle_status_counts_as_completed(self):
        handle = HoloSessionHandle("task", 120, turn_runner=make_runner(outcome(status="idle")))
        list(handle.stream())
        self.assertEqual(handle.wait_for_completion().status, "completed")

    def test_failed_turn_surfaces_stable_error(self):
        handle = HoloSessionHandle("task", 120, turn_runner=make_runner(outcome(status="failed", answer="", error="budget exhausted")))
        list(handle.stream())
        result = handle.wait_for_completion()
        self.assertEqual(result.status, "failed")
        self.assertEqual(result.error, "budget exhausted")
        self.assertIsNone(result.answer)

    def test_timed_out_status_passes_through(self):
        handle = HoloSessionHandle("task", 120, turn_runner=make_runner(outcome(status="timed_out", answer="")))
        list(handle.stream())
        self.assertEqual(handle.wait_for_completion().status, "timed_out")

    def test_cancel_with_session_calls_client_cancel(self):
        fake = holo_engine._client

        async def slow_runner(client, session, task, *, max_steps, max_time_s, on_event):
            session.session_id = "holo-s-1"
            import asyncio

            for _ in range(100):
                if fake.cancelled:
                    return outcome(status="interrupted", answer="")
                await asyncio.sleep(0.01)
            return outcome()

        handle = HoloSessionHandle("task", 120, turn_runner=slow_runner)
        deadline = time.monotonic() + 2
        while handle.id is None and time.monotonic() < deadline:
            time.sleep(0.01)
        handle.cancel()
        list(handle.stream())
        self.assertEqual(handle.wait_for_completion().status, "interrupted")
        self.assertEqual(fake.cancelled, ["holo-s-1"])

    def test_runtime_reuse_across_tasks(self):
        calls: list[dict] = []
        for _ in range(2):
            handle = HoloSessionHandle("task", 120, turn_runner=make_runner(outcome(), record=calls))
            list(handle.stream())
            handle.wait_for_completion()
        self.assertIs(calls[0]["client"], calls[1]["client"], "both tasks reuse the same client/daemon")

    def test_bounds_are_passed_to_the_turn(self):
        calls: list[dict] = []
        handle = HoloSessionHandle("task", 240, turn_runner=make_runner(outcome(), record=calls))
        list(handle.stream())
        handle.wait_for_completion()
        self.assertEqual(calls[0]["max_time_s"], 240)
        self.assertEqual(calls[0]["max_steps"], holo_engine.MAX_STEPS)


class ServiceIntegrationTests(unittest.TestCase):
    """The generic service consumes holo-shaped handles end to end."""

    def setUp(self):
        holo_engine._client = FakeClient()

    def tearDown(self):
        holo_engine._client = None

    def test_service_runs_a_holo_style_task(self):
        from fastapi.testclient import TestClient

        from desktop_service import create_app

        token = "test-token"

        def starter(instruction: str, max_time_s: float) -> HoloSessionHandle:
            self.assertIn("Complete exactly this task", normalize_task(instruction))
            return HoloSessionHandle(instruction, max_time_s, turn_runner=make_runner(outcome()))

        client = TestClient(create_app(session_starter=starter, token=token))
        response = client.post(
            "/tasks",
            json={"taskId": "t1", "kylianSessionId": "s1", "instruction": "Open Finder.", "timeoutSeconds": 60},
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 202)
        deadline = time.monotonic() + 5
        record = {}
        while time.monotonic() < deadline:
            record = client.get("/tasks/t1", headers={"Authorization": f"Bearer {token}"}).json()
            if record["status"] in {"completed", "failed", "cancelled", "timed_out"}:
                break
            time.sleep(0.02)
        self.assertEqual(record["status"], "completed")
        self.assertEqual(record["hSessionId"], "holo-s-1")
        self.assertIn("1,200", record["answer"])
        self.assertIn("settled", record["timings"])
        events = client.get("/tasks/t1/events", headers={"Authorization": f"Bearer {token}"}).json()["events"]
        kinds = [event["kind"] for event in events]
        self.assertIn("agent_event:act_event", kinds)
        for event in events:
            self.assertEqual(sorted(event.keys()), ["at", "index", "kind"])


if __name__ == "__main__":
    unittest.main()
