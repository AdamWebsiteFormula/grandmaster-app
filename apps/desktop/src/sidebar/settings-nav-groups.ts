import { useLingui } from "@lingui/react/macro";

import {
  ArrowsClockwise,
  Bell,
  BookOpen,
  Buildings,
  CalendarDots,
  ChartLineUp,
  Code,
  CreditCard,
  DownloadSimple,
  FileText,
  FolderSimple,
  Gear,
  Lightning,
  type Icon,
  Lock,
  Microphone,
  PlugsConnected,
  ShieldCheck,
  Sparkle,
  Sun,
  User,
  Users,
  UsersThree,
  VideoCamera,
  Waveform,
} from "@anlg/ui/components/icons";

import { privacyMessages } from "~/settings/general/app-settings";
import { useMyWorkspacesWithMirror } from "~/settings/team/mirror";
import { isMac } from "~/shared/shortcut-label";
import { type SettingsTab, type TabInput } from "~/store/zustand/tabs";

type SettingsNavItem =
  | {
      id: SettingsTab;
      label: string;
      icon: Icon;
      requiresPro?: boolean;
      keywords?: string;
      /**
       * A section or sub-page of this page (settings/sections.ts). It shows
       * in the sidebar only while searching, and in the ⌘K navigator.
       */
      parent?: SettingsTab;
    }
  | {
      id: "automations" | "calendar" | "contacts" | "folders" | "templates";
      label: string;
      icon: Icon;
      destination: TabInput;
      requiresPro?: boolean;
      keywords?: string;
      /** Listed in the ⌘K navigator only, not in the Settings sidebar. */
      navigatorOnly?: boolean;
    };

export type SettingsNavGroup = { label: string; items: SettingsNavItem[] };

// Fork: search matches what is inside a page, not only its name, as macOS
// System Settings search does (ux-audit-oct3 E, HIG search fields).
export function settingsNavItemMatches(
  item: { label: string; keywords?: string },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (item.label.toLowerCase().includes(needle)) return true;
  return (item.keywords ?? "")
    .split(",")
    .some((keyword) => keyword.trim().toLowerCase().includes(needle));
}

// Fork (blueprint section 5): hide cloud, account and plan screens a judge
// cannot use. UI only; the screens and their code stay in place.
const HIDDEN_SETTINGS = new Set<string>([
  "account",
  "billing",
  "team",
  "sync",
  "dictation",
  "automations",
  "crm",
  "contacts",
  // Fork: Granola has no AI settings page and no bring-your-own-key; the
  // model is "Auto", and Pro picks one in the chat composer
  // (docs.granola.ai/help-center/getting-more-from-your-notes/understanding-model-selection-in-granola-chat).
  "intelligence",
]);

// Fork: Upshot reads calendars from the Mac's Calendar only, so off a Mac the
// Calendar page and the month view are hidden (NN/g heuristic #5, error
// prevention).
const MAC_ONLY_SETTINGS = new Set<string>(["calendars", "calendar"]);

