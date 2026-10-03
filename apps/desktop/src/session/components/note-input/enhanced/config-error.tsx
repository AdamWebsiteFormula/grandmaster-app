import { Trans } from "@lingui/react/macro";

// Fork: Granola has no AI settings page or own keys; Upshot AI is always the
// model, so this only shows while it is not reachable
// (docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat).
export function ConfigError() {
  return (
    <div
      role="alert"
      className="flex h-full min-h-[400px] flex-col items-center justify-center px-6"
    >
      <div className="mb-6 flex max-w-md flex-col gap-2 text-center">
        <p className="text-base font-medium">
          <Trans>Upshot AI is getting ready</Trans>
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          <Trans>
            Try again in a minute to turn this transcript into a summary.
          </Trans>
        </p>
      </div>
    </div>
  );
}
