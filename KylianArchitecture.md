# **Kylian Architecture Report**

## **1\. What Kylian is**

Kylian is a remote personal-computer assistant. A user can call, message, or use the web app to ask Kylian to find a file or perform a task on their computer.

Example:

“Find the latest presentation that contains the pricing slide.”

Kylian then:

1. Understands the request.  
2. Decides what kind of computer task is needed.  
3. Sends a bounded task to the H Company computer-use agent.  
4. Watches the agent operate the user’s computer.  
5. Reports progress back through voice, WhatsApp, and the web interface.  
6. Requests approval before sending or exposing any file.  
7. Delivers the approved result.

The system uses a **hybrid agent architecture**:

* **OpenAI** is the high-level brain.  
* **H Company** is the computer operator.  
* **NemoClaw/OpenClaw** provides the sandboxed WhatsApp channel and NVIDIA integration.  
* **Gradium** provides speech-to-text and text-to-speech.  
* **Twilio** carries the telephone call.  
* **WebRTC/LiveKit** carries the live screen feed.

---

# **2\. The central design decision**

Kylian should have **one main orchestrator** and **one specialized computer-use executor**.

OpenAI orchestrator  
decides WHAT to do

H Company computer agent  
decides HOW to do it on the screen

This prevents two autonomous agents from competing over control.

The OpenAI model should not receive mouse coordinates or decide every click. It should send H Company a clear objective such as:

Search Documents and Downloads for the newest presentation containing “pricing.” Open likely candidates, but do not upload, email, or send any file.

H Company then performs the screenshot-to-action loop: observe the screen, click, type, scroll, inspect the result, and repeat. Holo is specifically designed to operate real interfaces through screenshots and structured tool calls.

---

# **3\. High-level architecture**

                       ┌───────────────────────┐  
                        │      User channels    │  
                        │                       │  
                        │ Phone / WhatsApp / Web│  
                        └───────────┬───────────┘  
                                    │  
              ┌─────────────────────┼──────────────────────┐  
              │                     │                      │  
         Twilio Voice        NemoClaw/OpenClaw        Web application  
              │                WhatsApp channel        chat \+ controls  
              │                     │                      │  
              └─────────────────────┴──────────────────────┘  
                                    │  
                                    ▼  
                        ┌───────────────────────┐  
                        │   Kylian backend      │  
                        │                       │  
                        │ Session state         │  
                        │ Authentication        │  
                        │ Event routing         │  
                        │ Approval enforcement  │  
                        └───────────┬───────────┘  
                                    │  
                                    ▼  
                        ┌───────────────────────┐  
                        │ OpenAI orchestrator   │  
                        │                       │  
                        │ Understand request    │  
                        │ Ask clarifications    │  
                        │ Select tools          │  
                        │ Manage conversation   │  
                        └───────────┬───────────┘  
                                    │  
                              start\_computer\_task  
                                    │  
                                    ▼  
                        ┌───────────────────────┐  
                        │ Desktop companion     │  
                        │ running on the Mac    │  
                        └───────────┬───────────┘  
                                    │  
                                    ▼  
                        ┌───────────────────────┐  
                        │ H Company Holo agent  │  
                        │                       │  
                        │ Screenshot → action   │  
                        │ Click / type / scroll │  
                        │ Inspect applications  │  
                        └───────────┬───────────┘  
                                    │  
                   ┌────────────────┼────────────────┐  
                   │                │                │  
                Finder          Preview          PowerPoint  
                   │                │                │  
                   └────────────────┴────────────────┘

Desktop screen ───────────── WebRTC / LiveKit ───────────── Phone browser  
---

# **4\. OpenAI orchestrator**

## **Responsibility**

The OpenAI orchestrator is Kylian’s primary reasoning layer.

It handles:

* interpreting phone, WhatsApp, and web messages;  
* determining what the user is asking for;  
* deciding whether clarification is needed;  
* selecting the correct computer;  
* deciding which backend tool to call;  
* creating a focused H Company task;  
* maintaining conversation context;  
* reacting to H Company results;  
* requesting user approval;  
* deciding whether the task is complete;  
* generating text that Gradium converts into speech.

OpenAI’s Responses API supports function calling, which lets the model request typed backend operations rather than directly performing arbitrary actions.

## **Recommended model**

Use:

gpt-5.6-terra

with low reasoning for most turns.

OpenAI currently positions Terra as the balance between intelligence and cost, and it supports function tools through the Responses API. Luna is the cheaper fallback for high-volume, straightforward routing.

Recommended configuration:

const ORCHESTRATOR\_MODEL \= "gpt-5.6-terra";  
const REASONING\_EFFORT \= "low";

