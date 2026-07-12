"""Reusable H Company desktop-agent logic, extracted from the proven POC.

Owns everything that touches the hai-agents SDK: environment/credential
loading, the proven agent definition, session start, and the safe-projection
helpers that keep model output and screenshots out of the service's API.
``desktop_poc.py`` remains untouched as the original standalone proof.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Optional

POC_DIR = Path(__file__).resolve().parent
REPO_ROOT = POC_DIR.parent.parent

# The exact environment proven by the POC run (session 50c462bd…, answer 576).
AGENT: dict[str, Any] = {
    "name": "kylian-desktop",
    "description": "Kylian's local desktop executor for user-approved computer tasks.",
    "environments": [{"id": "ivans-mac", "kind": "desktop", "host": "user_device"}],
    "instructions": (
        "Perform only the requested task. Do not open, click, or type into "
        "any application the task does not require."
    ),
}

_ENV_KEYS = ("HAI_API_KEY", "KYLIAN_DESKTOP_SERVICE_TOKEN")

ERROR_MAX = 300


def load_env() -> None:
    """Load HAI_API_KEY and the service token from the repo root .env.

    Values already present in the process environment win. Nothing is ever
    printed or copied elsewhere; the key stays in this process only.
    """
    missing = [key for key in _ENV_KEYS if not os.environ.get(key)]
    env_file = REPO_ROOT / ".env"
    if missing and env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key in missing:
                value = value.strip().strip("'\"")
                if value:
                    os.environ[key] = value


def require_env() -> None:
    load_env()
    missing = [key for key in _ENV_KEYS if not os.environ.get(key)]
    if missing:
        raise SystemExit(f"Missing required environment variables: {', '.join(missing)}")


def start_desktop_session(instruction: str, max_time_s: float):
    """Start one local desktop session. The SDK serves one desktop session per
    process; the service's single-flight lock enforces the same rule at the
    API layer. Returns a SessionHandle."""
    from hai_agents import Client

    client = Client()
    return client.start_session(agent=AGENT, messages=instruction, max_time_s=max_time_s)


def safe_event_kind(event: Any) -> str:
    """Project an SDK session event to a lifecycle label that is safe to
    expose: the discriminant kind only. Message content, observations
    (screenshots), and any model reasoning never leave this function."""
    data = getattr(event, "data", None)
    kind = getattr(data, "kind", None)
    if isinstance(kind, str):
        return f"agent:{kind}"
    return type(event).__name__


def safe_answer(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    if isinstance(raw, str):
        return raw
    try:
        return json.dumps(raw, default=str)
    except (TypeError, ValueError):
        return str(raw)


def safe_error(error: Optional[str], error_code: Optional[str]) -> Optional[str]:
    """Stable error template + code only (per H docs) — never raw internals."""
    if not error and not error_code:
        return None
    text = error or "desktop session error"
    if len(text) > ERROR_MAX:
        text = f"{text[: ERROR_MAX - 1]}…"
    return f"{text} (code={error_code})" if error_code else text
