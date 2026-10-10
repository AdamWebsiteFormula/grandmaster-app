import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentTab: { type: "settings", state: { tab: "app" } } as {
    type: "settings";
    state: { tab?: string };
  } | null,
  tabs: [] as Array<{
    active: boolean;
    pinned: boolean;
    slotId: string;
    type: "templates";
    state: {
      showHomepage: boolean;
      isWebMode: boolean;
      selectedMineId: string | null;
      selectedWebIndex: number | null;
    };
  }>,
  openNew: vi.fn(),
  isPro: true,
  isUpgradingToPro: false,
  select: vi.fn(),
  transitionChatMode: vi.fn(),
  upgradeToPro: vi.fn(),
  updateSettingsTabState: vi.fn(),
  updateTemplatesTabState: vi.fn(),
  workspaces: [] as Array<{ workspaceId: string }> | undefined,
  workspacesLoading: false,
  upshot: {
    email: null as string | null,
    isSignedIn: false,
    isLoading: false,
    plan: null as { pro: boolean } | null,
  },
  profileName: null as string | null,
  avatar: null as string | null,
}));

const lingui = vi.hoisted(() => {
  const t = (
    input: TemplateStringsArray | { message?: string } | string,
    ...values: unknown[]
  ) => {
    if (Array.isArray(input)) {
      return input.reduce(
        (message, part, index) =>
          `${message}${part}${index < values.length ? String(values[index]) : ""}`,
        "",
      );
    }

    if (typeof input === "string") {
      return input;
    }

    if ("message" in input) {
      return input.message ?? "";
    }

    return "";
  };

  return { t };
});

vi.mock("@lingui/react/macro", () => ({
  Trans: ({
    children,
    id,
    message,
  }: {
    children?: ReactNode;
    id?: string;
    message?: string;
  }) => <>{children ?? message ?? id}</>,
  useLingui: () => ({
    _: lingui.t,
    t: lingui.t,
  }),
}));

vi.mock("./custom-sidebar-header", () => ({
  CustomSidebarHeader: () => <div />,
}));

vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => ({
    isPro: mocks.isPro,
    isUpgradingToPro: mocks.isUpgradingToPro,
    upgradeToPro: mocks.upgradeToPro,
  }),
}));

const account = vi.hoisted(() => ({
  openUpshotSignIn: vi.fn(),
  signOutUpshot: vi.fn(async () => {}),
  toastSuccess: vi.fn(),
}));

vi.mock("~/upshot-plan", () => ({
  useUpshotPlan: () => mocks.upshot,
  openUpshotSignIn: account.openUpshotSignIn,
}));

vi.mock("~/upshot-plan/session", () => ({
  signOutUpshot: account.signOutUpshot,
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { success: account.toastSuccess },
}));

vi.mock("~/auth", () => ({
  useAuth: () => ({ session: null }),
}));

vi.mock("~/shared/owner-user", () => ({
  useOwnerUserId: () => "local-owner",
}));

vi.mock("~/contacts/queries", () => ({
  usePersonalContact: () => ({
    data:
      mocks.profileName || mocks.avatar
        ? { name: mocks.profileName, avatarDataUrl: mocks.avatar }
        : null,
  }),
}));

vi.mock("~/settings/team/mirror", () => ({
  useMyWorkspacesWithMirror: () => ({
    data: mocks.workspaces,
    isLoading: mocks.workspacesLoading,
    isPending: mocks.workspacesLoading,
  }),
}));

vi.mock("~/store/zustand/tabs", () => {
  const getState = () => ({
    currentTab: mocks.currentTab,
    tabs: mocks.tabs,
    openNew: mocks.openNew,
    select: mocks.select,
    transitionChatMode: mocks.transitionChatMode,
    updateSettingsTabState: mocks.updateSettingsTabState,
    updateTemplatesTabState: mocks.updateTemplatesTabState,
  });
  const useTabs = Object.assign(
    (selector: (state: unknown) => unknown) => selector(getState()),
    { getState },
  );

  return {
    useTabs,
  };
});

