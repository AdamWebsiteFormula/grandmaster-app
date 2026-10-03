import { Trans } from "@lingui/react/macro";

import { commands as openerCommands } from "@anlg/plugin-opener2";
import { Button } from "@anlg/ui/components/ui/button";

import { useTabs } from "~/store/zustand/tabs";

// Fork: judges never have to pay. Gemini API keys from Google AI Studio are
// free of charge on the free tier (ai.google.dev/gemini-api/docs/pricing).
const FREE_KEY_URL = "https://aistudio.google.com/apikey";

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
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground mt-4 text-sm underline underline-offset-4"
        onClick={() => void openerCommands.openUrl(FREE_KEY_URL, null)}
      >
        <Trans>No key? Get a free one from Google AI Studio</Trans>
      </button>
    </div>
  );
}