Use medium reasoning only for ambiguous tasks such as:

“Find the document I used at that investor meeting last month.”

## **Orchestrator tools**

The OpenAI model should be given a small tool set:

const tools \= \[  
  "get\_active\_computer",  
  "create\_session",  
  "start\_computer\_task",  
  "steer\_computer\_task",  
  "pause\_computer\_task",  
  "stop\_computer\_task",  
  "get\_computer\_task\_status",  
  "request\_user\_approval",  
  "publish\_session\_event",  
  "create\_live\_view",  
  "deliver\_approved\_file"  
\];

The tools are implemented by your backend.

The model does not directly:

* click;  
* type;  
* inspect raw filesystem directories;  
* send files;  
* access credentials;  
* control WebRTC.

---

# **5\. H Company computer-use agent**

## **Responsibility**

H Company is the specialized desktop executor.

It handles:

* reading screenshots;  
* understanding Finder, Preview, PowerPoint, browsers, and dialogs;  
* deciding where to click;  
* typing and scrolling;  
* opening candidate files;  
* visually checking document contents;  
* navigating inconsistent graphical interfaces;  
* recovering when an expected screen does not appear;  
* returning progress and results.

H Company exposes Holo through an OpenAI-compatible Models API. The current model options include the faster `holo3-1-35b-a3b` and the higher-performance `holo3-122b-a10b`.

## **Recommended model**

Start development with:

holo3-1-35b-a3b

Reasons:

* faster iteration;  
* free-tier access;  
* native function calling;  
* appropriate for the hackathon;  
* easier to run repeatedly while debugging.

Test the final workflow with:

holo3-122b-a10b

Use whichever model is more reliable for your exact demo.

## **Holo agent loop**

The local desktop companion repeatedly performs:

1\. Capture screenshot  
2\. Send screenshot \+ task state to Holo  
3\. Receive one structured action  
4\. Execute the action  
5\. Capture the resulting screen  
6\. Return the observation to Holo  
7\. Repeat until done or blocked

H recommends retaining only the latest few screenshots and using a structured tool union for actions. Holo3.1 supports native OpenAI-style tool calls.

Example low-level H tools:

type ComputerAction \=  
  | { type: "click"; x: number; y: number; description: string }  
  | { type: "type"; text: string; pressEnter: boolean }  
  | { type: "scroll"; direction: "up" | "down"; amount: number }  
  | { type: "key"; key: string }  
  | { type: "wait"; milliseconds: number }  
  | { type: "complete"; result: ComputerTaskResult }  
  | { type: "blocked"; reason: string };  
---

# **6\. The boundary between OpenAI and H Company**

This boundary is the most important part of the architecture.

## **OpenAI sends an objective**

{  
  "sessionId": "session\_123",  
  "objective": "Find the newest presentation containing the phrase 'pricing strategy'.",  
  "allowedLocations": \[  
    "Documents",  
    "Downloads"  
  \],  
  "allowedActions": \[  
    "search",  
    "open",  
    "inspect"  
  \],  
  "forbiddenActions": \[  
    "send",  
    "upload",  
    "delete",  
    "edit"  
  \],  
  "stopConditions": \[  
    "matching candidates found",  
    "user permission required",  
    "task blocked",  
    "task completed"  
  \]  
}

## **H Company returns a result**

{  
  "taskId": "computer\_task\_456",  
  "status": "needs\_user\_choice",  
  "summary": "Two likely files were found.",  
  "candidates": \[  
    {  
      "id": "candidate\_1",  
      "name": "Presentation-July.pptx",  
      "location": "Documents/Presentations",  
      "reason": "Newest file containing 'pricing strategy'"  
    },  
    {  
      "id": "candidate\_2",  
      "name": "Company-Overview.pdf",  
      "location": "Downloads",  
      "reason": "Older file containing a similar pricing slide"  
    }  
  \]  
}

OpenAI then says:

“I found two possible files. The first is newer and contains the exact phrase. Should I use that one?”

This keeps H Company focused on execution and OpenAI focused on user interaction.

---

# **7\. Kylian backend**

The backend is the authoritative system of record.

Use:

* Node.js;  
* TypeScript;  
* Express or Fastify;  
* WebSockets;  
* Zod;  
* initially in-memory state or SQLite;  
* Postgres later if needed.

## **The backend owns**

* users;  
* phone numbers;  
* computers;  
* active sessions;  
* channel mappings;  
* conversation messages;  
* H computer-task IDs;  
* candidate files;  
* approval requests;  
* WebRTC room IDs;  
* file-delivery status;  
* security policies.

