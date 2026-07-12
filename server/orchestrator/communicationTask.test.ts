import assert from "node:assert/strict";
import test from "node:test";
import {
  ApprovalRegistry,
  buildCommunicationInstruction,
  mapCommunicationOutcome,
  type CommunicationRequest,
} from "./communicationTask.js";

function req(overrides: Partial<CommunicationRequest> = {}): CommunicationRequest {
  return {
    application: "gmail",
    action: "Create a new email draft",
    recipientOrDestination: "me@example.com",
    message: "Here is my resume.",
    subject: "My resume",
    sendMode: "draft",
    ...overrides,
  };
}

test("Gmail draft instruction is bounded, stops before sending, and allows attaching", () => {
  const instruction = buildCommunicationInstruction(req({ attachmentName: "resume.pdf", attachmentPath: "/Users/x/Documents/resume.pdf", attachmentMime: "application/pdf" }));
  assert.match(instruction, /logged-in Gmail/);
  assert.match(instruction, /me@example\.com/);
  assert.match(instruction, /My resume/);
  assert.match(instruction, /STOP BEFORE SENDING/);
  assert.match(instruction, /Attaching a validated file is allowed/);
  assert.match(instruction, /Do NOT click the final Send or Post button/);
  assert.match(instruction, /Do not use Terminal, Claude Code, or VS Code/);
});

test("an approved send instruction authorizes the final Send and omits any blanket do-not-send", () => {
  const instruction = buildCommunicationInstruction(req({ sendMode: "send" }));
  assert.match(instruction, /perform the send action exactly once/);
  assert.match(instruction, /Click the final Send or Post button exactly once/);
  assert.ok(!/do not send, submit, or delete anything/i.test(instruction), "no contradictory blanket send prohibition");
  assert.ok(!/STOP BEFORE SENDING/.test(instruction));
});

test("attachment instruction injects the exact path, parent dir, filename, and file-picker shortcut", () => {
  const instruction = buildCommunicationInstruction(req({ attachmentName: "resume.pdf", attachmentPath: "/Users/ivan/Documents/CV/resume.pdf", attachmentMime: "application/pdf" }));
  assert.match(instruction, /Command\+Shift\+G/);
  assert.match(instruction, /Go to Folder/);
  assert.match(instruction, /\/Users\/ivan\/Documents\/CV\b/, "types the exact parent directory");
  assert.match(instruction, /named exactly "resume\.pdf"/);
  assert.match(instruction, /attachment_failed/);
  assert.match(instruction, /paperclip \(Attach files\) icon in the Gmail compose window/);
});

test("WhatsApp Web chooses Document for PDFs and Photos & videos for images", () => {
  const pdf = buildCommunicationInstruction(req({ application: "whatsapp_web", recipientOrDestination: "John", attachmentName: "doc.pdf", attachmentPath: "/Users/x/Desktop/doc.pdf", attachmentMime: "application/pdf" }));
  assert.match(pdf, /choose "Document"/);
  const png = buildCommunicationInstruction(req({ application: "whatsapp_web", recipientOrDestination: "John", attachmentName: "pic.png", attachmentPath: "/Users/x/Desktop/pic.png", attachmentMime: "image/png" }));
  assert.match(png, /choose "Photos & videos"/);
});

test("Slack, LinkedIn, Discord templates name the destination, attach control, and stop before send", () => {
  const controls: Record<string, RegExp> = {
    slack: /attachment\/upload \(plus or paperclip\) control/,
    linkedin: /paperclip\/attachment icon in the LinkedIn message box/,
    discord: /plus icon to the left of the Discord message box/,
  };
  for (const application of ["slack", "linkedin", "discord"] as const) {
    const instruction = buildCommunicationInstruction(req({ application, recipientOrDestination: "#demo", subject: null, attachmentName: "f.pdf", attachmentPath: "/Users/x/Desktop/f.pdf", attachmentMime: "application/pdf" }));
    assert.match(instruction, /#demo/);
    assert.match(instruction, /STOP BEFORE SENDING/);
    assert.match(instruction, controls[application]);
    assert.match(instruction, /login is required/);
  }
});

test("outcome mapping requires attachment verification and a visible confirmation before sent", () => {
  assert.deepEqual(mapCommunicationOutcome({ sendMode: "draft", attachmentName: null }, "completed", "Draft created successfully"), { attachmentStatus: "not_requested", deliveryStatus: "draft_created" });
  assert.deepEqual(
    mapCommunicationOutcome({ sendMode: "send", attachmentName: "resume.pdf" }, "completed", 'Attached resume.pdf. The message was sent.'),
    { attachmentStatus: "attached", deliveryStatus: "sent" },
  );
  assert.deepEqual(
    mapCommunicationOutcome({ sendMode: "send", attachmentName: null }, "completed", "The email draft is ready but I did not send"),
    { attachmentStatus: "not_requested", deliveryStatus: "unknown" },
    "send with no visible confirmation → unknown, never sent",
  );
  assert.deepEqual(
    mapCommunicationOutcome({ sendMode: "send", attachmentName: "resume.pdf" }, "completed", "attachment_failed: could not attach the file"),
    { attachmentStatus: "attachment_failed", deliveryStatus: "failed" },
    "a send whose attachment failed is never sent",
  );
  assert.equal(mapCommunicationOutcome({ sendMode: "send", attachmentName: null }, "completed", "Gmail is not logged in").deliveryStatus, "blocked");
  assert.equal(mapCommunicationOutcome({ sendMode: "draft", attachmentName: null }, "failed", "error").deliveryStatus, "failed");
});

test("approval binds to platform, recipient, content, and attachment", () => {
  const registry = new ApprovalRegistry();
  const request = req({ sendMode: "draft", attachmentName: "resume.pdf" });
  const approvalId = registry.issue("s1", request);

  // Wrong session, changed message, and changed recipient are all rejected.
  assert.equal(registry.redeem("s2", approvalId, request), false);
  const registry2 = new ApprovalRegistry();
  const id2 = registry2.issue("s1", request);
  assert.equal(registry2.redeem("s1", id2, { ...request, message: "different" }), false);
  const registry3 = new ApprovalRegistry();
  const id3 = registry3.issue("s1", request);
  assert.equal(registry3.redeem("s1", id3, { ...request, recipientOrDestination: "evil@example.com" }), false);
});

test("a matching approval is accepted exactly once", () => {
  const registry = new ApprovalRegistry();
  const request = req();
  const approvalId = registry.issue("s1", request);
  assert.equal(registry.redeem("s1", approvalId, request), true);
  assert.equal(registry.redeem("s1", approvalId, request), false, "approval is single-use");
});

test("a missing approvalId is rejected", () => {
  const registry = new ApprovalRegistry();
  assert.equal(registry.redeem("s1", null, req()), false);
});
