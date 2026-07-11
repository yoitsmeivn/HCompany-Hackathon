import type { DemoFixture } from "@/data/demoFixture";
import { buildDemoFixture } from "@/data/demoFixture";
import { isValidIso } from "@/lib/time";

export type { DemoFixture };

export function getBundledFixture(): DemoFixture {
  return buildDemoFixture(Date.now());
}

const COMPUTER_STATUSES = ["configured", "connecting", "connected", "offline"];
const SESSION_STATES = ["active", "complete", "waiting", "paused", "failed"];
const ACCESS_MODES = ["full", "selected", "ask"];
const FILE_KINDS = ["pdf", "pptx", "docx", "xlsx", "image", "other"];
const FILE_ACTIONS = ["opened", "previewed", "located", "delivered", "uploaded"];
const FILE_STATUSES = ["available", "delivered", "expired", "permission-required"];
const FILE_SOURCES = ["browser-upload", "companion", "demo"];
const CONNECTION_STATUSES = ["connecting", "connected", "disconnected", "failed"];
const MESSAGE_SIDES = ["user", "agent"];
const EVENT_STATES = ["done", "current", "pending"];
const APPROVAL_STATUSES = ["pending", "approved", "declined"];

class FixtureError extends Error {}

function fail(message: string): never {
  throw new FixtureError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(obj: Record<string, unknown>, key: string, where: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.length === 0) {
    fail(`${where}: "${key}" must be a non-empty string`);
  }
  return value;
}

function requireIso(obj: Record<string, unknown>, key: string, where: string): string {
  const value = requireString(obj, key, where);
  if (!isValidIso(value)) fail(`${where}: "${key}" must be a valid ISO timestamp`);
  return value;
}

function requireEnum(
  obj: Record<string, unknown>,
  key: string,
  allowed: string[],
  where: string,
): string {
  const value = requireString(obj, key, where);
  if (!allowed.includes(value)) {
    fail(`${where}: "${key}" must be one of ${allowed.join(", ")} (got "${value}")`);
  }
  return value;
}

function optionalString(obj: Record<string, unknown>, key: string, where: string): void {
  if (obj[key] !== undefined && typeof obj[key] !== "string") {
    fail(`${where}: "${key}" must be a string when present`);
  }
}

function requireArray(value: unknown, where: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) fail(`${where} must be an array`);
  return value.map((item, i) => {
    if (!isRecord(item)) fail(`${where}[${i}] must be an object`);
    return item;
  });
}

function registerId(ids: Set<string>, id: string, where: string): void {
  if (ids.has(id)) fail(`Duplicate id "${id}" (${where}) — all ids must be unique`);
  ids.add(id);
}

// Validates an imported fixture strictly: enums, ISO timestamps, unique ids,
// and referential integrity. Throws with a specific message on the first
// problem — nothing is partially imported.
export function parseFixture(json: unknown): DemoFixture {
  if (!isRecord(json)) fail("Fixture must be a JSON object");

  const allIds = new Set<string>();

  const computers = requireArray(json.computers ?? [], "computers").map((c, i) => {
    const where = `computers[${i}]`;
    const id = requireString(c, "id", where);
    registerId(allIds, id, where);
    requireString(c, "name", where);
    requireEnum(c, "status", COMPUTER_STATUSES, where);
    if (c.lastSeenAt !== null && c.lastSeenAt !== undefined) requireIso(c, "lastSeenAt", where);
    if (!isRecord(c.access)) fail(`${where}: "access" must be an object`);
    requireEnum(c.access, "mode", ACCESS_MODES, `${where}.access`);
    return c;
  });
  const computerIds = new Set(computers.map((c) => c.id as string));

  const sessions = requireArray(json.sessions ?? [], "sessions").map((s, i) => {
    const where = `sessions[${i}]`;
    const id = requireString(s, "id", where);
    registerId(allIds, id, where);
    requireString(s, "name", where);
    requireIso(s, "lastActiveAt", where);
    requireEnum(s, "state", SESSION_STATES, where);
    requireEnum(s, "accessMode", ACCESS_MODES, where);
    const computerId = requireString(s, "computerId", where);
    if (!computerIds.has(computerId)) {
      fail(`${where}: computerId "${computerId}" does not match any computer`);
    }
    return s;
  });
  const sessionIds = new Set(sessions.map((s) => s.id as string));

  requireArray(json.files ?? [], "files").forEach((f, i) => {
    const where = `files[${i}]`;
    const id = requireString(f, "id", where);
    registerId(allIds, id, where);
    requireString(f, "name", where);
    requireIso(f, "lastAccessedAt", where);
    requireEnum(f, "kind", FILE_KINDS, where);
    requireEnum(f, "action", FILE_ACTIONS, where);
    requireEnum(f, "status", FILE_STATUSES, where);
    requireEnum(f, "source", FILE_SOURCES, where);
    if (f.computerId !== undefined) {
      const computerId = requireString(f, "computerId", where);
      if (!computerIds.has(computerId)) {
        fail(`${where}: computerId "${computerId}" does not match any computer`);
      }
    }
    if (f.sessionId !== undefined) {
      const sessionId = requireString(f, "sessionId", where);
      if (!sessionIds.has(sessionId)) {
        fail(`${where}: sessionId "${sessionId}" does not match any session`);
      }
    }
  });

  const live = json.live ?? {};
  if (!isRecord(live)) fail(`"live" must be an object keyed by session id`);
  for (const [sessionId, data] of Object.entries(live)) {
    const where = `live["${sessionId}"]`;
    if (!sessionIds.has(sessionId)) {
      fail(`${where}: key does not match any session id`);
    }
    if (!isRecord(data)) fail(`${where} must be an object`);
    requireEnum(data, "connectionStatus", CONNECTION_STATUSES, where);

    requireArray(data.messages ?? [], `${where}.messages`).forEach((m, i) => {
      const w = `${where}.messages[${i}]`;
      registerId(allIds, requireString(m, "id", w), w);
      requireString(m, "text", w);
      requireEnum(m, "side", MESSAGE_SIDES, w);
      requireIso(m, "at", w);
    });
    requireArray(data.activity ?? [], `${where}.activity`).forEach((e, i) => {
      const w = `${where}.activity[${i}]`;
      registerId(allIds, requireString(e, "id", w), w);
      requireString(e, "label", w);
      requireEnum(e, "state", EVENT_STATES, w);
      requireIso(e, "at", w);
    });
    requireArray(data.candidates ?? [], `${where}.candidates`).forEach((c, i) => {
      const w = `${where}.candidates[${i}]`;
      registerId(allIds, requireString(c, "id", w), w);
      requireString(c, "name", w);
      optionalString(c, "evidence", w);
    });
    if (data.approval !== null && data.approval !== undefined) {
      if (!isRecord(data.approval)) fail(`${where}.approval must be an object or null`);
      const w = `${where}.approval`;
      registerId(allIds, requireString(data.approval, "id", w), w);
      requireString(data.approval, "fileName", w);
      requireEnum(data.approval, "status", APPROVAL_STATUSES, w);
    }
  }

  if (json.activeComputerId !== null && json.activeComputerId !== undefined) {
    if (
      typeof json.activeComputerId !== "string" ||
      !computerIds.has(json.activeComputerId)
    ) {
      fail(`"activeComputerId" must be null or an existing computer id`);
    }
  }

  return json as unknown as DemoFixture;
}