The OpenAI model should not be trusted as the database.

## **Core session object**

interface KylianSession {  
  id: string;  
  userId: string;  
  computerId: string;

  source: "phone" | "whatsapp" | "web";

  status:  
    | "created"  
    | "listening"  
    | "running\_computer\_task"  
    | "waiting\_for\_user"  
    | "waiting\_for\_approval"  
    | "delivering"  
    | "complete"  
    | "failed"  
    | "cancelled";

  request: string;

  messages: Message\[\];  
  events: AgentEvent\[\];  
  candidates: CandidateFile\[\];

  selectedCandidateId: string | null;  
  approvalRequest: ApprovalRequest | null;

  computerTaskId: string | null;  
  liveViewRoomId: string | null;

  createdAt: string;  
  updatedAt: string;  
}  
---

# **8\. Twilio and Gradium voice path**

## **Twilio’s role**

Twilio provides:

* the public phone number;  
* incoming call handling;  
* call lifecycle;  
* bidirectional audio streaming.

Twilio does not make decisions and does not transcribe speech.

## **Gradium’s role**

Gradium provides:

* real-time speech-to-text;  
* voice activity detection;  
* streaming text-to-speech;  
* the spoken Kylian voice.

Gradium’s WebSocket STT is designed for live sources such as telephony and supports telephone audio formats such as `ulaw_8000`. Its TTS endpoint streams generated audio as it becomes available.

## **Voice flow**

Caller speaks  
    ↓  
Twilio Media Stream  
    ↓  
Gradium STT  
    ↓  
Text transcript  
    ↓  
Kylian backend  
    ↓  
OpenAI orchestrator  
    ↓  
Response text  
    ↓  
Gradium TTS  
    ↓  
Twilio Media Stream  
    ↓  
Caller hears Kylian

Gradium is not a reasoning model. It only converts between audio and text.

---

# **9\. NemoClaw and WhatsApp**

## **What NemoClaw is**

NemoClaw is not a model and is not the main Kylian backend.

It is NVIDIA’s sandboxed runtime for always-on agents. It provides:

* sandbox lifecycle;  
* network policies;  
* messaging-channel setup;  
* credential isolation;  
* supervised channel processes;  
* inference routing.

NemoClaw supports OpenClaw messaging channels including WhatsApp, Slack, Telegram, Discord, WeChat, and Teams. WhatsApp is currently documented as experimental and pairs through a QR code.

## **NemoClaw as the computer-use sandbox**

NemoClaw is used in two distinct roles:

1. **Messaging sandbox** — the OpenClaw relay agent that forwards WhatsApp messages to Kylian (this section, config in `nemoclaw/`).
2. **Computer-use sandbox** — the same isolation primitives (virtual desktop, network policy, credential isolation) host the **H Company computer-use agent (Holo)** on an isolated virtual desktop, so `holo3-1-35b-a3b` operates a sandboxed machine instead of the user's real one.

For role 2, the existing HoloDesktop service (`poc/holo-desktop/holo_service.py`) runs as a supervised process inside the sandbox, and Kylian dispatches tasks to it over the **same `/tasks` HTTP contract** the local `holo-desktop` executor uses — only the endpoint moves from `127.0.0.1` to the sandbox's published HTTPS endpoint. On the backend this is `KYLIAN_EXECUTOR_MODE=nemoclaw-desktop` (`server/computer/haiDesktopAdapter.ts` → `NemoclawDesktopServiceAdapter`); provisioning lives in `nemoclaw/desktop/`. Ingress is restricted to the Kylian host and egress to the H Models API (OpenShell default-deny), with bearer auth over TLS.

## **Does WhatsApp need another model?**

Technically, the OpenClaw agent inside NemoClaw needs a model to interpret the incoming WhatsApp message and call a tool.

However, it should **not become a second full Kylian orchestrator**.

Configure the NemoClaw WhatsApp agent with a very narrow role:

Receive WhatsApp messages, identify the user, and forward the message to the Kylian backend using one tool.

Its only important tool should be:

kylian\_handle\_message({  
  whatsappUserId,  
  messageId,  
  text,  
  attachments  
});

The Kylian backend then passes the content to the same OpenAI orchestrator used for phone and web messages.

## **Recommended NemoClaw model**

To satisfy the NVIDIA side challenge, use an H Company model inside the NemoClaw/OpenClaw sandbox:

holo3-1-35b-a3b

The H API is OpenAI-compatible, making it suitable for an agent framework that accepts OpenAI-style providers.

The NemoClaw agent has a deliberately limited prompt and tool set:

