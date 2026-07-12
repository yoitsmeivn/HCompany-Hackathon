# NemoClaw / OpenClaw WhatsApp sandbox

This directory provisions the **NVIDIA NemoClaw** sandbox that gives Kylian a
WhatsApp channel. It is **sandbox configuration, not application runtime code** —
nothing here is imported by `server/`. The sandbox runs an OpenClaw agent whose
*only* job is to forward each inbound WhatsApp message to Kylian's existing
ingress and relay the reply:

```
WhatsApp user
   → OpenClaw WhatsApp channel   (inside the NemoClaw sandbox)
   → kylian_handle_message tool  (tools/kylian_handle_message.yaml)
   → POST ${KYLIAN_BASE_URL}/api/channels/nemoclaw/messages   (Authorization: Bearer <token>)
   → Kylian backend → OpenAI orchestrator → H Company desktop task
   → reply text → relayed back to WhatsApp
```

The agent **must not** plan tasks, make approval decisions, or hold session
state — Kylian's backend owns all of that. The agent is a thin relay
(`agent.md`).

> The exact OpenClaw manifest/keys differ across NemoClaw releases. Treat the
> files here as the intended configuration and validate them against your
> installed version (`nemoclaw --version`, `openclaw --help`) before relying on
> them. Where a key name is version-specific it is called out inline.

## Files

| File | Purpose |
|---|---|
| `agent.md` | The narrow ingress-adapter system prompt for the OpenClaw agent. |
| `tools/kylian_handle_message.yaml` | The single HTTP tool the agent may call. |
| `policies/whatsapp.yaml` | OpenShell network policy: allow egress only to the Kylian host. |
| `.env.example` | Sandbox-side settings (`KYLIAN_BASE_URL`, token, allowlist). |

## Prerequisites

- A host that meets NemoClaw's requirements (see NVIDIA docs) with `nemoclaw`
  and `openclaw` on `PATH`.
- The Kylian backend reachable from the sandbox over HTTPS at `KYLIAN_BASE_URL`
  (e.g. your Cloudflare tunnel host, same one used for Twilio).
- A shared secret that matches the backend's `NEMOCLAW_INGRESS_TOKEN`.

## Runbook

```bash
# 0) From this directory, copy and fill the sandbox env.
cp .env.example .env      # set KYLIAN_BASE_URL, NEMOCLAW_INGRESS_TOKEN, WHATSAPP_ALLOWED_IDS

# 1) Create the sandbox and pick the inference provider during onboarding.
#    Use an H Company (Holo) OpenAI-compatible endpoint + model holo3-1-35b-a3b
#    (H API is OpenAI-compatible, so select the OpenAI-compatible provider and
#     point base_url at the H Models API). See the model note below.
nemoclaw onboard          # creates sandbox, e.g. "kylian"

# 2) Add the WhatsApp channel (pulls in the matching network-policy preset).
nemoclaw kylian channels add whatsapp

# 3) Register the ingress token as an OpenShell provider so it is NOT baked into
#    the image, then let the tool resolve it via openshell:resolve:env:*.
nemoclaw kylian secret set NEMOCLAW_INGRESS_TOKEN "$NEMOCLAW_INGRESS_TOKEN"

# 4) Apply the custom egress policy allowing the Kylian host (edit the host in
#    policies/whatsapp.yaml first). This is additive to the whatsapp preset.
nemoclaw kylian policy-add ./policies/whatsapp.yaml

# 5) Install the agent prompt + the single tool into the sandbox.
nemoclaw kylian agent set --file ./agent.md
nemoclaw kylian tools add ./tools/kylian_handle_message.yaml

# 6) Pair WhatsApp (scan the QR with the phone that owns the number).
openclaw channels login --channel whatsapp
nemoclaw kylian channels start whatsapp

# 7) Watch it work.
nemoclaw kylian logs --follow
```

Send a WhatsApp message from an allowlisted number; you should see the tool call
in the logs and a `200` from `/api/channels/nemoclaw/messages`, then the reply
arrive back in WhatsApp.

## Model note

The design target is an **H Company** model in the sandbox
(`holo3-1-35b-a3b`) via its OpenAI-compatible API, satisfying the NVIDIA side
challenge with one canonical brain still on the Kylian backend. Any
OpenAI-compatible provider works for the *relay* agent since it only needs to
call one tool; keep the model small — this agent does not reason about tasks.

## Security

- `WHATSAPP_ALLOWED_IDS` gates senders **in the sandbox**; the Kylian backend
  **also** enforces the same allowlist (defense in depth). Keep both in sync.
- The ingress token is stored as an OpenShell provider and injected via
  `openshell:resolve:env:NEMOCLAW_INGRESS_TOKEN` — never hardcode it in the
  tool manifest or agent prompt.
- The network policy restricts the sandbox to the Kylian host only; the agent
  cannot reach arbitrary endpoints.
