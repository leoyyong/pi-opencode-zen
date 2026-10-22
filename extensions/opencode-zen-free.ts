/**
 * OpenCode Zen Free — a pi extension.
 *
 * Exposes OpenCode Zen's free models as a dedicated, dynamically refreshed
 * provider (`opencode-zen-free`). The provider's model list is refreshed in the
 * background at every pi startup; press Ctrl+Shift+R to force a refresh.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import { PROVIDER_ID, PROVIDER_NAME } from "../src/constants.ts";
import { createOpenCodeZenFreeProvider } from "../src/provider.ts";

async function refreshZenModels(ctx: ExtensionContext): Promise<void> {
  const result = await ctx.modelRegistry.refresh({ providers: [PROVIDER_ID], force: true });
  const count = ctx.modelRegistry.getAll().filter((model) => model.provider === PROVIDER_ID).length;
  const error = result.errors.get(PROVIDER_ID);
  if (error) {
    ctx.ui.notify(
      `${PROVIDER_NAME}: refresh failed (${error.message}); keeping ${count} cached model${count === 1 ? "" : "s"}`,
      "error",
    );
    return;
  }
  ctx.ui.notify(`${PROVIDER_NAME}: ${count} free model${count === 1 ? "" : "s"} updated`, "info");
}

export default function openCodeZenFree(pi: ExtensionAPI): void {
  pi.registerProvider(createOpenCodeZenFreeProvider());

  pi.registerShortcut(Key.ctrlShift("r"), {
    description: `Refresh ${PROVIDER_NAME} models`,
    handler: refreshZenModels,
  });

  pi.registerCommand("opencode-zen-free", {
    description: `Refresh ${PROVIDER_NAME} models`,
    handler: (_args, ctx) => refreshZenModels(ctx),
  });
}
