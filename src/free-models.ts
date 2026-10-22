/**
 * Discovery and selection of the free OpenCode Zen models.
 *
 * This module is intentionally free of `@earendil-works/pi-ai` imports so the
 * selection logic can be unit-tested with plain Node. Provider wiring lives in
 * `provider.ts`.
 */

import { PROVIDER_ID, ZEN_API_BASE_URL, ZEN_MODELS_URL } from "./constants.ts";

export interface ZenCost {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  [key: string]: unknown;
}

/**
 * Structural subset of a pi `Model` that the selection logic reads. Using a
 * structural type keeps this module decoupled from pi-ai.
 */
export interface ZenModelLike {
  id: string;
  name?: string;
  api: string;
  provider?: string;
  baseUrl?: string;
  reasoning?: boolean;
  input?: string[];
  cost?: ZenCost;
  contextWindow?: number;
  maxTokens?: number;
  type?: string;
  [key: string]: unknown;
}

export type FetchLike = (
  input: string | URL,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

/** A model is free when both input and output cost are zero (or omitted). */
export function isFreeModel(model: Pick<ZenModelLike, "cost">): boolean {
  const cost = model.cost ?? {};
  return (cost.input ?? 0) === 0 && (cost.output ?? 0) === 0;
}

/** Heuristic used for models that are live but missing from the bundled catalog. */
export function looksFreeById(id: string): boolean {
  return /free$/i.test(id);
}

/**
 * Known OpenCode Zen families that do not use the OpenAI chat-completions API.
 * Everything else falls back to chat completions, which is what the gateway
 * serves for the large majority of its models.
 */
const API_HINTS: ReadonlyArray<readonly [RegExp, string]> = [[/^muse-spark/i, "openai-responses"]];

/** Best-effort API id for a live model that the bundled catalog does not describe. */
export function inferZenApi(id: string): string {
  for (const [pattern, api] of API_HINTS) {
    if (pattern.test(id)) return api;
  }
  return "openai-completions";
}

/** `foo-1.2-flash-free` -> `Foo 1.2 Flash Free`. */
export function humanizeModelId(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => (part === "free" ? "Free" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

/**
 * Fetch the IDs that OpenCode Zen currently serves to this account/IP. The
 * endpoint does not require authentication. Throws when the request fails so
 * callers can keep their previous catalog.
 */
export async function fetchLiveModelIds(signal?: AbortSignal, fetchImpl: FetchLike = fetch): Promise<string[]> {
  const response = await fetchImpl(ZEN_MODELS_URL, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`OpenCode Zen model list request failed with HTTP ${response.status}`);
  }
  const body = (await response.json()) as { data?: Array<{ id?: unknown }> } | undefined;
  const data = Array.isArray(body?.data) ? body.data : [];
  return data
    .map((entry) => entry?.id)
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

export interface SelectFreeModelsOptions {
  providerId?: string;
  /** Live ids that must never be synthesized (for example non-chat classifiers). */
  excludeIds?: Iterable<string>;
}

/**
 * Select the free models to expose.
 *
 * Metadata comes from the bundled pi catalog; the live list decides which of
 * those models are currently reachable. A live model that is absent from the
 * catalog is kept only when its ID looks free (ends in `-free`) and it is not
 * excluded, and its API is inferred.
 */
export function selectFreeModels(
  liveIds: readonly string[],
  bundled: readonly ZenModelLike[],
  options: SelectFreeModelsOptions = {},
): ZenModelLike[] {
  const providerId = options.providerId ?? PROVIDER_ID;
  const excluded = new Set(options.excludeIds ?? []);
  const live = new Set(liveIds);
  const bundledById = new Map<string, ZenModelLike>();
  for (const model of bundled) {
    if (model && typeof model.id === "string") bundledById.set(model.id, model);
  }

  const selected: ZenModelLike[] = [];
  const seen = new Set<string>();

  for (const model of bundled) {
    if (!model || !live.has(model.id) || !isFreeModel(model)) continue;
    selected.push({ ...model, provider: providerId });
    seen.add(model.id);
  }

  for (const id of liveIds) {
    if (seen.has(id) || bundledById.has(id) || excluded.has(id)) continue;
    if (!looksFreeById(id)) continue;
    selected.push(synthesizeFreeModel(id, providerId));
    seen.add(id);
  }

  return selected.sort((a, b) => a.id.localeCompare(b.id));
}

/** Build a conservative definition for a live free model that is not in the catalog. */
export function synthesizeFreeModel(id: string, providerId: string = PROVIDER_ID): ZenModelLike {
  return {
    id,
    name: humanizeModelId(id),
    api: inferZenApi(id),
    provider: providerId,
    baseUrl: ZEN_API_BASE_URL,
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 131072,
    maxTokens: 32768,
    type: "chat",
  };
}
