import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  MODEL_DESCRIPTIONS,
  UNKNOWN_FREE_MODEL_DESCRIPTION,
  describeFreeModel,
  formatDescription,
  modelDescription,
} from "../src/model-descriptions.ts";
import { type ZenModelLike, selectFreeModels, synthesizeFreeModel } from "../src/free-models.ts";

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

test("every curated description has a summary and bestFor", () => {
  const ids = Object.keys(MODEL_DESCRIPTIONS);
  assert.ok(ids.length >= 10, "expected the free-model list to be curated");
  for (const id of ids) {
    const entry = MODEL_DESCRIPTIONS[id];
    assert.ok(entry.summary.length > 0, `${id} missing summary`);
    assert.ok(entry.bestFor.length > 0, `${id} missing bestFor`);
  }
});

test("modelDescription formats summary, use cases and caveats", () => {
  const text = modelDescription("mimo-v2.6-flash-free");
  assert.match(text!, /小米 MiMo V2\.6 Flash/);
  assert.match(text!, /适合：/);
  assert.match(text!, /⚠️/);
});

test("modelDescription omits notes when there are none", () => {
  assert.equal(formatDescription({ summary: "S", bestFor: "B" }), "S；适合：B");
});

test("modelDescription falls back to generic text for unknown -free ids", () => {
  assert.equal(modelDescription("brand-new-free"), UNKNOWN_FREE_MODEL_DESCRIPTION);
});

test("modelDescription returns undefined for unknown non-free ids", () => {
  assert.equal(modelDescription("mystery-model"), undefined);
});

test("describeFreeModel exposes the structured entry", () => {
  assert.equal(describeFreeModel("jev-1.13-free")?.summary.includes("Jev"), true);
  assert.equal(describeFreeModel("nope-free"), undefined);
});

test("selectFreeModels attaches descriptions to selected models", () => {
  const selected = selectFreeModels(["big-pickle"], [free]);
  assert.equal(selected[0].description, modelDescription("big-pickle"));
});

test("selectFreeModels keeps a description already present in the catalog", () => {
  const selected = selectFreeModels(["big-pickle"], [{ ...free, description: "kept" }]);
  assert.equal(selected[0].description, "kept");
});

test("selectFreeModels gives synthesized models the generic fallback", () => {
  const selected = selectFreeModels(["shiny-new-free"], []);
  assert.equal(selected[0].description, UNKNOWN_FREE_MODEL_DESCRIPTION);
});

test("synthesizeFreeModel carries the curated description when known", () => {
  const model = synthesizeFreeModel("ling-3.1-flash-free");
  assert.equal(model.description, modelDescription("ling-3.1-flash-free"));
});
