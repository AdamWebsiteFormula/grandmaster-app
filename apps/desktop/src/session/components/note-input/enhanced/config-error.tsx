import { Trans } from "@lingui/react/macro";

import { Button } from "@anlg/ui/components/ui/button";

import { useTabs } from "~/store/zustand/tabs";

export function ConfigError() {
  const openNew = useTabs((state) => state.openNew);

  return (
    <div
      role="alert"
      className="flex h-full min-h-[400px] flex-col items-center justify-center px-6"
    >
      <div className="mb-6 flex max-w-md flex-col gap-2 text-center">
        <p className="text-base font-medium">
          <Trans>Choose an AI model</Trans>
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          <Trans>
            Pick a model in Settings to turn this transcript into a summary.
          </Trans>
        </p>
      </div>
      {/* Fork: billing is hidden, so the only path is choosing a model. */}
      <Button
        className="shadow-none"
        onClick={() =>
          openNew({ type: "settings", state: { tab: "intelligence" } })
        }
      >
        <Trans>Choose a model</Trans>
      </Button>
    </div>
  );
}
