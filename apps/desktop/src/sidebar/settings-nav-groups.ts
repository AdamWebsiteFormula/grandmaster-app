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
    }
  | {
      id: "automations" | "calendar" | "contacts" | "folders" | "templates";
      label: string;
      icon: Icon;
      destination: TabInput;
      requiresPro?: boolean;
    };

export type SettingsNavGroup = { label: string; items: SettingsNavItem[] };

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
        { id: "app", label: t`General`, icon: Gear },
        { id: "account", label: t`Account`, icon: User },
        { id: "billing", label: t`Billing`, icon: CreditCard },
        { id: "insights", label: t`Insights`, icon: ChartLineUp },
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
        { id: "appearance", label: t`Appearance`, icon: Sun },
        { id: "notifications", label: t`Notifications`, icon: Bell },
      ],
    },
    {
      label: "AI",
      items: [
        { id: "transcription", label: t`Transcription`, icon: Waveform },
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
          requiresPro: true,
        },
      ],
    },
    {
      label: t`Workspace`,
      items: [
        { id: "meetings", label: t`Meetings`, icon: VideoCamera },
        {
          id: "folders",
          label: t`Folders`,
          icon: FolderSimple,
          destination: { type: "folders" },
        },
        {
          id: "calendar",
          label: t`Calendar`,
          icon: CalendarDots,
          destination: { type: "calendar" },
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
        { id: "imports", label: t`Imports`, icon: DownloadSimple },
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
        },
        { id: "permissions", label: t`Permissions`, icon: Lock },
        { id: "developers", label: t`Developers`, icon: Code },
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
