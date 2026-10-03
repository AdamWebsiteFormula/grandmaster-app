import { Trans } from "@lingui/react/macro";

import { ConfigureProviders } from "./configure";
import { SttSettingsProvider } from "./context";
import { SelectProviderAndModel } from "./select";

import { DictionarySection } from "~/settings/dictionary";
import { SettingsPageTitle } from "~/settings/page-title";

export function STT() {
  return (
    <SttSettingsProvider>
      <div className="flex flex-col gap-6">
        <SettingsPageTitle
          title={<Trans>Transcription</Trans>}
          description={
            <Trans>
              The model that turns speech into text, and the words it should
              know.
            </Trans>
          }
        />
        <SelectProviderAndModel />
        <ConfigureProviders />
        {/* Fork: Dictionary moved here from its own page
            (grandmaster/sops/settings-ia-oct3.md Q3). */}
        <DictionarySection />
      </div>
    </SttSettingsProvider>
  );
}
