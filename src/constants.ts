/**
 * Shared constants for the OpenCode Zen free-models provider.
 *
 * OpenCode Zen lives under `https://opencode.ai/zen`. Its OpenAI-compatible model
 * list is served from `/v1/models`; individual OpenAI-compatible endpoints live
 * under `/v1`.
 */

export const PROVIDER_ID = "opencode-zen-free";
export const PROVIDER_NAME = "OpenCode Zen Free";

/** Origin of the OpenCode Zen gateway. */
export const ZEN_ORIGIN = "https://opencode.ai/zen";

/** Base URL used for synthesized model definitions (the OpenAI-compatible API root). */
export const ZEN_API_BASE_URL = "https://opencode.ai/zen/v1";

/** Endpoint that lists the models currently available through this gateway. */
export const ZEN_MODELS_URL = "https://opencode.ai/zen/v1/models";

/** Extension version, kept in sync with package.json. */
export const VERSION = "0.1.0";
