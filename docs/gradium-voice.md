# Gradium voice transport

Last reviewed: 2026-07-11.

## Official documentation consulted

The connected `gradiumDocs` MCP server was used for semantic search and full-page retrieval. The official [`llms.txt`](https://docs.gradium.ai/llms.txt) index was also read directly.

- [STT WebSocket reference](https://docs.gradium.ai/api-reference/endpoint/stt-websocket)
- [TTS WebSocket reference](https://docs.gradium.ai/api-reference/endpoint/tts-websocket)
- [WebSocket lifecycle and authentication](https://docs.gradium.ai/guides/websocket-lifecycle)
- [Telephony audio formats](https://docs.gradium.ai/guides/recipes/telephony-audio)
- [Semantic VAD turn-taking](https://docs.gradium.ai/guides/recipes/turn-taking)
- [Speech-to-text streaming](https://docs.gradium.ai/guides/speech-to-text)
- [Transcription settings](https://docs.gradium.ai/guides/transcription-settings)
- [WebSocket errors and retry behavior](https://docs.gradium.ai/guides/errors)

Gradium WebSocket `error` messages are terminal. Kylian closes the affected call transport; it does not silently reconnect mid-turn or switch providers. A later call creates fresh connections.

## Implemented flow

```text
Twilio media.payload (base64 PCMU/8 kHz)
  -> Gradium STT {type:"audio", audio: payload}
  -> text + end_text segments
  -> semantic VAD (2 s horizon, >0.5, 3 consecutive steps)
  -> incrementing flush request
  -> matching flushed acknowledgement
  -> one finalized caller turn
  -> existing OpenAI Responses orchestrator
  -> assistant text
  -> Gradium streaming TTS (ulaw_8000)
  -> unchanged base64 Gradium audio chunks
  -> Twilio media frames
  -> Twilio mark after Gradium end_of_stream
```

No PCM conversion or resampling occurs in Gradium mode. Twilio and Gradium both use base64-encoded μ-law at 8 kHz. API keys stay server-only in WebSocket `x-api-key` headers.

## Turn taking and flush

`text` is partial segment content. `end_text` finalizes a segment by `stream_id`, but does not invoke the orchestrator. Kylian requires three consecutive VAD readings above the configured inactivity threshold at the configured horizon, then sends one pending `flush_id`. Only the matching `flushed` message dispatches the caller turn. Duplicate `flushed` or VAD messages cannot dispatch a turn twice.

Defaults:

- `GRADIUM_STT_DELAY_IN_FRAMES=16`
- `GRADIUM_VAD_HORIZON_SECONDS=2`
- `GRADIUM_VAD_INACTIVITY_THRESHOLD=0.5`
- `GRADIUM_VAD_CONSECUTIVE_STEPS=3`

The horizon and threshold are Gradium's recommended starting point. Three consecutive steps follows its noisy-telephony guidance.

## Barge-in

The documented STT schema has no separately named speech-start message. Kylian derives a conservative activity signal when the selected semantic-VAD prediction moves below the inactivity threshold. If TTS is active, Kylian aborts that TTS socket, sends Twilio `clear`, clears pending marks, and ignores later chunks from the cancelled generation.

This is heuristic barge-in, not a provider-guaranteed speech-start detector. It requires tuning with real calls and noisy lines.

## Provider selection

- `KYLIAN_VOICE_PROVIDER=gradium` requires `GRADIUM_API_KEY` and `GRADIUM_TTS_VOICE`; startup fails if either is absent.
- `KYLIAN_VOICE_PROVIDER=openai` retains the former OpenAI speech adapters as an explicit fallback.
- If omitted, Gradium is selected only when both required Gradium values exist; otherwise OpenAI is selected.
- No provider fallback occurs during a live call.

OpenAI remains the top-level Responses API orchestrator in both modes.

## Computer selection

`KYLIAN_VOICE_COMPUTER_ID` is an internal Kylian ID. Mock executor mode registers `demo-computer`:

```dotenv
KYLIAN_EXECUTOR_MODE=mock
KYLIAN_VOICE_COMPUTER_ID=demo-computer
```

The backend verifies the computer before a finalized phone transcript enters orchestration. A missing record fails the voice call; Gradium never creates or modifies computer IDs.

## Manual connectivity check

This explicit command consumes Gradium TTS credits and never runs automatically:

```bash
npm run test:gradium:manual
```

It reports only chunk and byte counts. It prints no API key, text, call ID, or transcript, and does not call Twilio.
