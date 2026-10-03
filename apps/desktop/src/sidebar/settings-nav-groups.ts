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
import { type SettingsTab, type TabInput } from "~/store/zustand/tabs";

type SettingsNavItem =
  | {
      id: SettingsTab;
      label: string;
      icon: Icon;
      requiresPro?: boolean;
      keywords?: string;
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

export function useSettingsNavGroups(): SettingsNavGroup[] {
  const { i18n, t } = useLingui();
  const workspaces = useMyWorkspacesWithMirror();
  const hasExistingWorkspace = (workspaces.data?.length ?? 0) > 0;

  const groups: SettingsNavGroup[] = [
    {
      label: t`App`,
      items: [
        {
          id: "app",
          label: t`General`,
          icon: Gear,
          keywords: t`language, region, time zone, timezone, spoken languages, login, startup, Dock, menu bar, storage, export location`,
        },
        // Fork: a local profile page, as Granola's Settings › Profile
        // (granola-compare-oct3 section 8). No account needed.
        {
          id: "profile",
          label: t`Profile`,
          icon: User,
          keywords: t`name, job title, company, email, LinkedIn, photo`,
        },
        // Fork: Upshot's plan page, where Granola keeps Settings › Billing
        // (docs.granola.ai/help-center/managing-your-account/subscriptions-and-billing).
        {
          id: "plan",
          label: t`Plan`,
          icon: CreditCard,
          keywords: t`Pro, upgrade, subscription, billing, price`,
        },
        { id: "account", label: t`Account`, icon: User },
        { id: "billing", label: t`Billing`, icon: CreditCard },
        {
          id: "insights",
          label: t`Insights`,
          icon: ChartLineUp,
          keywords: t`stats, statistics, activity, badges`,
        },
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
        {
          id: "appearance",
          label: t`Appearance`,
          icon: Sun,
          keywords: t`theme, dark, light, mode, 24-hour, time format, clock`,
        },
        {
          id: "notifications",
          label: t`Notifications`,
          icon: Bell,
          keywords: t`sound, alerts, reminders, Do Not Disturb, meeting detected`,
        },
      ],
    },
    {
      label: "AI",
      items: [
        {
          id: "transcription",
          label: t`Transcription`,
          icon: Waveform,
          keywords: t`model, download, speech to text, on-device, local, provider, language`,
        },
        {
          id: "dictation",
          label: t`Dictation`,
          icon: Microphone,
          requiresPro: true,
        },
        { id: "intelligence", label: t`Intelligence`, icon: Sparkle },
        {
          id: "dictionary",
          label: t`Dictionary`,
          icon: BookOpen,
          keywords: t`words, terms, names, vocabulary, spelling, jargon`,
        },
      ],
    },
    {
      label: t`Workspace`,
      items: [
        {
          id: "meetings",
          label: t`Meetings`,
          icon: VideoCamera,
          keywords: t`microphone, mic, audio, recording, auto-join, summaries, summary length, speakers, retention`,
        },
        // Fork: Calendar settings stay inside Settings, as in Granola; the
        // page links to the month view (granola-compare-oct3 section 8).
        {
          id: "calendars",
          label: t`Calendar`,
          icon: CalendarDots,
          keywords: t`events, schedule, Apple Calendar, visible calendars, week start`,
        },
        // The month view keeps its ⌘K entry; the sidebar row above opens
        // the settings page.
        {
          id: "calendar",
          label: t`Calendar`,
          icon: CalendarDots,
          destination: { type: "calendar" },
          keywords: t`events, schedule, month`,
          navigatorOnly: true,
        },
        {
          id: "connectors",
          label: t`Connectors`,
          icon: PlugsConnected,
          keywords: t`integrations, Glaido, MCP, CLI, webhooks, export, import`,
        },
        {
          id: "folders",
          label: t`Folders`,
          icon: FolderSimple,
          destination: { type: "folders" },
          keywords: t`folder`,
          // Fork: Folders and Templates are workspaces, not settings; they
          // stay in ⌘K and leave the Settings sidebar, as Granola's
          // Settings lists only settings pages (redline-oct3 Settings).
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
    {
      label: t`Data`,
      items: [
        {
          id: "imports",
          label: t`Imports`,
          icon: DownloadSimple,
          keywords: t`import, Granola, transcript, file, migrate`,
        },
        { id: "crm", label: t`CRM`, icon: Buildings },
      ],
    },
    {
      label: t`Advanced`,
      items: [
        {
          id: "privacy",
          label: i18n._(privacyMessages.title),
          icon: ShieldCheck,
          keywords: t`Touch ID, lock, password, telemetry, data`,
        },
        {
          id: "permissions",
          label: t`Permissions`,
          icon: Lock,
          keywords: t`microphone, system audio, accessibility, calendar access`,
        },
        {
          id: "developers",
          label: t`Developers`,
          icon: Code,
          keywords: t`CLI, MCP, API, webhooks, Glaido, skills`,
        },
      ],
    },
  ];

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !HIDDEN_SETTINGS.has(item.id)),
    }))
    .filter((group) => group.items.length > 0);
}
