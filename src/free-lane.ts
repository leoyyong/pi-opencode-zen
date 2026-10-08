/**
 * The OpenCode Zen anonymous free lane.
 *
 * Free-lane requests only succeed when they carry the shape the official
 * OpenCode CLI produces (probed live; aligned with opencode2dsh):
 *
 * 1. Canonical session id — `ses_` + 12 lowercase hex chars + 14 Base62 chars.
 *    Since 2026-09-16 any other shape is rejected with
 *    `403 FreeTierError: free tier can only be used from within OpenCode`.
 * 2. CLI-identical disguise headers (User-Agent, client, session affinity).
 * 3. An agent-shape body: `stream: true` plus `function` tools named
 *    `bash` AND `read`; headers and tool descriptions go uninspected, only
 *    the presence of the tools matters. When the client sent no tools at
 *    all, `tool_choice: "none"` keeps the injected stubs unreachable.
 *
 * pi-ai always streams, so the tool gate is the only body gap this module
 * has to close. Gate tools are appended by
 * {@linkcode ensureFreeLaneShape}/{@linkcode ensureResponsesFreeLaneShape}
 * through pi-ai's `onPayload` hook right before dispatch.
 */

import { createHash, randomBytes } from "node:crypto";

/** OpenCode client version the lane expects in the User-Agent. */
export const OPENCODE_CLIENT_VERSION = "1.18.31";

/** Anonymous credential the upstream accepts for the free lane. */
export const ANONYMOUS_KEY = "public";

const CANONICAL_SESSION_PATTERN = /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/;
const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export interface RequestIDs {
  session: string;
  request: string;
  project: string;
}

/** Minimal structural view of a transcript message. */
export interface MessageLike {
  role?: unknown;
  content?: unknown;
}

/** sha256("prefix" + 0x00 + "value"), truncated to 12 bytes. Stable, non-reversible. */
export function stableID(prefix: string, value: string): string {
  const digest = createHash("sha256").update(`${prefix}\u0000${value}`).digest();
  return `${prefix}_${digest.subarray(0, 12).toString("hex")}`;
}

export function randomID(prefix: string, size: number): string {
  return `${prefix}_${randomBytes(size).toString("hex")}`;
}

/**
 * OpenCode's canonical session shape. A signal that already carries an
 * official OpenCode session passes through unchanged (upstream prompt-cache
 * affinity); anything else is deterministically hashed into the canonical
 * shape, so one conversation always produces the same session id.
 */
export function canonicalSessionID(signal: string): string {
  if (CANONICAL_SESSION_PATTERN.test(signal)) return signal;
  const digest = createHash("sha256").update(`ses\u0000${signal}`).digest();
  const timePart = digest.subarray(0, 6).toString("hex");
  let value = BigInt(`0x${digest.subarray(6, 16).toString("hex")}`);
  let randomPart = "";
  for (let index = 0; index < 14; index += 1) {
    randomPart = BASE62_ALPHABET[Number(value % 62n)] + randomPart;
    value /= 62n;
  }
  return `ses_${timePart}${randomPart}`;
}

function firstString(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/**
 * The conversation signal: JSON of the first user message's content. Using
 * the first user turn keeps a multi-turn conversation stable as its history
 * grows while separating conversations with different beginnings.
 */
export function conversationSeed(messages: readonly MessageLike[]): string {
  for (const message of messages) {
    if (!message || message.role !== "user") continue;
    const encoded = JSON.stringify(message.content ?? null);
    if (encoded !== "null" && encoded.length > 0) return encoded;
  }
  return "";
}

/**
 * Derive the correlation ids for one upstream request from the transcript.
 * A pi session id can supply the session identity directly when it already
 * matches the canonical shape; otherwise the conversation provides the seed.
 */
export function deriveRequestIDs(messages: readonly MessageLike[], sessionId?: string): RequestIDs {
  const incoming = firstString(sessionId);
  const seed = conversationSeed(messages);
  const sessionSignal = CANONICAL_SESSION_PATTERN.test(incoming)
    ? incoming
    : seed !== "" && seed !== "{}"
      ? seed
      : randomID("fallback", 16);
  return {
    session: canonicalSessionID(sessionSignal),
    request: randomID("req", 16),
    project: stableID("prj", "pi-opencode-zen-free:default-project"),
  };
}

/**
 * CLI-identical user agent. The zen free lane gates on it, so it is not
 * config driven; callers can still pass an explicit override in the
 * second argument of `disguiseHeaders`.
 */
export function opencodeUserAgent(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
  nodeVersion: string = process.versions.node,
): string {
  return `opencode/${OPENCODE_CLIENT_VERSION} (${platform} ${arch}; node${nodeVersion})`;
}

/**
 * The full disguise header set sent with every upstream request.
 * Explicitly provided caller headers (further down the merge order) win.
 */
export function disguiseHeaders(ids: RequestIDs, userAgent: string = opencodeUserAgent()): Record<string, string> {
  return {
    "user-agent": userAgent,
    "x-opencode-client": "cli",
    "x-opencode-session": ids.session,
    "x-session-affinity": ids.session,
    "X-Session-Id": ids.session,
    "x-opencode-request": ids.request,
    "x-opencode-project": ids.project,
  };
}

/** Function-tool names the anonymous lane requires in the body. */
export const FREE_LANE_GATE_TOOL_NAMES = ["bash", "read"] as const;

export type FreeLaneGateToolName = (typeof FREE_LANE_GATE_TOOL_NAMES)[number];

export interface FreeLaneGateTool {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export function freeLaneGateTool(name: FreeLaneGateToolName): FreeLaneGateTool {
  return {
    type: "function",
    function: {
      name,
      description: "Reserved for the host runtime; do not call it.",
      parameters: { type: "object", properties: {} },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Rewrite an outgoing chat-completions payload so it satisfies the free-lane
 * agent-shape gate: append only the gate tools the payload is missing and,
 * when the context carried no tools at all, pin `tool_choice: "none"` so the
 * model cannot call the injected stubs. Client-provided tool choices are
 * preserved untouched.
 */
export function ensureFreeLaneShape(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) return undefined;
  const tools = Array.isArray(payload.tools) ? (payload.tools as unknown[]) : [];
  const names = new Set(
    tools.map((tool) => {
      const fn = isRecord(tool) ? tool.function : undefined;
      return isRecord(fn) ? fn.name : undefined;
    }),
  );
  const missing = FREE_LANE_GATE_TOOL_NAMES.filter((name) => !names.has(name));
  if (missing.length === 0) return undefined;
  const next: Record<string, unknown> = { ...payload };
  next.tools = [...tools, ...missing.map((name) => freeLaneGateTool(name))];
  if (tools.length === 0) next.tool_choice = "none";
  return next;
}

/** Responses uses flat function tools and its Zen gateway accepts auto only. */
export function ensureResponsesFreeLaneShape(payload: unknown): unknown | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.input)) return undefined;
  const tools = Array.isArray(payload.tools) ? (payload.tools as unknown[]) : [];
  const names = new Set(
    tools.map((tool) => {
      if (!isRecord(tool) || tool.type !== "function") return undefined;
      return tool.name;
    }),
  );
  const missing = FREE_LANE_GATE_TOOL_NAMES.filter((name) => !names.has(name));
  const invalidChoice = payload.tool_choice !== undefined && payload.tool_choice !== "auto";
  if (missing.length === 0 && !invalidChoice) return undefined;
  return {
    ...payload,
    tools: [...tools, ...missing.map((name) => ({ type: "function", ...freeLaneGateTool(name).function }))],
    tool_choice: "auto",
  };
}
