import { Effect, pipe, Schema } from "effect";

import {
  DEFAULT_RESULT,
  extractMetadataMap,
  fetchJson,
  isDateSnapshot,
  isNonChatModel,
  isOldModel,
  type ListModelsResult,
  type ModelIgnoreReason,
  type ModelMetadata,
  partition,
  REQUEST_TIMEOUT,
  shouldIgnoreCommonKeywords,
  sortModelsByRecency,
} from "./list-common";
import { toReleaseDate } from "./model-catalog";

const OpenAIModelSchema = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      // Optional release and deprecation signals: OpenAI `created` and
      // `shutdown_date`, Groq `active` and `context_window`.
      created: Schema.optional(Schema.Unknown),
      shutdown_date: Schema.optional(Schema.Unknown),
      active: Schema.optional(Schema.Unknown),
      context_window: Schema.optional(Schema.Unknown),
    }),
  ),
});

type OpenAIModel = {
  id: string;
  created?: unknown;
  shutdown_date?: unknown;
  active?: unknown;
  context_window?: unknown;
};

const providerSignals = (model: OpenAIModel): ModelMetadata => ({
  releasedAt: toReleaseDate(model.created),
  deprecated:
    model.active === false ||
    (model.shutdown_date !== undefined && model.shutdown_date !== null) ||
    undefined,
  contextWindow:
    typeof model.context_window === "number" && model.context_window > 0
      ? model.context_window
      : undefined,
});

export async function listOpenAIModels(
  baseUrl: string,
  apiKey: string,
): Promise<ListModelsResult> {
  if (!baseUrl) {
    return DEFAULT_RESULT;
  }

  return pipe(
    fetchJson(`${baseUrl}/models`, { Authorization: `Bearer ${apiKey}` }),
    Effect.andThen((json) => Schema.decodeUnknown(OpenAIModelSchema)(json)),
    Effect.map(({ data }) => {
      const result = partition(
        data,
        (model) => {
          const reasons: ModelIgnoreReason[] = [];
          if (shouldIgnoreCommonKeywords(model.id)) {
            reasons.push("common_keyword");
          }
          if (isNonChatModel(model.id)) {
            reasons.push("not_chat_model");
          }
          if (isOldModel(model.id)) {
            reasons.push("old_model");
          }
          if (isDateSnapshot(model.id)) {
            reasons.push("date_snapshot");
          }
          return reasons.length > 0 ? reasons : null;
        },
        (model) => model.id,
      );

      return {
        models: sortModelsByRecency(result.models),
        ignored: result.ignored,
        metadata: extractMetadataMap(
          data,
          (model) => model.id,
          (model) => ({
            input_modalities: ["text", "image"],
            ...providerSignals(model),
          }),
        ),
      };
    }),
    Effect.timeout(REQUEST_TIMEOUT),
    Effect.catchAll(() => Effect.succeed(DEFAULT_RESULT)),
    Effect.runPromise,
  );
}

export async function listGenericModels(
  baseUrl: string,
  apiKey: string,
  options?: { filterDateSnapshots?: boolean },
): Promise<ListModelsResult> {
  if (!baseUrl) {
    return DEFAULT_RESULT;
  }

  return pipe(
    fetchJson(`${baseUrl}/models`, { Authorization: `Bearer ${apiKey}` }),
    Effect.andThen((json) => Schema.decodeUnknown(OpenAIModelSchema)(json)),
    Effect.map(({ data }) => processGenericModels(data, options)),
    Effect.timeout(REQUEST_TIMEOUT),
    Effect.catchAll(() => Effect.succeed(DEFAULT_RESULT)),
    Effect.runPromise,
  );
}

export function processGenericModels(
  data: readonly OpenAIModel[],
  options?: { filterDateSnapshots?: boolean },
): ListModelsResult {
  const result = partition(
    data,
    (model) => {
      const reasons: ModelIgnoreReason[] = [];
      if (shouldIgnoreCommonKeywords(model.id)) {
        reasons.push("common_keyword");
      }
      if (isNonChatModel(model.id)) {
        reasons.push("not_chat_model");
      }
      if (isOldModel(model.id)) {
        reasons.push("old_model");
      }
      if (options?.filterDateSnapshots !== false && isDateSnapshot(model.id)) {
        reasons.push("date_snapshot");
      }
      return reasons.length > 0 ? reasons : null;
    },
    (model) => model.id,
  );

  return {
    models: sortModelsByRecency(result.models),
    ignored: result.ignored,
    metadata: extractMetadataMap(
      data,
      (model) => model.id,
      (model) => ({ input_modalities: ["text"], ...providerSignals(model) }),
    ),
  };
}
