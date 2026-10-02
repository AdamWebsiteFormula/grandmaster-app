// Keep in sync with ANARLOG_PRO_OPENROUTER_STT_MODELS in crates/owhisper-client.
export const ANARLOG_PRO_OPENROUTER_STT_MODELS = [
  "openai/gpt-transcribe",
  "deepgram/nova-3",
  "microsoft/mai-transcribe-2",
  "mistralai/voxtral-mini-transcribe",
  "google/chirp-3",
] as const;

export function isAnarlogProOpenRouterSttModel(
  provider?: string | null,
  model?: string | null,
) {
  return (
    provider === "anarlog" &&
    (ANARLOG_PRO_OPENROUTER_STT_MODELS as readonly string[]).includes(
      model ?? "",
    )
  );
}
