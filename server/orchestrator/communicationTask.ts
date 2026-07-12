import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

// Deterministic layer for HoloDesktop-driven communication (Gmail, Slack,
// LinkedIn, Discord, WhatsApp Web, other apps). Three responsibilities:
//   1. buildCommunicationInstruction — bounded, app-specific instructions with
//      exact recipient/message/attachment, an operation-aware guard, and a
//      deterministic native macOS file-picker sequence for attachments.
//   2. mapCommunicationOutcome — structured attachment + delivery status; never
//      claims "sent" without a verified attachment and a visible confirmation.
//   3. ApprovalRegistry — third-party/platform sends require a server-issued
//      approval bound to platform+destination+content+attachment; any material
//      change or expiry invalidates it. The model cannot bypass this.

export type CommunicationApplication = "gmail" | "slack" | "linkedin" | "discord" | "whatsapp_web" | "other";
export type SendMode = "draft" | "send";

export interface CommunicationRequest {
  application: CommunicationApplication;
  applicationName?: string | null;
  action: string;
  recipientOrDestination: string;
  message?: string | null;
  subject?: string | null;
  attachmentName?: string | null;
  attachmentPath?: string | null;
  attachmentMime?: string | null;
  sendMode: SendMode;
}

const PROHIBITIONS =
  "Do not open unrelated messages or conversations. Do not interact with any application the task does not require. " +
  "Do not use Terminal, Claude Code, or VS Code. Do not run shell commands.";

// Operation-aware guard: task type + approval state decide what is allowed.
// A send task NEVER receives a contradictory blanket "do not send" clause.
function operationGuard(sendMode: SendMode): string {
  return sendMode === "send"
    ? " Attaching the exact validated file is allowed. Click the final Send or Post button exactly once. " +
        "Do not send, submit, delete, or purchase anything else, and take no unrelated actions."
    : " Attaching a validated file is allowed. Composing is allowed. Do NOT click the final Send or Post button.";
}

// Native macOS file-picker sequence — the primary, deterministic attach path.
// Command+Shift+G is a Finder/file-chooser shortcut, not a shell.
function attachmentSequence(request: CommunicationRequest): string {
  if (!request.attachmentPath || !request.attachmentName) return "";
  const parentDir = path.dirname(request.attachmentPath);
  const control = attachControl(request);
  return (
    ` To attach the file, ${control} Wait for the native macOS file chooser to appear. ` +
    `Press Command+Shift+G to open "Go to Folder". Type exactly: ${parentDir} then press Return. ` +
    `Select the file named exactly "${request.attachmentName}" and click Open. ` +
    `Wait until the application visibly shows the attachment, then verify the displayed attachment filename is exactly "${request.attachmentName}". ` +
    `If the filename does not match or no attachment appears, stop and report "attachment_failed". ` +
    `Use drag-and-drop only if the file picker cannot be opened.`
  );
}

function attachControl(request: CommunicationRequest): string {
  switch (request.application) {
    case "gmail":
      return "click the paperclip (Attach files) icon in the Gmail compose window.";
    case "whatsapp_web": {
      const isImage = (request.attachmentMime ?? "").startsWith("image/");
      return `click the paperclip/attach icon, then choose ${isImage ? '"Photos & videos"' : '"Document"'}.`;
    }
    case "slack":
      return "click the attachment/upload (plus or paperclip) control in the Slack message box.";
    case "discord":
      return 'click the plus icon to the left of the Discord message box, then choose "Upload a File".';
    case "linkedin":
      return "click the paperclip/attachment icon in the LinkedIn message box.";
    default:
      return "click the application's attachment or upload control.";
  }
}

export function buildCommunicationInstruction(request: CommunicationRequest): string {
  const app = applicationLabel(request);
  const attachment = attachmentSequence(request);
  const message = request.message?.trim() ? ` The message text is exactly: "${request.message.trim()}".` : "";
  const subject = request.subject?.trim() ? ` Set the subject to exactly: "${request.subject.trim()}".` : "";
  const guard = operationGuard(request.sendMode);
  const stop =
    request.sendMode === "send"
      ? ` Verify the recipient and content match the above, then perform the send action exactly once and confirm the application visibly shows the message was sent (report "message sent" when you see that confirmation), then stop.`
      : " Verify the recipient and content match the above, then STOP BEFORE SENDING — leave it as a draft and do not click Send or Post.";

  switch (request.application) {
    case "gmail":
      return (
        `Use the existing logged-in Gmail session in the browser. ${request.action.trim()} addressed to ${request.recipientOrDestination}.` +
        subject +
        message +
        attachment +
        stop +
        ` If Gmail is not logged in, stop and report that login is required.${guard} ${PROHIBITIONS}`
      );
    case "slack":
      return (
        `Open the existing logged-in Slack application or browser tab. Navigate to ${request.recipientOrDestination}. ${request.action.trim()}.` +
        message +
        attachment +
        ` Verify the destination is exactly ${request.recipientOrDestination}.` +
        stop +
        ` If Slack is not logged in, stop and report that login is required.${guard} ${PROHIBITIONS}`
      );
    case "linkedin":
      return (
        `Open LinkedIn in the existing logged-in browser. Find the conversation with ${request.recipientOrDestination}. ` +
        `Read only the most recent messages needed for context. ${request.action.trim()}.` +
        message +
        attachment +
        stop +
        ` If LinkedIn is not logged in, stop and report that login is required.${guard} ${PROHIBITIONS}`
      );
    case "discord":
      return (
        `Open Discord in the existing logged-in browser or app. Navigate to ${request.recipientOrDestination}. ${request.action.trim()}.` +
        message +
        attachment +
        ` Verify the destination is exactly ${request.recipientOrDestination}.` +
        stop +
        ` If Discord is not logged in, stop and report that login is required.${guard} ${PROHIBITIONS}`
      );
    case "whatsapp_web":
      return (
        `Open WhatsApp Web in the existing logged-in browser. Find the contact ${request.recipientOrDestination}. ${request.action.trim()}.` +
        message +
        attachment +
        ` Verify the contact is exactly ${request.recipientOrDestination}.` +
        stop +
        ` If WhatsApp Web is not logged in, stop and report that login is required.${guard} ${PROHIBITIONS}`
      );
    default:
      return (
        `Open ${app} (already logged in if it requires an account). ${request.action.trim()} for ${request.recipientOrDestination}.` +
        subject +
        message +
        attachment +
        stop +
        ` If the application requires a login that is not present, stop and report that login is required.${guard} ${PROHIBITIONS}`
      );
  }
}

