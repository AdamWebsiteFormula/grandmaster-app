export type BatchResumeContext = {
  promotion: "whole_session";
  provider?: string;
  model?: string;
};

export function serializeBatchResumeContext(context: BatchResumeContext) {
  return JSON.stringify(context);
}

export function parseBatchResumeContext(
  value: string | null | undefined,
): BatchResumeContext | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("promotion" in parsed) ||
      parsed.promotion !== "whole_session"
    ) {
      return null;
    }
    const provider =
      "provider" in parsed && typeof parsed.provider === "string"
        ? parsed.provider
        : undefined;
    const model =
      "model" in parsed && typeof parsed.model === "string"
        ? parsed.model
        : undefined;
    return { promotion: "whole_session", provider, model };
  } catch {
    return null;
  }
}
