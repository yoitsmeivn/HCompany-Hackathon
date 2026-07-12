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

from schemas import TaskFrame

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
# Optional keys pulled from .env when present, but never required — the desktop
# services are started manually with their own env, so opting into live view via
# the repo .env is the least surprising place for it.
_OPTIONAL_ENV_KEYS = ("KYLIAN_LIVE_VIEW",)

ERROR_MAX = 300


def load_env() -> None:
    """Load HAI_API_KEY, the service token, and any optional keys from the repo
    root .env.

    Values already present in the process environment win. Nothing is ever
    printed or copied elsewhere; the key stays in this process only.
    """
    wanted = [key for key in (*_ENV_KEYS, *_OPTIONAL_ENV_KEYS) if not os.environ.get(key)]
    env_file = REPO_ROOT / ".env"
    if wanted and env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key in wanted:
                value = value.strip().strip("'\"")
                if value:
                    os.environ[key] = value


def live_view_enabled() -> bool:
    """Whether the operator opted into exposing desktop screenshots. Default off:
    when this is false the service never extracts or emits a single frame, so the
    event contract and behavior are byte-for-byte unchanged."""
    return os.environ.get("KYLIAN_LIVE_VIEW") == "1"


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


# --- opt-in screenshot extraction (KYLIAN_LIVE_VIEW=1) ----------------------
#
# The exact runtime/SDK event shape that carries the base64 screenshot is not
# pinned in this repo (the SDKs are not vendored and no recorded run exists), so
# extraction is deliberately shape-agnostic: it scans the common H observation
# shapes, returns None on anything unrecognized, and never raises. The first
# unrecognized event per process is logged once (structure only, no data) so the
# real field can be identified during bring-up.

_MEDIA_TYPE_KEYS = ("media_type", "mediaType", "mime_type", "mimeType", "content_type", "contentType")
_B64_KEYS = ("source", "data", "b64_json", "base64", "image_base64", "bytes")
_IMAGE_KEY_HINTS = ("screenshot", "image", "images", "img", "observation", "content", "source", "frame")
_MAX_DEPTH = 6

_unrecognized_frame_logged = False


def _as_mapping(node: Any) -> Optional[dict]:
    """View a dict (holo events) or an object (hai SDK events) as a mapping."""
    if isinstance(node, dict):
        return node
    attrs = getattr(node, "__dict__", None)
    return attrs if isinstance(attrs, dict) and attrs else None


def _frame_from_data_url(value: str) -> Optional[TaskFrame]:
    if not value.startswith("data:") or ";base64," not in value:
        return None
    header, b64 = value.split(",", 1)
    media = header[len("data:") :].split(";", 1)[0] or "image/jpeg"
    if not media.startswith("image/") or not b64:
        return None
    return TaskFrame(mediaType=media, dataBase64=b64)


def _image_from_node(mapping: dict) -> Optional[TaskFrame]:
    """Recognize an explicit image node: {type:"base64", media_type, source}."""
    media = next((mapping.get(k) for k in _MEDIA_TYPE_KEYS if isinstance(mapping.get(k), str)), None)
    is_image = mapping.get("type") == "base64" or (isinstance(media, str) and media.startswith("image/"))
    if not is_image:
        return None
    for key in _B64_KEYS:
        b64 = mapping.get(key)
        if isinstance(b64, str) and b64:
            return TaskFrame(mediaType=media if isinstance(media, str) and media.startswith("image/") else "image/jpeg", dataBase64=b64)
    return None


def _search_frame(node: Any, depth: int = 0) -> Optional[TaskFrame]:
    if node is None or depth > _MAX_DEPTH:
        return None
    if isinstance(node, str):
        return _frame_from_data_url(node)
    mapping = _as_mapping(node)
    if mapping is not None:
        direct = _image_from_node(mapping)
        if direct is not None:
            return direct
        # image-hinted keys first, then any remaining values.
        for key in _IMAGE_KEY_HINTS:
            if key in mapping:
                found = _search_frame(mapping[key], depth + 1)
                if found is not None:
                    return found
        for key, value in mapping.items():
            if key in _IMAGE_KEY_HINTS:
                continue
            found = _search_frame(value, depth + 1)
            if found is not None:
                return found
        return None
    if isinstance(node, (list, tuple)):
        for item in node:
            found = _search_frame(item, depth + 1)
            if found is not None:
                return found
    return None


def _describe_shape(node: Any, depth: int = 0) -> Any:
    """Structure-only summary (key names + value type names) — never data."""
    if depth > 2:
        return "…"
    mapping = _as_mapping(node)
    if mapping is not None:
        return {key: type(value).__name__ for key, value in mapping.items()}
    if isinstance(node, (list, tuple)):
        return [f"list[{len(node)}]"]
    return type(node).__name__


def extract_frame(event: Any) -> Optional[TaskFrame]:
    """Best-effort pull of a base64 desktop screenshot from a runtime event.

    Returns None (never raises) when no screenshot is found, so the monitor
    degrades gracefully to text/activity. Logs the first unrecognized event's
    structure once per process to aid bring-up.
    """
    global _unrecognized_frame_logged
    try:
        frame = _search_frame(getattr(event, "data", None)) or _search_frame(getattr(event, "content", None))
    except Exception:
        return None
    if frame is not None:
        return frame
    if not _unrecognized_frame_logged:
        _unrecognized_frame_logged = True
        try:
            print(
                f"extract_frame: unrecognized event shape (no screenshot found); data={_describe_shape(getattr(event, 'data', None))}",
                flush=True,
            )
        except Exception:
            pass
    return None


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