export type AttachmentStatus = "not_requested" | "attached" | "attachment_failed";
export type DeliveryStatus = "draft_created" | "sent" | "blocked" | "failed" | "unknown";

export interface CommunicationOutcome {
  attachmentStatus: AttachmentStatus;
  deliveryStatus: DeliveryStatus;
}

/**
 * Structured, conservative outcome. "sent" requires: a send was requested, the
 * attachment (if any) was visibly verified, and a visible send confirmation was
 * observed. Anything less never reports success.
 */
export function mapCommunicationOutcome(
  request: Pick<CommunicationRequest, "sendMode" | "attachmentName">,
  executorStatus: string,
  summary: string,
): CommunicationOutcome {
  const text = summary.toLowerCase();
  const attachmentRequested = Boolean(request.attachmentName);
  const name = request.attachmentName?.toLowerCase() ?? "";
  const attachmentFailed = /attachment_failed|could not attach|couldn't attach|attachment failed|no attachment|filename mismatch|does not match/.test(text);
  const attachmentVerified = attachmentRequested && !attachmentFailed && name.length > 0 && text.includes(name);

  let attachmentStatus: AttachmentStatus = "not_requested";
  if (attachmentRequested) attachmentStatus = attachmentVerified ? "attached" : "attachment_failed";

  const blocked = /log ?in required|not logged in|sign ?in required|captcha|permission denied|access denied/.test(text);
  let deliveryStatus: DeliveryStatus;
  if (blocked) {
    deliveryStatus = "blocked";
  } else if (executorStatus !== "completed") {
    deliveryStatus = "failed";
  } else if (request.sendMode === "draft") {
    deliveryStatus = "draft_created";
  } else if (attachmentRequested && attachmentStatus !== "attached") {
    // A send that could not verify its required attachment is never "sent".
    deliveryStatus = "failed";
  } else if (/\bmessage sent\b|\bemail sent\b|\bwas sent\b|sending confirmed|appears in the conversation|shows.{0,20}sent/.test(text)) {
    deliveryStatus = "sent";
  } else {
    // Send attempted but no visible confirmation observed.
    deliveryStatus = "unknown";
  }
  return { attachmentStatus, deliveryStatus };
}

export interface ApprovalRecord {
  approvalId: string;
  sessionId: string;
  bindingHash: string;
  expiresAt: number;
}

const APPROVAL_TTL_MS = 10 * 60 * 1000;

export class ApprovalRegistry {
  private readonly approvals = new Map<string, ApprovalRecord>();

  /** Called after a successful draft; the returned id is handed to the model. */
  issue(sessionId: string, request: CommunicationRequest): string {
    const approvalId = `apv-${randomBytes(12).toString("hex")}`;
    this.approvals.set(approvalId, {
      approvalId,
      sessionId,
      bindingHash: bindingHash(request),
      expiresAt: Date.now() + APPROVAL_TTL_MS,
    });
    if (this.approvals.size > 100) {
      const oldest = this.approvals.keys().next().value;
      if (oldest !== undefined) this.approvals.delete(oldest);
    }
    return approvalId;
  }

  /** A send consumes its approval; any mismatch or expiry rejects it. */
  redeem(sessionId: string, approvalId: string | null | undefined, request: CommunicationRequest): boolean {
    if (!approvalId) return false;
    const record = this.approvals.get(approvalId);
    if (!record || record.sessionId !== sessionId) return false;
    if (Date.now() > record.expiresAt) {
      this.approvals.delete(approvalId);
      return false;
    }
    if (record.bindingHash !== bindingHash(request)) return false;
    this.approvals.delete(approvalId);
    return true;
  }
}

/** Approval binds to platform + destination + content + attachment. */
function bindingHash(request: CommunicationRequest): string {
  return createHash("sha256")
    .update(
      [
        request.application,
        request.applicationName ?? "",
        request.recipientOrDestination,
        request.message ?? "",
        request.subject ?? "",
        request.attachmentName ?? "",
      ].join(" "),
    )
    .digest("hex");
}

function applicationLabel(request: CommunicationRequest): string {
  if (request.application === "other") return request.applicationName?.trim() || "the requested application";
  return request.application;
}
