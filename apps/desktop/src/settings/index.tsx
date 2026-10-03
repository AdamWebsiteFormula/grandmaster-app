import { useLingui } from "@lingui/react/macro";
import { useEffect } from "react";

import { CaretLeft } from "@anlg/ui/components/icons";
import { cn } from "@anlg/utils";

import {
  SettingsAccount,
  SettingsApp,
  SettingsMeetings,
  SettingsNotifications,
} from "./general";
import { SettingsTodo } from "./todo";

import { STT } from "~/settings/ai/stt";
import { SettingsCalendar } from "~/settings/calendar";
import { SettingsConnectors } from "~/settings/connectors";
import { SettingsCrm } from "~/settings/crm";
import { SettingsDevelopers } from "~/settings/developers";
import { SettingsDictation } from "~/settings/dictation";
import { SettingsBilling } from "~/settings/general/billing";
import { SettingsHydrationBoundary } from "~/settings/hydration-boundary";
import { SettingsImports } from "~/settings/imports";
import { SettingsPlan } from "~/settings/plan";
import { SettingsProfile } from "~/settings/profile";
import {
  isSettingsSection,
  isSettingsSubpage,
  scrollToSettingsSection,
  SETTINGS_SECTIONS,
  SETTINGS_SUBPAGES,
} from "~/settings/sections";
import { SettingsInsights } from "~/settings/stats";
import { SettingsSync } from "~/settings/sync";
import { SettingsTeam } from "~/settings/team";
import { StandardContentWrapper } from "~/shared/main";
import { type SettingsTab, type Tab, useTabs } from "~/store/zustand/tabs";

export function TabContentSettings({
  tab,
}: {
  tab: Extract<Tab, { type: "settings" }>;
}) {
  return (
    <StandardContentWrapper>
      <SettingsHydrationBoundary>
        <SettingsView tab={tab} />
      </SettingsHydrationBoundary>
    </StandardContentWrapper>
  );
}

function SettingsView({ tab }: { tab: Extract<Tab, { type: "settings" }> }) {
  const requestedTab = tab.state.tab as string | undefined;
  const legacyTab =
    requestedTab === "data"
      ? "imports"
      : requestedTab === "personalization"
        ? "dictionary"
        : requestedTab === "audio"
          ? "meetings"
          : (tab.state.tab ?? "app");
  // Fork: old ids for pages that became sections open the page that holds
  // them and scroll there (grandmaster/sops/settings-ia-oct3.md).
  const activeTab: string = isSettingsSection(legacyTab)
    ? SETTINGS_SECTIONS[legacyTab]
    : legacyTab;

  useEffect(() => scrollToSettingsSection(legacyTab), [legacyTab]);

  const renderContent = () => {
    switch (activeTab) {
      case "account":
        return <SettingsAccount />;
      case "billing":
        return <SettingsBilling />;
      // Fork: Upshot's own plan page (Free and Pro).
      case "plan":
        return <SettingsPlan />;
      // Fork: Granola's Profile, Calendar and Connectors pages, inside
      // Settings (granola-compare-oct3 section 8).
      case "profile":
        return <SettingsProfile />;
      case "calendars":
        return <SettingsCalendar />;
      case "connectors":
        return <SettingsConnectors />;
      case "stats":
      case "insights":
        return <SettingsInsights />;
      case "app":
        return <SettingsApp />;
      case "meetings":
        return <SettingsMeetings />;
      case "notifications":
        return <SettingsNotifications />;
      case "sync":
        return <SettingsSync />;
      case "team":
        return <SettingsTeam />;
      case "imports":
        return <SettingsImports />;
      case "crm":
        return <SettingsCrm />;
      case "developers":
        return <SettingsDevelopers />;
      case "dictation":
        return <SettingsDictation />;
      case "transcription":
        return <STT />;
      // Fork: the Intelligence page is hidden (Granola has none:
      // docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat);
      // a restored "intelligence" tab shows General.
      case "todo":
        return <SettingsTodo />;
      default:
        return <SettingsApp />;
    }
  };

  return (
    <div
      data-settings-content
      className="bg-card flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
    >
      <div className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden">
        <div
          className={cn([
            "scroll-fade-y scrollbar-hide h-full min-h-0 w-full min-w-0 overflow-x-hidden overflow-y-auto px-6 pt-6 pb-10",
          ])}
        >
          {/* Fork: one centered column about 680 px wide, as Granola's
              Settings (granola-compare-oct3 section 8; Baymard line length). */}
          <div className="mx-auto w-full max-w-[680px] min-w-0">
            {isSettingsSubpage(activeTab) ? (
              <SettingsBackButton parent={SETTINGS_SUBPAGES[activeTab]} />
            ) : null}
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

// Fork: a sub-page (Imports, Developers, Insights) opens from a row on its
// parent page, so it gets a back button, as macOS System Settings detail
// panes do (grandmaster/sops/settings-ia-oct3.md Q3).
function SettingsBackButton({ parent }: { parent: SettingsTab }) {
  const { t } = useLingui();
  const currentTab = useTabs((state) => state.currentTab);
  const updateSettingsTabState = useTabs(
    (state) => state.updateSettingsTabState,
  );
  const label = parent === "profile" ? t`Profile` : t`Connectors`;

  return (
    <button
      type="button"
      aria-label={t`Back to ${label}`}
      onClick={() => {
        if (currentTab?.type === "settings") {
          updateSettingsTabState(currentTab, { tab: parent });
        }
      }}
      className={cn([
        "text-muted-foreground hover:text-foreground mb-3 -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      ])}
    >
      <CaretLeft aria-hidden className="size-3.5" />
      {label}
    </button>
  );
}
