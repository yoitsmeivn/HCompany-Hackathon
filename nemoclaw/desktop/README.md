# NemoClaw / HoloDesktop computer-use sandbox

This directory provisions an **NVIDIA NemoClaw** sandbox that runs the **H Company
computer-use agent (Holo, `holo3-1-35b-a3b`)** on an **isolated virtual desktop**,
instead of on the user's real machine. It is **sandbox configuration, not application
runtime code** — nothing here is imported by `server/`.

Unlike the WhatsApp sandbox (`../`), there is **no OpenClaw relay agent** here: the
"agent" is the Holo desktop service itself. The sandbox runs
[`poc/holo-desktop/holo_service.py`](../../poc/holo-desktop/holo_service.py) as a
supervised process on a virtual display; Holo (via `holo_desktop.agent_client`) reads
screenshots and drives the sandboxed apps. Kylian submits tasks to it over the same
authenticated `/tasks` HTTP contract the local `holo-desktop` executor already uses —
only the endpoint moves from `127.0.0.1` to the sandbox.

```
Kylian backend  (executor: nemoclaw-desktop)
   → HTTPS POST ${KYLIAN_NEMOCLAW_DESKTOP_URL}/tasks   (Authorization: Bearer <token>)
   → NemoClaw sandbox "kylian-desktop"
        ├ virtual desktop (Xvfb + window manager)
        └ holo_service.py  →  Holo (holo3-1-35b-a3b via H API)  →  drives sandboxed apps
   ← GET /tasks/:id, /tasks/:id/events, POST /tasks/:id/cancel  (status + safe lifecycle events)
```

The service **never returns screenshots or model reasoning** — only status and safe
lifecycle event kinds — so everything Kylian sees is safe to surface.

> The exact NemoClaw/OpenClaw CLI, channel, and policy keys differ across releases.
> Treat the files here as the intended configuration and validate them against your
> installed version (`nemoclaw --version`, `openclaw --help`, `openclaw policy schema`)
> before relying on them. Version-specific keys are called out inline.

## Files

| File | Purpose |
|---|---|
| `.env.example` | Sandbox-side settings (H API key/model, service token/port, Kylian host). |
| `policies/desktop.yaml` | OpenShell network policy: ingress only from Kylian; egress only to the H Models API. |
| `service/holo_desktop_service.yaml` | Supervised-process + virtual-desktop manifest for `holo_service.py`. |

## Prerequisites

- A host that meets NemoClaw's requirements with `nemoclaw`/`openclaw` on `PATH`, and
  a sandbox image that includes `holo_desktop`, `hai-agent-runtime`, Python, and an X
  virtual display (Xvfb) + a minimal window manager.
- The Kylian backend able to reach the sandbox's published service endpoint over HTTPS
  (this is the URL you put in the backend's `KYLIAN_NEMOCLAW_DESKTOP_URL`).
- A shared secret that matches the backend's `KYLIAN_DESKTOP_SERVICE_TOKEN`.
- An H Company API key (`HAI_API_KEY`) for Holo inference.

## Runbook

```bash
# 0) From this directory, copy and fill the sandbox env.
cp .env.example .env   # set HAI_API_KEY, KYLIAN_DESKTOP_SERVICE_TOKEN, KYLIAN_BACKEND_HOST

# 1) Create the sandbox.
nemoclaw onboard                       # creates sandbox, e.g. "kylian-desktop"

# 2) Bring up a virtual desktop channel (isolated display the agent operates).
nemoclaw kylian-desktop channels add desktop     # version-specific: the virtual-desktop/VNC channel

# 3) Register secrets as OpenShell providers so they are NOT baked into the image.
nemoclaw kylian-desktop secret set HAI_API_KEY "$HAI_API_KEY"
nemoclaw kylian-desktop secret set KYLIAN_DESKTOP_SERVICE_TOKEN "$KYLIAN_DESKTOP_SERVICE_TOKEN"

# 4) Apply the network policy (edit KYLIAN_BACKEND_HOST + the H API host first).
nemoclaw kylian-desktop policy-add ./policies/desktop.yaml

# 5) Install the supervised holo-desktop service (runs holo_service.py on the
#    virtual display and publishes its port, TLS-terminated, to the backend).
nemoclaw kylian-desktop service add ./service/holo_desktop_service.yaml

# 6) Start the sandbox and note the published HTTPS endpoint.
nemoclaw kylian-desktop up
nemoclaw kylian-desktop endpoints        # → https://<sandbox-host>/  (use as KYLIAN_NEMOCLAW_DESKTOP_URL)

# 7) Point the Kylian backend at the sandbox and switch executors:
#    KYLIAN_EXECUTOR_MODE=nemoclaw-desktop
#    KYLIAN_NEMOCLAW_DESKTOP_URL=https://<sandbox-host>
#    KYLIAN_DESKTOP_SERVICE_TOKEN=<same token as step 3>

# 8) Watch it work.
nemoclaw kylian-desktop logs --follow
```

Trigger a task through any Kylian channel (web, voice, or the WhatsApp ingress); you
should see `POST /tasks` arrive in the sandbox logs and Holo operate the **sandboxed**
desktop while your real machine stays untouched.

## Model note

Inference uses an **H Company** model (`holo3-1-35b-a3b`) via its OpenAI-compatible API,
satisfying the NVIDIA side challenge: the computer-use brain (Holo) runs inside the
NemoClaw sandbox while Kylian's one canonical orchestrator stays on the backend. Swap to
`holo3-122b-a10b` for the final demo if it is more reliable for your task.

## Security

- **Ingress** is restricted by `policies/desktop.yaml` to the Kylian backend host only,
  and the service additionally requires a bearer token (`KYLIAN_DESKTOP_SERVICE_TOKEN`)
  over TLS. The backend enforces `https://` for any non-loopback sandbox URL.
- **Egress** is default-deny except the H Models API (inference). Give the sandboxed
  browser broader egress only if a specific task requires it, and prefer a per-task
  allowlist over a wildcard.
- Secrets are OpenShell providers injected via `openshell:resolve:env:*` — never
  hardcode `HAI_API_KEY` or the service token in the manifests.
- The token never appears in Kylian's task results, event labels, or errors (enforced by
  `server/computer/haiDesktopAdapter.ts`).
