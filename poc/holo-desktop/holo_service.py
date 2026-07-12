"""Kylian desktop service, HoloDesktop engine.

Same authenticated HTTP contract as the hai-agents service (poc/hai-desktop),
same generic app factory — only the session engine differs. Runs as the third
local process on its own port so the hai service on 8790 stays available as a
fallback:

    poc/holo-desktop/.venv/bin/python -m uvicorn holo_service:app \
        --app-dir poc/holo-desktop --host 127.0.0.1 --port 8792
"""

from __future__ import annotations

import atexit
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "hai-desktop"))

import desktop_agent  # noqa: E402 — shared env loader (HAI_API_KEY, service token)
import holo_engine  # noqa: E402
from desktop_service import create_app  # noqa: E402

desktop_agent.load_env()
app = create_app(session_starter=holo_engine.start_desktop_session)
# Release the embedded client and stop a runtime we spawned when the service
# process exits (FastAPI 0.139 dropped add_event_handler; atexit covers
# uvicorn's graceful shutdown path too).
atexit.register(holo_engine.shutdown)