import { SettingsNav } from "./settings";

describe("SettingsNav", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.currentTab = { type: "settings", state: { tab: "app" } };
    mocks.tabs = [];
    mocks.isPro = true;
    mocks.isUpgradingToPro = false;
    mocks.openNew.mockClear();
    mocks.select.mockClear();
    mocks.transitionChatMode.mockClear();
    mocks.upgradeToPro.mockClear();
    mocks.updateSettingsTabState.mockClear();
    mocks.updateTemplatesTabState.mockClear();
    mocks.workspaces = [];
    mocks.workspacesLoading = false;
    mocks.upshot = {
      email: null,
      isSignedIn: false,
      isLoading: false,
      plan: null,
    };
    mocks.profileName = null;
    mocks.avatar = null;
  });

  const openedSettingsTab = () =>
    mocks.updateSettingsTabState.mock.lastCall?.[1] as
      | { tab: string }
      | undefined;
  const hasProLock = (name: string | RegExp) =>
    Boolean(
      screen
        .getByRole("button", { name })
        .querySelector("[aria-label='Requires Upshot Pro']"),
    );

  it.each([
    ["General", "app"],
    ["Meetings", "meetings"],
    ["Notifications", "notifications"],
    ["Plan", "plan"],
    ["Transcription", "transcription"],
    ["Profile", "profile"],
    ["Calendar", "calendars"],
    ["Connectors", "connectors"],
  ])("opens %s inside settings", (label, tab) => {
    render(<SettingsNav />);

    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(mocks.updateSettingsTabState).toHaveBeenCalledWith(
      mocks.currentTab,
      { tab },
    );
  });

  // Owner test, Oct 4: Sign out stays in view at the bottom of Settings,
  // where Granola puts it.
  it("shows Sign out at the bottom while signed in", () => {
    mocks.upshot = {
      ...mocks.upshot,
      isSignedIn: true,
      email: "judge@example.com",
      plan: { pro: true },
    };
    render(<SettingsNav />);

    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("offers Sign in in the same place when no one is signed in", () => {
    render(<SettingsNav />);

    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(account.openUpshotSignIn).toHaveBeenCalled();
  });

  // Owner test, Oct 5: signing out needs a visible confirmation.
  it("confirms the sign-out with a toast", async () => {
    mocks.upshot = {
      ...mocks.upshot,
      isSignedIn: true,
      email: "judge@example.com",
    };
    render(<SettingsNav />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await vi.waitFor(() =>
      expect(account.toastSuccess).toHaveBeenCalledWith(
        "You're signed out",
        expect.objectContaining({
          description: "Sign in again to use Upshot AI and transcription.",
        }),
      ),
    );
    expect(account.signOutUpshot).toHaveBeenCalled();
  });

  // Owner test, Oct 4: the plan badge opens Plan, one click to upgrade.
  it("opens Plan from the plan badge", () => {
    render(<SettingsNav />);

    fireEvent.click(screen.getByTestId("settings-plan-badge"));

    expect(openedSettingsTab()).toEqual({ tab: "plan" });
  });

  // Fork: Folders and Templates are workspaces, so they leave the Settings
  // sidebar and stay in ⌘K (redline-oct3 Settings).
  it.each(["Folders", "Templates"])("keeps %s out of the sidebar", (label) => {
    render(<SettingsNav />);

    expect(
      screen.queryByRole("button", { name: new RegExp(label) }),
    ).toBeNull();
  });

  it("offers Insights instead of Stats to free users, including via search", () => {
    mocks.isPro = false;
    render(<SettingsNav />);
    expect(screen.queryByRole("button", { name: "Stats" })).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "Search settings" }), {
      target: { value: "insights" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Insights" }));

    expect(openedSettingsTab()).toEqual({ tab: "insights" });
    expect(screen.queryByRole("button", { name: "Stats" })).toBeNull();
  });

  // Fork (blueprint section 5): cloud, account and plan screens are hidden.
  it("hides cloud, account and plan screens and keeps local ones", () => {
    mocks.isPro = false;
    render(<SettingsNav />);

    for (const label of [
      /Account/,
      /Billing/,
      /Teams/,
      /Sync/,
      /Dictation/,
      /Automations/,
      /CRM/,
    ]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }

    fireEvent.change(screen.getByRole("textbox", { name: "Search settings" }), {
      target: { value: "dictionary" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Dictionary/ }));
    expect(openedSettingsTab()).toEqual({ tab: "dictionary" });
    expect(mocks.upgradeToPro).not.toHaveBeenCalled();
  });

  // Fork: Teams is hidden, so its lock states no longer apply.
  it.skip.each([
    ["without a workspace", [], false, true],
    [
      "for members of an existing workspace",
      [{ workspaceId: "ws-1" }],
      false,
      false,
    ],
    ["while workspaces are loading", undefined, true, false],
  ])("locks Teams for free users only %s", (_, workspaces, loading, locked) => {
    mocks.isPro = false;
    mocks.workspaces = workspaces;
    mocks.workspacesLoading = loading;

    render(<SettingsNav />);

    expect(hasProLock(/Teams/)).toBe(locked);
  });

  // grandmaster/sops/settings-ia-oct3.md Q3: eight pages, in two groups.
  it("lists eight pages, with moved pages only in search", () => {
    render(<SettingsNav />);
    const labels = screen
      .getAllByRole("group")
      .map((group) =>
        Array.from(group.querySelectorAll("button")).map(
          (button) => button.textContent,
        ),
      );
    expect(labels).toEqual([
      ["General", "Profile", "Plan"],
      ["Meetings", "Transcription", "Calendar", "Notifications", "Connectors"],
    ]);
  });

  it.each([
    ["theme", "Appearance", "appearance"],
    ["touch id", "Privacy", "privacy"],
    ["accessibility", "Permissions", "permissions"],
    ["jargon", "Dictionary", "dictionary"],
    ["Granola", "Imports", "imports"],
    ["webhooks", "Developers", "developers"],
    ["badges", "Insights", "insights"],
  ])("search %s finds the moved %s section", (query, label, tab) => {
    render(<SettingsNav />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search settings" }), {
      target: { value: query },
    });
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(openedSettingsTab()).toEqual({ tab });
  });

  it.each([
    ["appearance", "General"],
    ["privacy", "General"],
    ["dictionary", "Transcription"],
    ["imports", "Connectors"],
    ["insights", "Profile"],
    ["stats", "Profile"],
    ["audio", "Meetings"],
  ])("marks the page that holds %s", (tab, page) => {
    mocks.currentTab = { type: "settings", state: { tab } };
    render(<SettingsNav />);
    expect(
      screen.getByRole("button", { name: page }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("filters nav items by item or group label", () => {
    render(<SettingsNav />);
    const input = screen.getByRole("textbox", { name: "Search settings" });

    fireEvent.change(input, { target: { value: "appear" } });
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.queryByText("Meetings")).toBeNull();

    fireEvent.change(input, { target: { value: "meetings" } });
    expect(screen.getByText("Transcription")).toBeTruthy();
    expect(screen.getByText("Connectors")).toBeTruthy();
    expect(screen.queryByText("Appearance")).toBeNull();
  });

  it("finds pages kept out of the list, such as Templates", () => {
    render(<SettingsNav />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search settings" }), {
      target: { value: "templates" },
    });
    const templates = screen.getByText("Templates").closest("button");
    expect(templates).toBeTruthy();
    fireEvent.click(templates!);
    expect(mocks.openNew).toHaveBeenCalledWith({ type: "templates" });
  });

  it("shows an empty state when no settings match", () => {
    render(<SettingsNav />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search settings" }), {
      target: { value: "zzzzzz" },
    });

    expect(screen.getByText("No results found.")).toBeTruthy();
  });

  it.each([
    [
      "the clear button",
      () => {
        fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
      },
    ],
    [
      "Escape",
      () => {
        fireEvent.keyDown(
          screen.getByRole("textbox", { name: "Search settings" }),
          {
            key: "Escape",
          },
        );
      },
    ],
  ])("restores the full list when search is cleared with %s", (_, clear) => {
    render(<SettingsNav />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search settings" }), {
      target: { value: "audio" },
    });
    expect(screen.queryByText("General")).toBeNull();

    clear();

    expect(screen.getByText("General")).toBeTruthy();
  });

  it("matches what is inside a page, not only its name", () => {
    render(<SettingsNav />);
    const input = screen.getByRole("textbox", { name: "Search settings" });

    fireEvent.change(input, { target: { value: "dark" } });
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.queryByText("Meetings")).toBeNull();

    fireEvent.change(input, { target: { value: "microphone" } });
    expect(screen.getByText("Meetings")).toBeTruthy();
    expect(screen.getByText("Permissions")).toBeTruthy();

    fireEvent.change(input, { target: { value: "touch id" } });
    expect(screen.getByText("Privacy")).toBeTruthy();
  });

  // journey-account-settings P2 "Settings search".
  it.each([
    ["sign in", "Profile"],
    ["log out", "Profile"],
    ["account", "Profile"],
    ["cancel", "Plan"],
    ["manage subscription", "Plan"],
    ["invoice", "Plan"],
    ["card", "Plan"],
    ["usage", "Plan"],
    ["floating bar", "Meetings"],
    ["auto stop", "Meetings"],
  ])("search %s finds %s", (query, page) => {
    render(<SettingsNav />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search settings" }), {
      target: { value: query },
    });
    expect(screen.getByRole("button", { name: page })).toBeTruthy();
    expect(screen.queryByText("No results found.")).toBeNull();
  });

  // journey-account-settings P3 "Settings search, keyboard".
  it("Return opens the top match", () => {
    render(<SettingsNav />);
    const input = screen.getByRole("textbox", { name: "Search settings" });
    fireEvent.change(input, { target: { value: "invoice" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(openedSettingsTab()).toEqual({ tab: "plan" });
  });

  it("Return with no search or no match does nothing", () => {
    render(<SettingsNav />);
    const input = screen.getByRole("textbox", { name: "Search settings" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "zzzz" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.updateSettingsTabState).not.toHaveBeenCalled();
    expect(mocks.openNew).not.toHaveBeenCalled();
  });

  it("keeps Esc from closing Settings while it clears the search", () => {
    render(<SettingsNav />);
    const input = screen.getByRole("textbox", { name: "Search settings" });

    fireEvent.change(input, { target: { value: "dark" } });
    const clearing = fireEvent.keyDown(input, { key: "Escape" });
    expect(clearing).toBe(false);

    const empty = fireEvent.keyDown(input, { key: "Escape" });
    expect(empty).toBe(true);
  });

  // Fork: keyboard focus is visible on every nav row (WCAG 2.2 SC 2.4.7).
  it("draws a focus ring on nav rows", () => {
    render(<SettingsNav />);
    const general = screen.getByRole("button", { name: "General" });
    expect(general.className).toContain("focus-visible:ring-2");
    expect(general.className).toContain("focus-visible:ring-ring");
  });

  it("marks the open page with aria-current", () => {
    mocks.currentTab = { type: "settings", state: { tab: "plan" } };
    render(<SettingsNav />);

    expect(
      screen.getByRole("button", { name: "Plan" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("button", { name: "General" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  describe("account header", () => {
    const header = () => screen.getByTestId("settings-account-header");

    const badge = () => screen.getByTestId("settings-plan-badge");

    // Fork: no name yet is "You" with a person icon, never the app's name and
    // letter as the user's own (NN/g #4; the transcript says "You" too).
    it("calls an unnamed user You, with a person icon, and names the plan", () => {
      render(<SettingsNav />);
      expect(screen.getByText("You").className).toContain("font-medium");
      expect(header().textContent).not.toContain("Upshot");
      expect(badge().textContent).toBe("Free plan");
      const circle = header().querySelector("[aria-hidden]");
      expect(circle?.textContent).toBe("");
      expect(circle?.querySelector("svg")).not.toBeNull();
    });

    it("shows the profile name and email when signed in", () => {
      mocks.upshot = {
        email: "ada@example.com",
        isSignedIn: true,
        isLoading: false,
        plan: { pro: true },
      };
      mocks.profileName = "Ada Lovelace";
      render(<SettingsNav />);
      expect(screen.getByText("Ada Lovelace")).toBeTruthy();
      expect(screen.getByText("ada@example.com")).toBeTruthy();
      expect(header().querySelector("[aria-hidden]")?.textContent).toBe("A");
    });

    it("puts the name and the email on their own lines", () => {
      mocks.upshot = {
        email: "ada@example.com",
        isSignedIn: true,
        isLoading: false,
        plan: { pro: true },
      };
      mocks.profileName = "Ada Lovelace";
      render(<SettingsNav />);
      const email = screen.getByText("ada@example.com");
      expect(email.className).toContain("text-xs");
      expect(email.className).toContain("text-muted-foreground");
      // Fork: the help tag shows only when the email is cut off (round 4).
      fireEvent.mouseEnter(email);
      expect(email.getAttribute("title")).toBeNull();
      Object.defineProperty(email, "scrollWidth", { value: 300 });
      Object.defineProperty(email, "clientWidth", { value: 120 });
      fireEvent.mouseEnter(email);
      expect(email.getAttribute("title")).toBe("ada@example.com");
      expect(screen.getByText("Ada Lovelace")).not.toBe(email);
    });

    it("uses the email's local part, never the plan, without a profile name", () => {
      mocks.upshot = {
        email: "judge@example.com",
        isSignedIn: true,
        isLoading: false,
        plan: { pro: true },
      };
      render(<SettingsNav />);
      const name = screen.getByText("judge");
      expect(name.className).toContain("font-medium");
      expect(screen.getByText("judge@example.com")).toBeTruthy();
      expect(screen.queryByText("Pro plan")).toBeNull();
      expect(badge().textContent).toBe("Pro plan");
      expect(header().querySelector("[aria-hidden]")?.textContent).toBe("J");
    });

    it("badges a free plan for a signed-in free user", () => {
      mocks.upshot = {
        email: "ada@example.com",
        isSignedIn: true,
        isLoading: false,
        plan: { pro: false },
      };
      mocks.profileName = "Ada Lovelace";
      render(<SettingsNav />);
      expect(badge().textContent).toBe("Free plan");
    });

    // journey-account-settings P2: no "Free" badge before the plan is known.
    it("hides the badge while a signed-in plan loads or can't be read", () => {
      mocks.upshot = {
        email: "ada@example.com",
        isSignedIn: true,
        isLoading: true,
        plan: null,
      };
      render(<SettingsNav />);
      expect(screen.queryByTestId("settings-plan-badge")).toBeNull();
      cleanup();
      mocks.upshot = { ...mocks.upshot, isLoading: false };
      render(<SettingsNav />);
      expect(screen.queryByTestId("settings-plan-badge")).toBeNull();
    });

    it("hides the badge until the saved session has loaded", () => {
      mocks.upshot = { ...mocks.upshot, isLoading: true };
      render(<SettingsNav />);
      expect(screen.queryByTestId("settings-plan-badge")).toBeNull();
    });

    // journey-account-settings P3: the Profile photo in the header.
    it("shows the Profile photo when there is one", () => {
      mocks.avatar = "data:image/jpeg;base64,photo";
      mocks.profileName = "Ada Lovelace";
      render(<SettingsNav />);
      const avatar = screen.getByTestId("settings-account-avatar");
      expect(avatar.getAttribute("src")).toBe("data:image/jpeg;base64,photo");
      expect(header().textContent).not.toContain("A" + "Ada");
    });

    it("sits above the search field", () => {
      render(<SettingsNav />);
      const search = screen.getByRole("textbox", { name: "Search settings" });
      expect(
        header().compareDocumentPosition(search) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });
});
