import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Esc from the settings search, end to end: the real SettingsNav, the real
// main Escape shortcut and the real tabs store. Esc with an empty search
// leaves Settings; Esc with text clears it first (NN/g #3, user control).

vi.mock("@lingui/react/macro", () => {
  const t = (input: TemplateStringsArray | string, ...values: unknown[]) =>
    typeof input === "string"
      ? input
      : input.reduce(
          (message, part, index) =>
            `${message}${part}${index < values.length ? String(values[index]) : ""}`,
          "",
        );
  return {
    Trans: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useLingui: () => ({ _: t, t }),
  };
});
vi.mock("./custom-sidebar-header", () => ({
  CustomSidebarHeader: () => <div />,
}));
vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => ({ isPro: true }),
}));
vi.mock("~/upshot-plan", () => ({
  useUpshotPlan: () => ({
    email: null,
    isSignedIn: false,
    isLoading: false,
    plan: null,
  }),
}));
vi.mock("~/auth", () => ({ useAuth: () => ({ session: null }) }));
vi.mock("~/shared/owner-user", () => ({
  useOwnerUserId: () => "local-owner",
}));
vi.mock("~/contacts/queries", () => ({
  usePersonalContact: () => ({ data: null }),
}));
vi.mock("~/settings/team/mirror", () => ({
  useMyWorkspacesWithMirror: () => ({
    data: [],
    isLoading: false,
    isPending: false,
  }),
}));
vi.mock("~/contexts/shell", () => ({
  useShell: () => ({
    chat: {
      mode: "FloatingClosed",
      sendEvent: vi.fn(),
      startNewChat: vi.fn(),
    },
  }),
}));
vi.mock("~/shared/useNewNote", () => ({
  useNewNote: () => vi.fn(),
  useNewNoteAndListen: () => vi.fn(),
}));

import { SettingsNav } from "./settings";

import { useMainShortcuts } from "~/shared/useMainShortcuts";
import { useTabs } from "~/store/zustand/tabs";

function SettingsWithShortcuts() {
  useMainShortcuts();
  return <SettingsNav />;
}

const search = () =>
  screen.getByRole<HTMLInputElement>("textbox", { name: "Search settings" });

async function pressEscape(target: HTMLElement, keyDowns = 1) {
  for (let i = 0; i < keyDowns; i += 1) {
    fireEvent.keyDown(target, { key: "Escape" });
  }
  fireEvent.keyUp(target, { key: "Escape" });
  // The main Escape shortcut runs on the next tick.
  await act(async () => {
    vi.runAllTimers();
  });
}

describe("Esc in Settings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Home, then Settings as the ⌘, menu item opens it (state: None).
    useTabs.getState().openNew({ type: "empty" });
    useTabs.getState().openNew({ type: "settings", state: null } as never);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("leaves Settings when focus is in the empty search", async () => {
    render(<SettingsWithShortcuts />);
    search().focus();
    expect(useTabs.getState().currentTab?.type).toBe("settings");

    await pressEscape(search());

    expect(useTabs.getState().currentTab?.type).toBe("empty");
  });

  it("clears a search first, then leaves on the next Esc", async () => {
    render(<SettingsWithShortcuts />);
    search().focus();
    fireEvent.change(search(), { target: { value: "dark" } });

    await pressEscape(search());
    expect(search().value).toBe("");
    expect(useTabs.getState().currentTab?.type).toBe("settings");

    await pressEscape(search());
    expect(useTabs.getState().currentTab?.type).toBe("empty");
  });
});

// In-app test, Oct 4: from a folder, the Back button in Settings returned to
// the folder but Esc went Home. Esc goes back one step, as Back does (Apple
// HIG, Keyboards: Esc cancels or dismisses; NN/g #3).
describe("Esc in Settings opened from a folder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTabs.getState().openNew({ type: "empty" });
    useTabs.getState().openNew({ type: "folders" } as never);
    // As the sidebar's Settings button opens it.
    useTabs
      .getState()
      .openNew({ type: "settings", state: { tab: "app" } } as never);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("returns to the folder, as Back does", async () => {
    render(<SettingsWithShortcuts />);
    expect(useTabs.getState().currentTab?.type).toBe("settings");

    await pressEscape(document.body);

    expect(useTabs.getState().currentTab?.type).toBe("folders");
  });

  // The app delivered one press as many keydowns before its keyup.
  it("goes back one step when one press arrives as many keydowns", async () => {
    render(<SettingsWithShortcuts />);

    await pressEscape(document.body, 19);

    expect(useTabs.getState().currentTab?.type).toBe("folders");
  });
});
