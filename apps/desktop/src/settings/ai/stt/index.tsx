import { Trans } from "@lingui/react/macro";

import { SttSettingsProvider } from "./context";
import { SelectProviderAndModel } from "./select";

import { DictionarySection } from "~/settings/dictionary";
import { SettingsPageTitle } from "~/settings/page-title";

export function STT() {
  return (
    <SttSettingsProvider>
      {/* Fork: gap-8 between sections, as every other Settings page. */}
      <div className="flex flex-col gap-8">
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
        {/* Fork: no cloud provider cards or API key fields. Blueprint
            section 5: "Apple Speech and Soniqo local; hide the cloud ones".
            Granola has no bring-your-own-key either. The picker above still
            lists the built-in local options. */}
        {/* Fork: Dictionary moved here from its own page
            (grandmaster/sops/settings-ia-oct3.md Q3). */}
        <DictionarySection />
      </div>
    </SttSettingsProvider>
  );
}
