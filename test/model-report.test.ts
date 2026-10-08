import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PROVIDER_ID } from "../src/constants.ts";
import { buildModelReport, isFreeProviderModel } from "../src/model-report.ts";
import { modelDescription } from "../src/model-descriptions.ts";

test("isFreeProviderModel accepts our provider and provider-less entries", () => {
  assert.equal(isFreeProviderModel({ id: "a", provider: PROVIDER_ID }), true);
  assert.equal(isFreeProviderModel({ id: "a" }), true);
  assert.equal(isFreeProviderModel({ id: "a", provider: "other" }), false);
});

test("buildModelReport lists only our models, sorted, with descriptions", () => {
  const report = buildModelReport([
    { id: "ling-3.1-flash-free", provider: PROVIDER_ID },
    { id: "alpha-free", provider: PROVIDER_ID, description: "自定义描述" },
    { id: "claude-sonnet-5", provider: "opencode" },
  ]);
  assert.ok(report);
  const lines = report.split("\n");
  assert.equal(lines.length, 2);
  assert.equal(lines[0], "- `alpha-free` — 自定义描述");
  assert.equal(lines[1], `- \`ling-3.1-flash-free\` — ${modelDescription("ling-3.1-flash-free")}`);
  assert.doesNotMatch(report, /claude-sonnet-5/);
});

test("buildModelReport falls back to the generic text for unknown free models", () => {
  const report = buildModelReport([{ id: "shiny-new-free", provider: PROVIDER_ID }]);
  assert.match(report!, /shiny-new-free` — OpenCode Zen 限时免费模型/);
});

test("buildModelReport returns undefined when nothing matches", () => {
  assert.equal(buildModelReport([]), undefined);
  assert.equal(buildModelReport([{ id: "x", provider: "other" }]), undefined);
});