You are the WhatsApp ingress adapter for Kylian.

Your job:  
1\. Receive a WhatsApp message.  
2\. Call kylian\_handle\_message with the exact message.  
3\. Return the backend response to WhatsApp.

Do not independently plan computer tasks.  
Do not make approval decisions.  
Do not create separate session state.

This gives you:

* an H Company model running through NemoClaw;  
* a real NemoClaw WhatsApp integration;  
* one canonical OpenAI orchestrator;  
* no conflicting agent brains.

## **WhatsApp flow**

WhatsApp user  
      ↓  
OpenClaw WhatsApp channel  
      ↓  
NemoClaw sandbox  
      ↓  
Holo3.1 channel adapter  
      ↓  
kylian\_handle\_message tool  
      ↓  
Kylian backend  
      ↓  
OpenAI orchestrator  
      ↓  
H Company desktop task  
      ↓  
Backend response  
      ↓  
NemoClaw  
      ↓  
WhatsApp  
---

# **10\. WebRTC and live view**

WebRTC is independent of the AI reasoning.

The desktop companion publishes the computer screen to a LiveKit room. The mobile Kylian page subscribes to that screen track.

Desktop companion  
    ↓ publish screen  
LiveKit room  
    ↓ subscribe  
Mobile browser

WebRTC does not send commands to H Company. It lets the user:

* watch the agent;  
* pause it;  
* stop it;  
* approve actions;  
* verify candidate files;  
* take manual control later.

Use the backend to create short-lived LiveKit room tokens.

---

# **11\. Desktop companion**

The desktop companion runs locally on the user’s computer.

For the hackathon, use a Node.js process or Electron application.

It is responsible for:

* establishing an outbound WebSocket to the backend;  
* registering the computer;  
* enforcing approved folders and applications;  
* launching the Holo computer loop;  
* capturing screenshots;  
* executing clicks and keystrokes;  
* publishing the screen to LiveKit;  
* reading file metadata;  
* uploading a file only after approval;  
* immediately stopping when commanded.

The desktop companion should be the only component allowed to touch the actual computer.

---

# **12\. State machine**

Do not let the LLM freely decide all workflow state.

Use a deterministic backend state machine:

CREATED  
   ↓  
LISTENING  
   ↓  
RUNNING\_COMPUTER\_TASK  
   ↓  
┌──────────────────────────────┐  
│                              │  
WAITING\_FOR\_USER       WAITING\_FOR\_APPROVAL  
│                              │  
└───────────────┬──────────────┘  
                ↓  
            DELIVERING  
                ↓  
             COMPLETE

Possible failure transitions:

Any state  
   ↓  
FAILED or CANCELLED

The OpenAI orchestrator chooses tools, but the backend verifies whether the tool is legal in the current state.

Example:

* `deliver_file` is rejected unless the session is in `WAITING_FOR_APPROVAL` and an approval record exists.  
* `start_computer_task` is rejected if no computer is connected.  
* `send_file` is rejected if the selected file is outside the allowed scope.

---

# **13\. Approval model**

Actions should be grouped by risk.

## **Automatically allowed**

* list computers;  
* inspect session state;  
* search approved folders;  
* open files in read-only mode;  
* generate previews;  
* report candidate metadata.

## **User confirmation required**

* accessing a new folder in “Ask every time” mode;  
* opening a potentially sensitive file;  
* exporting a document;  
* selecting a recipient.

## **Explicit approval required**

* uploading;  
* emailing;  
* sending through WhatsApp;  
* creating a public or temporary link;  
* modifying or deleting a file.

The backend, not the model, must enforce this.

---

# **14\. Recommended model map**

| Function | Technology | Recommended model |
| ----- | ----- | ----- |
| Main orchestration | OpenAI Responses API | `gpt-5.6-terra` |
| Cheaper orchestration fallback | OpenAI Responses API | `gpt-5.6-luna` |
| Desktop computer use | H Company Holo | `holo3-1-35b-a3b` |
| Sandboxed desktop computer use (NemoClaw) | H Company Holo in a NemoClaw sandbox | `holo3-1-35b-a3b` |
| Higher-quality desktop testing | H Company Holo | `holo3-122b-a10b` |
| WhatsApp ingress inside NemoClaw | H Company through OpenClaw | `holo3-1-35b-a3b` |
| Speech-to-text | Gradium | Gradium streaming STT |
| Text-to-speech | Gradium | Gradium streaming TTS |
| Screen transport | LiveKit/WebRTC | No model |
| Phone transport | Twilio | No model |
| Session/security runtime | Kylian backend | No model |

---

