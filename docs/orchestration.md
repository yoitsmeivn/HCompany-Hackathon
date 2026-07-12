# Kylian orchestration layer

Last researched: 2026-07-11. Only official provider documentation was used. The OpenAI developer-docs MCP server was installed during this work, but required a Codex restart before it could be called, so the official OpenAI web documentation was used for this implementation.

## Implemented request path

1. The React session UI creates its existing local session metadata and opens an `EventSource` to `GET /api/sessions/:sessionId/events`.
2. A user instruction is sent to `POST /api/sessions/:sessionId/messages`. The browser sends the selected computer ID and the already-configured allowed folder/application names; it never sends an API key.
3. `SessionOrchestrationService` serializes work per session and retains only the OpenAI `previous_response_id` needed for that process lifetime.
4. With `OPENAI_API_KEY`, `OpenAIOrchestrator` uses the official Node SDK and `client.responses.create`. Without it, the server uses `MockOrchestrator`, making local development deterministic.
5. The model may call one strict `computer_task` function. Arguments are parsed and validated again at runtime before reaching `ComputerTaskAdapter`.
6. The configured adapter is currently `MockComputerTaskAdapter`. It returns a typed task result; it does not control a real computer.
7. The backend publishes typed `RuntimeEventEnvelope` values over SSE. The frontend routes them through the existing `applyRuntimeEvent` adapter and Context/useReducer store.

The event hub keeps a bounded in-memory replay buffer so events emitted immediately after a POST are not lost while the SPA establishes its SSE subscription. No transcript or approval state was added to frontend localStorage.

## OpenAI decisions

- Use the Responses API, not Assistants and not Chat Completions. The official Node SDK identifies Responses as its primary API.
- The function tool uses the current Responses shape: `{ type: "function", name, description, parameters, strict }`. Tool results are returned as `function_call_output` items with the original `call_id`.
- Conversation continuity uses `previous_response_id`. The current implementation also sets `store: true`; production privacy/retention policy must be finalized before launch. An alternative is to manage input history directly.
- The tool loop is capped at six turns and every tool argument is server-validated. The model cannot select a different computer or widen allowed folders/applications through tool arguments.
- The default is `gpt-5.4-mini`, a broadly documented lower-latency model suitable for tool orchestration. Current model guidance lists newer GPT-5.6 variants, but GPT-5.6 is described as preview/limited availability on an official guidance page. `OPENAI_MODEL` makes selection explicit per deployment.
- Streaming is documented for Responses, but this first version streams application-level typed events over SSE rather than forwarding token deltas. This keeps UI state event-oriented and provider-neutral.

Official sources:

