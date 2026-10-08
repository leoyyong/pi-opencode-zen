import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  FREE_LANE_GATE_TOOL_NAMES,
  ANONYMOUS_KEY,
  canonicalSessionID,
  conversationSeed,
  deriveRequestIDs,
  disguiseHeaders,
  ensureFreeLaneShape,
  ensureResponsesFreeLaneShape,
  freeLaneGateTool,
  opencodeUserAgent,
  stableID,
} from "../src/free-lane.ts";

test("canonicalSessionID produces the ses_ + 12 hex + 14 base62 shape and is stable", () => {
  const first = canonicalSessionID("conversation seed");
  const again = canonicalSessionID("conversation seed");
  assert.match(first, /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/);
  assert.equal(first.length, 30);
  assert.equal(first, again);
  assert.notEqual(canonicalSessionID("other conversation"), first);
});

test("canonicalSessionID passes an already-canonical id through unchanged", () => {
  const official = "ses_0123456789abABCDEFGHIJKLMN";
  assert.equal(canonicalSessionID(official), official);
});

const messages = [
  { role: "system", content: [{ type: "text", text: "be brief" }] },
  { role: "user", content: [{ type: "text", text: "hello there" }] },
  { role: "assistant", content: "hi" },
  { role: "user", content: [{ type: "text", text: "again" }] },
];

test("conversationSeed uses the first user message's content JSON", () => {
  const user = messages.find((message) => message.role === "user");
  assert.equal(conversationSeed(messages), JSON.stringify(user?.content));
  assert.equal(conversationSeed(messages.filter((message) => message.role !== "user")), "");
});

test("deriveRequestIDs derives ids from the conversation and stays stable", () => {
  const a = deriveRequestIDs(messages);
  const b = deriveRequestIDs(messages);
  assert.match(a.session, /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/);
  assert.match(a.request, /^req_[0-9a-f]{32}$/);
  assert.match(a.project, /^prj_[0-9a-f]{24}$/);
  assert.equal(a.session, b.session);
  assert.notEqual(a.request, b.request);
  // A canonical incoming session id is reused verbatim.
  const official = "ses_0123456789abABCDEFGHIJKLMN";
  assert.equal(deriveRequestIDs(messages, official).session, official);
  // Separate projects build separate stable project ids.
  assert.equal(stableID("prj", "x"), stableID("prj", "x"));
});

test("opencodeUserAgent uses the CLI spelling", () => {
  assert.equal(opencodeUserAgent("linux", "arm64", "26.4.0"), "opencode/1.18.31 (linux arm64; node26.4.0)");
});

test("disguiseHeaders carries the full CLI correlation set", () => {
  const headers = disguiseHeaders({
    session: "ses_0123456789abABCDEFGHIJKLMN",
    request: "req_abc",
    project: "prj_abc",
  });
  assert.deepEqual(Object.keys(headers).sort(), [
    "X-Session-Id",
    "user-agent",
    "x-opencode-client",
    "x-opencode-project",
    "x-opencode-request",
    "x-opencode-session",
    "x-session-affinity",
  ]);
  assert.equal(headers["x-opencode-client"], "cli");
  assert.equal(headers["x-opencode-session"], "ses_0123456789abABCDEFGHIJKLMN");
});

test("freeLaneGateTool describes a stub the model should not call", () => {
  for (const name of FREE_LANE_GATE_TOOL_NAMES) {
    const tool = freeLaneGateTool(name);
    assert.equal(tool.type, "function");
    assert.equal(tool.function.name, name);
    assert.deepEqual(tool.function.parameters, { type: "object", properties: {} });
  }
  assert.equal(FREE_LANE_GATE_TOOL_NAMES.includes("read"), true);
});

test("ensureFreeLaneShape injects missing gate tools and nothing when present", () => {
  const shaped = ensureFreeLaneShape({
    messages: [{ role: "user", content: "hi" }],
  });
  const names = shaped?.tools.map((tool) => tool.function.name);
  assert.ok(shaped);
  assert.deepEqual(names, FREE_LANE_GATE_TOOL_NAMES);
  assert.equal(shaped?.tool_choice, "none");

  const withChoice = ensureFreeLaneShape({
    messages: [{ role: "user", content: "hi" }],
    tools: [{ type: "function", function: { name: "bash", parameters: {} } }],
  });
  const missing = FREE_LANE_GATE_TOOL_NAMES.filter((name) => name !== "bash");
  assert.deepEqual(
    withChoice.tools.slice(1).map((tool) => tool.function.name),
    missing,
  );
  assert.equal(withChoice?.tool_choice, undefined);

  assert.equal(
    ensureFreeLaneShape({
      messages: [{ role: "user", content: "hi" }],
      tools: [freeLaneGateTool("bash"), freeLaneGateTool("read")],
    }),
    undefined,
  );
  assert.equal(ensureFreeLaneShape("not an object"), undefined);
});

test("ensureResponsesFreeLaneShape injects flat gate tools and pins auto", () => {
  const shaped = ensureResponsesFreeLaneShape({ input: [{ type: "message", role: "user", content: "hi" }] });
  assert.ok(shaped);
  assert.equal(shaped?.tool_choice, "auto");
  assert.deepEqual(shaped?.tools.map((tool) => tool.name), FREE_LANE_GATE_TOOL_NAMES);

  assert.equal(
    ensureResponsesFreeLaneShape({
      input: [],
      tools: [
        { type: "function", name: "bash", parameters: {} },
        { type: "function", name: "read", parameters: {} },
      ],
      tool_choice: "auto",
    }),
    undefined,
  );
  assert.equal(ensureResponsesFreeLaneShape({ messages: [] }), undefined);
});

test("the anonymous credential is the literal upstream marker", () => {
  assert.equal(ANONYMOUS_KEY, "public");
});