# **15\. Recommended repository structure**

kylian/  
├── src/                         \# Existing Vite frontend  
│  
├── server/  
│   └── src/  
│       ├── app.ts  
│       ├── index.ts  
│       │  
│       ├── orchestrator/  
│       │   ├── openaiClient.ts  
│       │   ├── prompt.ts  
│       │   ├── tools.ts  
│       │   └── runOrchestrator.ts  
│       │  
│       ├── sessions/  
│       │   ├── sessionService.ts  
│       │   ├── sessionStateMachine.ts  
│       │   └── sessionTypes.ts  
│       │  
│       ├── computer/  
│       │   ├── taskService.ts  
│       │   ├── companionGateway.ts  
│       │   └── computerTypes.ts  
│       │  
│       ├── voice/  
│       │   ├── twilioWebhook.ts  
│       │   ├── twilioMediaStream.ts  
│       │   ├── gradiumStt.ts  
│       │   └── gradiumTts.ts  
│       │  
│       ├── messaging/  
│       │   ├── whatsappGateway.ts  
│       │   └── webChatGateway.ts  
│       │  
│       ├── liveView/  
│       │   └── livekitTokens.ts  
│       │  
│       ├── approvals/  
│       │   └── approvalService.ts  
│       │  
│       └── files/  
│           ├── fileDeliveryService.ts  
│           └── signedUrls.ts  
│  
├── companion/  
│   └── src/  
│       ├── index.ts  
│       ├── connection.ts  
│       ├── permissions.ts  
│       ├── screenCapture.ts  
│       ├── inputController.ts  
│       ├── fileSearch.ts  
│       ├── livekitPublisher.ts  
│       └── hcompany/  
│           ├── client.ts  
│           ├── agentLoop.ts  
│           ├── tools.ts  
│           └── taskRunner.ts  
│  
├── shared/  
│   └── src/  
│       ├── events.ts  
│       ├── sessions.ts  
│       ├── computers.ts  
│       └── files.ts  
│  
└── nemoclaw/  
    ├── agent.md  
    ├── tools/  
    │   └── kylianHandleMessage.ts  
    └── policies/  
        └── whatsapp.yaml  
---

# **16\. End-to-end example**

The user calls and says:

“Find the latest pitch deck that contains the pricing slide.”

### **Step 1: Speech**

Gradium transcribes the Twilio call:

Find the latest pitch deck that contains the pricing slide.

### **Step 2: OpenAI orchestration**

OpenAI interprets this as:

{  
  "intent": "find\_file",  
  "description": "latest pitch deck containing the pricing slide"  
}

It calls:

start\_computer\_task

### **Step 3: Backend task creation**

The backend creates a task with:

* allowed locations;  
* allowed actions;  
* stop conditions;  
* no file-send permission.

### **Step 4: H Company execution**

Holo:

1. opens Finder;  
2. searches likely files;  
3. opens recent presentations;  
4. inspects slide contents;  
5. finds two candidates;  
6. returns structured results.

### **Step 5: User clarification**

OpenAI receives the candidates and responds:

“I found two files. The first is newer and contains the exact pricing slide. Should I use that one?”

Gradium speaks this response.

### **Step 6: Approval**

The user says:

“Yes, send it.”

The backend creates an approval request.

The mobile web interface shows:

Send `Presentation-July.pptx` to your verified device?

The user approves.

### **Step 7: Delivery**

The companion uploads the file to temporary storage.

The backend creates an expiring URL and returns it through:

* the web page;  
* WhatsApp;  
* or another approved destination.

---

# **17\. Final recommendation**

Build Kylian with this exact responsibility split:

OpenAI Terra  
\= understands, plans, converses, and selects tools

H Company Holo  
\= sees and operates the computer

Kylian backend  
\= owns state, permissions, approvals, and event routing

NemoClaw/OpenClaw  
\= runs the H-powered WhatsApp adapter securely

Gradium  
\= converts speech to text and text to speech

Twilio  
\= carries the phone call

LiveKit/WebRTC  
\= shows the computer screen

The most important rule is:

**OpenAI controls the workflow, but the backend controls authority. H Company controls the interface, but only within the task and permissions the backend provides.**



Caller
  ↓
Twilio phone number
  ↓
Twilio sends call audio to your public WebSocket URL
  ↓
Tunnel forwards that WebSocket to localhost:8787
  ↓
Kylian backend
  ↓
Gradium STT WebSocket
  ↓
OpenAI orchestrator
  ↓
Gradium TTS WebSocket
  ↓
Kylian backend
  ↓
Twilio Media Stream
  ↓
Caller hears Kylian