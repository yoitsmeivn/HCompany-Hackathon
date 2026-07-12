# Kylian

A secure remote computer assistant — call or message Kylian to find files, operate applications, and access the computer you left behind.

Vite/React frontend with a Node/Express orchestration server. The backend uses the OpenAI Responses API when configured and otherwise runs a deterministic local mock adapter.

## Getting started

```bash
npm install
cp .env.example .env
npm run dev       # frontend :5173 and API :8787
```

Other scripts:

```bash
npm run build     # typecheck (tsc -b) + production build to dist/
npm run preview   # serve the production build locally
npm run lint      # eslint
npm run test:server
```

## Routes

| Path | Page |
| --- | --- |
| `/` | Landing |
| `/setup` | Connect a computer (access setup) — `/demo` redirects here |
| `/dashboard` | Recent sessions |
| `/computers` | Connected computers and their access |
| `/files` | Files Kylian has touched during sessions |
| `/session/:sessionId` | Live session view — `/session` redirects to the demo session |

## Project structure

```
src/
  app/          router, App shell, usePageTitle
  layouts/      MarketingLayout, DashboardLayout
  pages/        one file per route
  features/     access, devices, sessions, files, live-session (components + types)
  components/   ui/ primitives, navigation/, brand/, marketing/ sections
  data/         mock data (computers, sessions, files)
  services/     typed Promise-returning mock API boundary (swap for fetch later)
  styles/       tokens.css, globals.css, components.css, responsive.css
```

## Access model

Each computer has an access policy (`src/features/access/types.ts`):

- **Full access** — Kylian can access files and applications during an active session.
- **Selected access** — you choose the allowed folders and applications.
- **Ask every time** (default, recommended) — Kylian asks before opening each new folder or application.

Secondary controls: voice, live view, and ask-before-sending-files.

## Deploying

This is a client-side routed SPA: **production hosting must rewrite unknown routes to `index.html`** (e.g. a catch-all rewrite on Vercel/Netlify, `try_files $uri /index.html` on nginx) so direct links and refreshes work.

## Twilio bidirectional voice

The public deployment must serve HTTPS and WebSocket upgrades on the same externally reachable host. Add these values to `.env`:

```dotenv
KYLIAN_PUBLIC_BASE_URL=https://YOUR_TUNNEL_HOST
KYLIAN_VOICE_COMPUTER_ID=demo-computer
KYLIAN_EXECUTOR_MODE=mock
KYLIAN_VOICE_PROVIDER=gradium

OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini

GRADIUM_API_KEY=...
GRADIUM_TTS_VOICE=...
GRADIUM_STT_MODEL=default
GRADIUM_TTS_MODEL=default
GRADIUM_STT_LANGUAGE=en
GRADIUM_STT_DELAY_IN_FRAMES=16
GRADIUM_VAD_HORIZON_SECONDS=2
GRADIUM_VAD_INACTIVITY_THRESHOLD=0.5

TWILIO_AUTH_TOKEN=...
TWILIO_ACCOUNT_SID=...
TWILIO_PHONE_NUMBER=+1...
TWILIO_VALIDATE_SIGNATURES=true
TWILIO_MEDIA_STREAM_URL=wss://YOUR_TUNNEL_HOST/twilio/media-stream
```

In Twilio Console, configure the phone number’s **A call comes in** Voice webhook as:

```text
POST https://YOUR_TUNNEL_HOST/api/twilio/voice
```

The returned TwiML uses `<Connect><Stream>` with exactly:

```text
wss://YOUR_TUNNEL_HOST/twilio/media-stream
```

Use the same public hostname in both variables. Do not use a query string on the stream URL. Localhost is not reachable by Twilio.

Nothing is deployed by this repository. For local development, one Cloudflare tunnel forwards public HTTPS and WSS traffic to `http://localhost:8787`.

Two-terminal workflow:

```bash
# Terminal 1
npm run dev

# Terminal 2
cloudflared tunnel --url http://localhost:8787
```

Or use three terminals:

```bash
npm run dev:web
npm run start:api
cloudflared tunnel --url http://localhost:8787
```

After Cloudflare prints the public hostname, update `KYLIAN_PUBLIC_BASE_URL` and `TWILIO_MEDIA_STREAM_URL`, restart the backend, and configure the Twilio webhook shown above.

### Outbound test call from `/setup`

The current local demo arrangement is:

```text
Frontend:        http://localhost:5173
Backend:         http://localhost:8787
Public base:     https://democrats-fourth-issn-declare.trycloudflare.com
Voice webhook:   https://democrats-fourth-issn-declare.trycloudflare.com/api/twilio/voice
Media WebSocket: wss://democrats-fourth-issn-declare.trycloudflare.com/twilio/media-stream
```

The temporary hostname is documentation only and is not hardcoded in application source. A Cloudflare quick-tunnel hostname changes whenever the tunnel restarts. For this specific tunnel, set:

```dotenv
KYLIAN_PUBLIC_BASE_URL=https://democrats-fourth-issn-declare.trycloudflare.com
TWILIO_MEDIA_STREAM_URL=wss://democrats-fourth-issn-declare.trycloudflare.com/twilio/media-stream
VITE_KYLIAN_API_BASE_URL=http://localhost:8787
```

Then restart the backend:

1. Open `http://localhost:5173/setup`.
2. Enter a Twilio-verified destination in international format and a generic computer name.
3. Save the computer setup. This keeps the mock computer `configured`; it does not mark a companion connected.
4. Click **Start test call**. No paid call is made when saving the form.
5. The UI reports **Call queued** only after Twilio accepts the request.
6. Answer the phone and verify caller audio reaches Gradium STT, OpenAI produces a response, and Gradium TTS audio returns through Twilio.

Trial Twilio accounts can call only recipients verified in the Twilio Console. The real-call test is manual and consumes Twilio, Gradium, and OpenAI credits.

An optional Gradium-only connectivity check consumes credits, does not call Twilio, and never runs automatically:

```bash
npm run test:gradium:manual
```

See [docs/gradium-voice.md](docs/gradium-voice.md) for official sources, protocol details, turn-taking, and current limitations.