export function useSettingsNavGroups(): SettingsNavGroup[] {
  const { i18n, t } = useLingui();
  const workspaces = useMyWorkspacesWithMirror();
  const hasExistingWorkspace = (workspaces.data?.length ?? 0) > 0;
  // Fork: off a Mac, no search word leads to a Mac-only row or names the
  // Mac (NN/g heuristic #5, error prevention).
  const mac = isMac();

  // Fork: eight sidebar pages instead of fifteen (grandmaster/sops/
  // settings-ia-oct3.md Q3): Granola's Settings lists Preferences, Profile,
  // Calendar, Notifications, Connectors; Apple HIG "Settings" asks for few,
  // logically grouped settings. Moved pages stay as search and ⌘K entries
  // with a parent, so their old tab ids and keywords keep working.
  const groups: SettingsNavGroup[] = [
    {
      label: t`App`,
      items: [
        {
          id: "app",
          label: t`General`,
          icon: Gear,
          keywords: mac
            ? t`preferences, language, region, time zone, timezone, spoken languages, login, startup, Dock, menu bar, storage, export location`
            : t`preferences, language, region, time zone, timezone, spoken languages, login, startup, tray icon, storage, export location`,
        },
        {
          id: "appearance",
          label: t`Appearance`,
          icon: Sun,
          keywords: mac
            ? t`theme, dark, light, mode, Match my Mac, 24-hour, time format, clock`
            : t`theme, dark, light, mode, Use system setting, 24-hour, time format, clock`,
          parent: "app",
        },
        {
          id: "privacy",
          label: i18n._(privacyMessages.title),
          icon: ShieldCheck,
          keywords: t`Touch ID, lock, password, telemetry, data`,
          parent: "app",
        },
        {
          id: "permissions",
          label: t`Permissions`,
          icon: Lock,
          keywords: t`microphone, system audio, accessibility, calendar access`,
          parent: "app",
        },
        // Fork: a local profile page, as Granola's Settings › Profile
        // (granola-compare-oct3 section 8). No account needed.
        {
          id: "profile",
          label: t`Profile`,
          icon: User,
          // Fork: account words find Profile (journey-account-settings P2;
          // macOS System Settings matches controls inside each page).
          keywords: t`name, job title, company, email, LinkedIn, photo, account, sign in, sign out, log in, log out, delete account`,
        },
        // Fork: stats are not settings and Granola's Settings has none, so
        // Insights opens from Profile.
        {
          id: "insights",
          label: t`Insights`,
          icon: ChartLineUp,
          keywords: t`stats, statistics, activity, badges`,
          parent: "profile",
        },
        // Fork: Upshot's plan page, where Granola keeps Settings › Billing
        // (docs.granola.ai/help-center/managing-your-account/subscriptions-and-billing).
        {
          id: "plan",
          label: t`Plan`,
          icon: CreditCard,
          keywords: t`Pro, upgrade, subscription, billing, price, cancel, manage subscription, invoice, receipt, payment, card, monthly, yearly, usage`,
        },
        { id: "account", label: t`Account`, icon: User },
        { id: "billing", label: t`Billing`, icon: CreditCard },
        {
          id: "team",
          label: t`Teams`,
          icon: UsersThree,
          requiresPro: !workspaces.isLoading && !hasExistingWorkspace,
        },
        {
          id: "sync",
          label: t`Sync`,
          icon: ArrowsClockwise,
          requiresPro: true,
        },
      ],
    },
    {
      label: t`Meetings`,
      items: [
        {
          id: "meetings",
          label: t`Meetings`,
          icon: VideoCamera,
          keywords: t`microphone, mic, audio, recording, auto-join, summaries, summary length, speakers, retention, floating bar, auto stop, disclosure, notice, meeting chat`,
        },
        {
          id: "transcription",
          label: t`Transcription`,
          icon: Waveform,
          keywords: t`model, download, speech to text, on-device, local, provider, language`,
        },
        {
          id: "dictionary",
          label: t`Dictionary`,
          icon: BookOpen,
          keywords: t`words, terms, names, vocabulary, spelling, jargon`,
          parent: "transcription",
        },
        {
          id: "dictation",
          label: t`Dictation`,
          icon: Microphone,
          requiresPro: true,
        },
        { id: "intelligence", label: t`Intelligence`, icon: Sparkle },
        // Fork: Calendar settings stay inside Settings, as in Granola; the
        // page links to the month view (granola-compare-oct3 section 8).
        // It reads every account in the Mac's Calendar, so people find it
        // by those names too.
        {
          id: "calendars",
          label: t`Calendar`,
          icon: CalendarDots,
          keywords: t`events, schedule, Google, Outlook, iCloud, Apple Calendar, visible calendars, week start`,
        },
        {
          id: "notifications",
          label: t`Notifications`,
          icon: Bell,
          // Fork: no "sound" keyword; Upshot has no sound settings. Off a Mac
          // there is no Do Not Disturb row, no event reminder, and the
          // taskbar button flashes instead of a Dock bounce.
          keywords: mac
            ? t`alerts, reminders, Do Not Disturb, meeting detected, bounce`
            : t`alerts, meeting detected, taskbar, flash`,
        },
        {
          id: "connectors",
          label: t`Connectors`,
          icon: PlugsConnected,
          keywords: mac
            ? t`integrations, Glaido, MCP, CLI, webhooks, export, import`
            : t`integrations, MCP, CLI, webhooks, export, import`,
        },
        {
          id: "imports",
          label: t`Imports`,
          icon: DownloadSimple,
          keywords: t`import, Granola, transcript, file, migrate`,
          parent: "connectors",
        },
        {
          id: "developers",
          label: t`Developers`,
          icon: Code,
          keywords: mac
            ? t`CLI, MCP, API, webhooks, Glaido, skills`
            : t`CLI, MCP, API, webhooks, skills`,
          parent: "connectors",
        },
        { id: "crm", label: t`CRM`, icon: Buildings },
      ],
    },
    {
      // Fork: workspaces, not settings. They stay in ⌘K and out of the
      // Settings sidebar, as Granola's Settings lists only settings pages
      // (redline-oct3 Settings).
      label: t`Workspace`,
      items: [
        // The month view keeps its ⌘K entry; the Calendar row above opens
        // the settings page. Fork: its own name, so ⌘K never shows two
        // identical "Calendar" rows (WCAG 2.2 SC 2.4.6).
        {
          id: "calendar",
          label: t`Calendar month view`,
          icon: CalendarDots,
          destination: { type: "calendar" },
          keywords: t`events, schedule, month`,
          navigatorOnly: true,
        },
        {
          id: "folders",
          label: t`Folders`,
          icon: FolderSimple,
          destination: { type: "folders" },
          keywords: t`folder`,
          navigatorOnly: true,
        },
        {
          id: "contacts",
          label: t`Contacts`,
          icon: Users,
          destination: { type: "contacts" },
        },
        {
          id: "templates",
          label: t`Templates`,
          icon: FileText,
          destination: { type: "templates" },
          keywords: t`template, format`,
          navigatorOnly: true,
        },
        {
          id: "automations",
          label: t`Automations`,
          icon: Lightning,
          destination: { type: "automations" },
          requiresPro: true,
        },
      ],
    },
  ];

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !HIDDEN_SETTINGS.has(item.id) &&
          (mac || !MAC_ONLY_SETTINGS.has(item.id)),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
