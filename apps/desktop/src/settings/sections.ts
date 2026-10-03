// Fork: the Settings structure of Oct 3 (grandmaster/sops/settings-ia-oct3.md).
// Fewer sidebar pages, as Granola's Settings and Apple HIG "Minimize the
// number of settings". Old tab ids keep working: a moved section opens its
// new page and scrolls to it; a sub-page opens as before with its parent
// page marked in the sidebar.
import type { SettingsTab } from "~/store/zustand/tabs";

/** Old pages that are now a section inside another page. */
export const SETTINGS_SECTIONS = {
  appearance: "app",
  privacy: "app",
  permissions: "app",
  dictionary: "transcription",
} as const satisfies Partial<Record<SettingsTab, SettingsTab>>;

/** Pages opened from a row on a parent page, not from the sidebar. */
export const SETTINGS_SUBPAGES = {
  imports: "connectors",
  developers: "connectors",
  insights: "profile",
  stats: "profile",
} as const satisfies Partial<Record<SettingsTab, SettingsTab>>;

type SectionTab = keyof typeof SETTINGS_SECTIONS;
type SubpageTab = keyof typeof SETTINGS_SUBPAGES;

export function isSettingsSection(tab: string): tab is SectionTab {
  return Object.prototype.hasOwnProperty.call(SETTINGS_SECTIONS, tab);
}

export function isSettingsSubpage(tab: string): tab is SubpageTab {
  return Object.prototype.hasOwnProperty.call(SETTINGS_SUBPAGES, tab);
}

/** The sidebar page a tab id belongs to. */
export function settingsNavPage(tab: string): string {
  if (tab === "audio") return "meetings";
  if (isSettingsSection(tab)) return SETTINGS_SECTIONS[tab];
  if (isSettingsSubpage(tab)) return SETTINGS_SUBPAGES[tab];
  return tab;
}

export function settingsSectionId(tab: SectionTab): string {
  return `settings-section-${tab}`;
}

/**
 * Scrolls a moved section into view once its page has rendered. Pages that
 * load settings first render a spinner, so this retries for about a second.
 */
export function scrollToSettingsSection(tab: string): () => void {
  if (!isSettingsSection(tab) || typeof document === "undefined") {
    return () => {};
  }
  let tries = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const attempt = () => {
    const element = document.getElementById(settingsSectionId(tab));
    if (element) {
      element.scrollIntoView?.({ block: "start", behavior: "smooth" });
      return;
    }
    tries += 1;
    if (tries < 20) timer = setTimeout(attempt, 50);
  };
  attempt();
  return () => {
    if (timer) clearTimeout(timer);
  };
}