- [Models and model selection](https://developers.openai.com/api/docs/models)
- [Latest-model guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [Responses API guide](https://developers.openai.com/api/docs/guides/responses)
- [Function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state)
- [Streaming responses](https://developers.openai.com/api/docs/guides/streaming-responses)
- [Official OpenAI Node SDK](https://github.com/openai/openai-node)

## Computer execution and H Company

`ComputerTaskAdapter` owns `run`, `steer`, `pause`, and `stop`. The mock adapter implements that contract for local development. `HCompanyComputerTaskAdapter` intentionally throws until a transport is selected and tested.

Current H Company documentation describes:

- HoloDesktop CLI as an open-source local desktop harness that can expose MCP, ACP, and A2A integrations.
- Holo3.1 inference through H Models API or self-hosting; HoloDesktop can point at an OpenAI-compatible local server.
- Current model names include `holo3-1-35b-a3b` and `holo3-122b-a10b`; the latter has licensing/availability constraints documented by H Company.
- The H Models API is a model inference interface. It is not documented as a hosted durable task service with a stable start/pause/steer/stop event REST lifecycle. Kylian therefore does not invent one.

The production choice should be either a local-companion transport that invokes HoloDesktop, or a verified MCP/ACP/A2A client. That implementation must translate actual HoloDesktop task events into `RuntimeEvent` values.

Official sources:

- [HoloDesktop CLI announcement and interfaces](https://hcompany.ai/holodesktop-cli)
- [Holo Models API](https://hcompany.ai/holo-models-api)
- [H Models API overview](https://hub.hcompany.ai/about-the-models-api)
- [Holo3 quickstart and agent-loop distinction](https://hub.hcompany.ai/quickstart)

## Twilio and voice boundary

Gradium now provides STT/TTS when selected; OpenAI remains the Responses API orchestrator. See [Gradium voice transport](./gradium-voice.md) for exact wire schemas, MCP sources, VAD/flush behavior, and limitations.

Implemented:

- Official Twilio Node SDK dependency.
- A signature-validation middleware using `twilio.validateRequest` and the externally visible request URL.
- `POST /api/twilio/voice`, which returns TwiML containing `<Connect><Stream>` and a `wss` URL.
- A real, signature-validated WebSocket upgrade endpoint at `/twilio/media-stream`.
- Strict Zod schemas for inbound `connected`, `start`, `media`, `mark`, and `stop` messages. Unknown properties, invalid formats, mismatched stream IDs, binary frames, and invalid lifecycle transitions close the connection.
- Tracking for `callSid`, `streamSid`, session ID, selected computer ID, and lifecycle.
- Direct forwarding of Twilio PCMU audio to Gradium STT configured as `ulaw_8000`.
- Completed transcripts enter the existing Responses API orchestration service and existing typed runtime-event/SSE path.
- Agent text is synthesized through Gradium streaming TTS as `ulaw_8000`; base64 audio is forwarded unchanged to Twilio and followed by `mark`.
- Cleanup of transcription sessions and event subscriptions on Twilio `stop`, WebSocket close, or error.

Not implemented or not externally verified:

- Durable call records, production replay protection, or reconnection recovery.
- A real Twilio phone call has not been placed from this development environment.

Twilio specifies base64 `audio/x-mulaw` at 8 kHz for Media Streams. Bidirectional streams begin with `<Connect><Stream>`, receive only the inbound track, and accept only `media`, `mark`, and `clear` messages from the server. Stream URLs must use `wss`; query strings are unsupported, so custom parameters belong in nested `<Parameter>` values.

### Configuration

Required together to enable voice at startup:

```dotenv
KYLIAN_PUBLIC_BASE_URL=https://kylian.example.com
OPENAI_API_KEY=...
KYLIAN_VOICE_PROVIDER=gradium
GRADIUM_API_KEY=...
GRADIUM_TTS_VOICE=...
TWILIO_AUTH_TOKEN=...
TWILIO_MEDIA_STREAM_URL=wss://kylian.example.com/twilio/media-stream
KYLIAN_VOICE_COMPUTER_ID=computer-id-from-kylian
GRADIUM_STT_MODEL=default
GRADIUM_TTS_MODEL=default
GRADIUM_STT_LANGUAGE=en
```

The server refuses partial Twilio voice configuration. `TWILIO_MEDIA_STREAM_URL` must be public `wss`, end exactly in `/twilio/media-stream`, and have no query string. Configure Twilio Console’s incoming Voice webhook as `POST https://kylian.example.com/api/twilio/voice`.

Official sources:

- [Voice webhooks](https://www.twilio.com/docs/usage/webhooks/voice-webhooks)
- [TwiML Stream reference](https://www.twilio.com/docs/voice/twiml/stream)
- [Media Streams WebSocket messages](https://www.twilio.com/docs/voice/media-streams/websocket-messages)
- [Webhook security and signature validation](https://www.twilio.com/docs/usage/security)
- [Twilio Node helper library](https://www.twilio.com/docs/libraries/node)
- [OpenAI Realtime client events](https://platform.openai.com/docs/api-reference/realtime-client-events)
- [OpenAI Realtime transcription server events](https://platform.openai.com/docs/api-reference/realtime-server-events/conversation/item/input_audio_transcription/completed)
- [OpenAI TTS model](https://developers.openai.com/api/docs/models/tts-1)

## Other prepared boundaries

- `SpeechToTextPort` and `TextToSpeechPort`: provider-neutral speech boundaries; Gradium and explicit OpenAI fallback adapters implement the active voice interfaces.
- `MessagingChannelPort`: future NemoClaw/WhatsApp bridge.
- `LiveViewPort`: future LiveKit/WebRTC room/token service.
- `CompanionConnection` and companion task messages: future authenticated local WebSocket.

NemoClaw, WhatsApp, LiveKit, WebRTC, and local-companion integrations remain contracts only. Gradium protocol behavior is mock-tested, but live Gradium and real phone calls are not yet verified.

## Production follow-ups

- Add authentication/authorization and bind every session to an authenticated user and computer.
- Add durable session/event storage and an idempotency key for message POSTs.
- Decide OpenAI response retention (`store`) and data residency policy.
- Add rate limits, request IDs, structured logs, metrics, tracing, and graceful shutdown.
- Verify reverse-proxy URL reconstruction before enabling Twilio signature validation in production.
- Replace error text returned to users with stable public error codes; keep provider details in server logs.
- Implement approval enforcement server-side before file delivery. The current approval event is UI state, not a security boundary.
