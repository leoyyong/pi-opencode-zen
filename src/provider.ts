/**
 * Builds the `opencode-zen-free` provider.
 *
 * The provider is anonymous: OpenCode Zen's free lane accepts only keyless
 * requests that carry the OpenCode CLI shape (see `free-lane.ts`). Models are
 * discovered from the live `/zen/v1/models` listing and described with pi's
 * bundled OpenCode catalog.
 */

import {
  type Api,
  type ApiKeyAuth,
  type Model,
  type Provider,
  type RefreshModelsContext,
  createProvider,
  openAICompletionsApi,
  openAIResponsesApi,
} from "@earendil-works/pi-ai";
import { getBuiltinClassifierModels, getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import { PROVIDER_ID, PROVIDER_NAME, ZEN_ORIGIN } from "./constants.ts";
import { fetchLiveModelIds, selectFreeModels, type ZenModelLike } from "./free-models.ts";
import { withFreeLane } from "./zen-stream.ts";

/**
 * Anonymous credential. `check` always reports the provider as configured so
 * the free models stay selectable in `/model` without a login. pi-ai
 * forwards the resolved key per request; the free lane treats it as keyless.
 */
const anonymousAuth: ApiKeyAuth = {
  name: "OpenCode Zen (anonymous free lane)",
  check: async () => ({ type: "api_key", source: "anonymous free lane" }),
  resolve: async () => ({ auth: { apiKey: "public" }, source: "anonymous free lane" }),
};

function bundledOpenCodeModels(): ZenModelLike[] {
  return getBuiltinModels("opencode") as unknown as ZenModelLike[];
}

/** Classifier models are not selectable in `/model` and must not be exposed as chat models. */
function bundledClassifierIds(): string[] {
  try {
    return getBuiltinClassifierModels("opencode").map((model) => model.id);
  } catch {
    return [];
  }
}

/**
 * Fetch the current free-model list. When the network is unreachable on the
 * very first run (no cached catalog), fall back to the bundled free models so
 * the provider is not empty; a later successful refresh replaces that list.
 */
async function fetchFreeModels(context): Promise<Model<Api>[]> {
  const bundled = bundledOpenCodeModels();
  const excludeIds = bundledClassifierIds();
  try {
    const liveIds = await fetchLiveModelIds(context.signal);
    return selectFreeModels(liveIds, bundled, { excludeIds }) as unknown as Model<Api>[];
  } catch (error) {
    if (!context.stored?.models?.length) {
      const fallback = selectFreeModels(
        bundled.map((model) => model.id),
        bundled,
        { excludeIds },
      );
      return fallback as unknown as Model<Api>[];
    }
    throw error;
  }
}

export function createOpenCodeZenFreeProvider(): Provider {
  return createProvider({
    id: PROVIDER_ID,
    name: PROVIDER_NAME,
    baseUrl: ZEN_ORIGIN,
    auth: { apiKey: anonymousAuth },
    // The live list is authoritative; an empty baseline avoids showing stale
    // models that OpenCode Zen no longer serves.
    models: [],
    // The free lane is OpenAI-compatible. muse-spark-* additionally need the
    // Responses API (a chat-completions call returns a bare 500 there).
    api: {
      "openai-completions": withFreeLane(openAICompletionsApi()),
      "openai-responses": withFreeLane(openAIResponsesApi()),
    },
    fetchModels: fetchFreeModels,
  });
}
