import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  type ZenModelLike,
  fetchLiveModelIds,
  humanizeModelId,
  inferZenApi,
  isFreeModel,
  looksFreeById,
  selectFreeModels,
} from "../src/free-models.ts";

const paid: ZenModelLike = {
  id: "claude-sonnet-5",
  name: "Claude Sonnet 5",
  api: "anthropic-messages",
  provider: "opencode",
  baseUrl: "https://opencode.ai/zen",
  cost: { input: 3, output: 15 },
  contextWindow: 200000,
  maxTokens: 64000,
  type: "chat",
};

const free: ZenModelLike = {
  id: "big-pickle",
  name: "Big Pickle",
  api: "openai-completions",
  provider: "opencode",
  baseUrl: "https://opencode.ai/zen/v1",
  cost: { input: 0, output: 0 },
  reasoning: true,
  input: ["text"],
  contextWindow: 200000,
  maxTokens: 32000,
  type: "chat",
};

const freeNotPaidOutput: ZenModelLike = {
  ...free,
  id: "jev-1.13",
  name: "Jev 1.13",
  cost: { input: 0.042, output: 0 },
};

test("isFreeModel requires zero (or missing) input and output cost", () => {
  assert.equal(isFreeModel(free), true);
  assert.equal(isFreeModel(paid), false);
  assert.equal(isFreeModel(freeNotPaidOutput), false);
  assert.equal(isFreeModel({ cost: {} }), true);
  assert.equal(isFreeModel({}), true);
});

test("looksFreeById matches the -free naming convention", () => {
  assert.equal(looksFreeById("ling-3.1-flash-free"), true);
  assert.equal(looksFreeById("nexus-free"), true);
  assert.equal(looksFreeById("big-pickle"), false);
  assert.equal(looksFreeById("free-range-model"), false);
});

test("humanizeModelId produces a readable label", () => {
  assert.equal(humanizeModelId("ling-3.1-flash-free"), "Ling 3.1 Flash Free");
  assert.equal(humanizeModelId("big-pickle"), "Big Pickle");
});

test("selectFreeModels keeps only live, free, bundled models and rebinds the provider", () => {
  const selected = selectFreeModels(["big-pickle", "claude-sonnet-5"], [free, paid]);
  assert.deepEqual(
    selected.map((model) => model.id),
    ["big-pickle"],
  );
  assert.equal(selected[0].provider, "opencode-zen-free");
  assert.equal(selected[0].api, "openai-completions");
  assert.equal(selected[0].cost?.input, 0);
});

test("selectFreeModels drops bundled free models that are not live", () => {
  const selected = selectFreeModels([], [free, paid]);
  assert.deepEqual(selected, []);
});

test("selectFreeModels synthesizes live -free models missing from the catalog", () => {
  const selected = selectFreeModels(["new-model-free"], [free, paid]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, "new-model-free");
  assert.equal(selected[0].name, "New Model Free");
  assert.equal(selected[0].api, "openai-completions");
  assert.equal(selected[0].provider, "opencode-zen-free");
  assert.equal(selected[0].baseUrl, "https://opencode.ai/zen/v1");
});

test("selectFreeModels ignores live models that are neither bundled nor look free", () => {
  const selected = selectFreeModels(["mystery-model"], [free, paid]);
  assert.deepEqual(selected, []);
});

test("inferZenApi maps known response families and defaults to chat completions", () => {
  assert.equal(inferZenApi("muse-spark-1.2-contributor-free"), "openai-responses");
  assert.equal(inferZenApi("mystery-model-free"), "openai-completions");
});

test("selectFreeModels applies the API hint to synthesized models", () => {
  const selected = selectFreeModels(["muse-spark-9-contributor-free"], [free, paid]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].api, "openai-responses");
});

test("selectFreeModels excludes known non-chat models", () => {
  const selected = selectFreeModels(["jev-1.13-free"], [free, paid], { excludeIds: ["jev-1.13-free"] });
  assert.deepEqual(selected, []);
});

test("selectFreeModels sorts by id and de-duplicates", () => {
  const selected = selectFreeModels(
    ["zeta-free", "alpha-free"],
    [
      { ...free, id: "alpha-free", name: "Alpha Free" },
      { ...free, id: "zeta-free", name: "Zeta Free" },
    ],
  );
  assert.deepEqual(
    selected.map((model) => model.id),
    ["alpha-free", "zeta-free"],
  );
});

test("fetchLiveModelIds reads and validates the OpenAI-style list", async () => {
  const ids = await fetchLiveModelIds(undefined, async () => ({
    ok: true,
    status: 200,
    json: async () => ({ object: "list", data: [{ id: "big-pickle" }, { id: "ling-3.1-flash-free" }, {}, { id: "" }] }),
  }));
  assert.deepEqual(ids, ["big-pickle", "ling-3.1-flash-free"]);
});

test("fetchLiveModelIds throws on a non-ok response", async () => {
  await assert.rejects(
    () =>
      fetchLiveModelIds(undefined, async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      })),
    /HTTP 503/,
  );
});
