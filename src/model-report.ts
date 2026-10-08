/**
 * Builds the `/zen-models` report: one line per exposed free model with its
 * description.
 *
 * Dependency-free (no pi-ai) so it can be unit-tested with plain Node, like
 * `free-models.ts` and `model-descriptions.ts`. Wiring lives in the extension.
 */

import { PROVIDER_ID } from "./constants.ts";
import { UNKNOWN_FREE_MODEL_DESCRIPTION, modelDescription } from "./model-descriptions.ts";

/** Minimal shape of a catalog entry this report reads. */
export interface DescribableModel {
  id: string;
  provider?: string;
  description?: string;
}

/** `true` when the model belongs to the free provider (or has no provider set). */
export function isFreeProviderModel(model: DescribableModel, providerId: string = PROVIDER_ID): boolean {
  return model.provider === undefined || model.provider === providerId;
}

/**
 * Markdown bullet list: `- \`<id>\` — <description>`, sorted by id. Models
 * without a stored description fall back to the curated map, then to the
 * generic free-model text.
 */
export function buildModelReport(
  models: readonly DescribableModel[],
  providerId: string = PROVIDER_ID,
): string | undefined {
  const rows = models
    .filter((model) => isFreeProviderModel(model, providerId))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((model) => {
      const description = model.description ?? modelDescription(model.id) ?? UNKNOWN_FREE_MODEL_DESCRIPTION;
      return `- \`${model.id}\` — ${description}`;
    });
  return rows.length > 0 ? rows.join("\n") : undefined;
}
