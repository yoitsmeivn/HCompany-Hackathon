"""Proof of concept: hai-agents[desktop] controls this Mac directly.

Runs one local desktop session (Calculator task) via H Company's
Computer-Use Agents SDK and prints the session id, status, and final
answer. Isolated from Kylian's Node/TS backend — nothing here is
imported by server/ or src/.

Safety properties:
- HAI_API_KEY is loaded from the repo root .env at runtime; it is never
  copied into this directory, printed, or passed on a command line.
- A lockfile (.session.lock) enforces one local desktop session at a
  time, on top of the SDK's own one-session-per-process rule.
- Ctrl+C cancels the running session before exiting.
- Out-of-band emergency stop: hai sessions cancel <session-id>
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

POC_DIR = Path(__file__).resolve().parent
REPO_ROOT = POC_DIR.parent.parent
LOCK_FILE = POC_DIR / ".session.lock"

TASK = (
    "Open Calculator, calculate 4800 multiplied by 0.12, return the "
    "displayed result, and do not interact with any other application."
)

AGENT = {
    "name": "kylian-desktop-poc",
    "description": "POC agent proving local Mac desktop control for Kylian.",
    "environments": [{"id": "ivans-mac", "kind": "desktop", "host": "user_device"}],
    "instructions": (
        "Only interact with the macOS Calculator app. Never open, click, "
        "or type into any other application."
    ),
}


def load_api_key() -> None:
    """Ensure HAI_API_KEY is in the process env, reading repo .env if needed."""
    if os.environ.get("HAI_API_KEY"):
        return
    env_file = REPO_ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("HAI_API_KEY=") and not line.startswith("#"):
                value = line.split("=", 1)[1].strip().strip("'\"")
                if value:
                    os.environ["HAI_API_KEY"] = value
                return
    sys.exit("HAI_API_KEY not found in environment or repo .env — aborting.")


def acquire_lock() -> None:
    try:
        fd = os.open(LOCK_FILE, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        sys.exit(
            f"Another local desktop session appears active ({LOCK_FILE} exists). "
            "Only one session is allowed at a time; remove the lockfile if stale."
        )
    with os.fdopen(fd, "w") as f:
        f.write(str(os.getpid()))


def release_lock() -> None:
    LOCK_FILE.unlink(missing_ok=True)


def describe_status(status: object) -> str:
    parts = []
    for field in ("status", "state", "num_steps", "step_count"):
        value = getattr(status, field, None)
        if value is not None:
            parts.append(f"{field}={value}")
    return ", ".join(parts) or repr(status)


def main() -> None:
    load_api_key()
    from hai_agents import Client  # imported after key check for a clear error order

    client = Client()
    acquire_lock()
    session = None
    try:
        session = client.start_session(agent=AGENT, messages=TASK)
        print(f"session id: {session.id}")
        print(f"emergency stop: hai sessions cancel {session.id}")
        print(f"initial status: {describe_status(session.status())}")
        print("--- events ---")
        for event in session.stream():
            print(f"  {getattr(event, 'type', type(event).__name__)}")
        result = session.wait_for_completion()
        print("--- result ---")
        print(f"session id:   {result.id}")
        print(f"status:       {result.status}")
        print(f"outcome:      {result.outcome}")
        print(f"final answer: {result.answer}")
        if result.error:
            print(f"error:        {result.error} (code={result.error_code})")
    except KeyboardInterrupt:
        if session is not None:
            print(f"\ncancelling session {session.id} ...")
            session.cancel()
            time.sleep(1)
            print(f"status after cancel: {describe_status(session.status())}")
        sys.exit(130)
    finally:
        release_lock()


if __name__ == "__main__":
    main()
