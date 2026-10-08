/**
 * Streams pi-ai requests through the OpenCode Zen anonymous free lane.
 *
 * Wraps a pi-ai `ProviderStreams` implementation so every request carries the
 * CLI-shaped correlation headers, the canonical derived session id, and the
 * free-lane body gate (see `free-lane.ts`). Per-request ids are derived from
 * the transcript, so one conversation keeps a stable upstream affinity.
 */

import type { Model, ProviderStreams, SimpleStreamOptions, StreamOptions, TranscriptContext } from "@earendil-works/pi-ai";
import {
  ANONYMOUS_KEY,
  type MessageLike,
  deriveRequestIDs,
  disguiseHeaders,
  ensureFreeLaneShape,
  ensureResponsesFreeLaneShape,
  opencodeUserAgent,
} from "./free-lane.ts";

function conversationTranscript(context: TranscriptContext): readonly MessageLike[] {
  return Array.isArray(context?.messages) ? (context.messages as unknown as MessageLike[]) : [];
}

function wireOptions(
  model: Model,
  context: TranscriptContext,
  options: (StreamOptions | SimpleStreamOptions) | undefined,
): (StreamOptions | SimpleStreamOptions) & Record<string, unknown> {
  const messages = conversationTranscript(context);
  const ids = deriveRequestIDs(messages, options?.sessionId);
  const callerHeaders = Object.fromEntries(
    Object.entries(Object(options?.headers ?? {})).filter(([, value]) => typeof value === "string"),
  ) as Record<string, string>;
  const payloadHook =
    model.api === "openai-responses"
      ? (payload: unknown) => ensureResponsesFreeLaneShape(payload) ?? payload
      : (payload: unknown) => ensureFreeLaneShape(payload) ?? payload;
  return {
    ...options,
    apiKey: ANONYMOUS_KEY,
    maxRetries: 0,
    // pi injects its own attribution headers (its session uuid +
    // x-opencode-client: pi) into options.headers before this wrapper runs,
    // and the free lane rejects any x-opencode-session that is not the
    // canonical OpenCode shape. The correlation set must therefore win here;
    // everything else the caller set still passes through.
    headers: { ...callerHeaders, ...disguiseHeaders(ids, opencodeUserAgent()) },
    onPayload: payloadHook,
  };
}

/**
 * Wrap a pi-ai ProviderStreams implementation (chat-completions or responses)
 * so its `stream` and `streamSimple` calls pass through the free lane.
 */
export function withFreeLane(streams: ProviderStreams): ProviderStreams {
  return {
    ...streams,
    stream: (model, context, options) => streams.stream(model, context, wireOptions(model, context, options) as StreamOptions),
    streamSimple: (model, context, options) =>
      streams.streamSimple(model, context, wireOptions(model, context, options) as SimpleStreamOptions),
  };
}
