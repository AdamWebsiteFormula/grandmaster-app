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
    plan: null as { pro: boolean } | null,
  },
  profileName: null as string | null,
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

vi.mock("~/upshot-plan", () => ({
  useUpshotPlan: () => mocks.upshot,
}));

vi.mock("~/auth", () => ({
  useAuth: () => ({ session: null }),
}));

vi.mock("~/shared/owner-user", () => ({
  useOwnerUserId: () => "local-owner",
}));

vi.mock("~/contacts/queries", () => ({
  usePersonalContact: () => ({
    data: mocks.profileName ? { name: mocks.profileName } : null,
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
    mocks.upshot = { email: null, isSignedIn: false, plan: null };
    mocks.profileName = null;
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
    ["Permissions", "permissions"],
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

  it("filters nav items by item or group label", () => {
    render(<SettingsNav />);
    const input = screen.getByRole("textbox", { name: "Search settings" });

    fireEvent.change(input, { target: { value: "appear" } });
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.queryByText("Meetings")).toBeNull();

    fireEvent.change(input, { target: { value: "workspace" } });
    expect(screen.getByText("Meetings")).toBeTruthy();
    expect(screen.getByText("Connectors")).toBeTruthy();
    expect(screen.queryByText("Appearance")).toBeNull();
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
    expect(screen.queryByText("Appearance")).toBeNull();

    clear();

    expect(screen.getByText("Appearance")).toBeTruthy();
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

  it("keeps Esc from closing Settings while it clears the search", () => {
    render(<SettingsNav />);
    const input = screen.getByRole("textbox", { name: "Search settings" });

    fireEvent.change(input, { target: { value: "dark" } });
    const clearing = fireEvent.keyDown(input, { key: "Escape" });
    expect(clearing).toBe(false);

    const empty = fireEvent.keyDown(input, { key: "Escape" });
    expect(empty).toBe(true);
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

    it("names the app and the plan when signed out", () => {
      render(<SettingsNav />);
      expect(header().textContent).toContain("Upshot");
      expect(header().textContent).toContain("Free plan");
      expect(header().textContent).toContain("U");
    });

    it("shows the profile name and email when signed in", () => {
      mocks.upshot = {
        email: "ada@example.com",
        isSignedIn: true,
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
        plan: { pro: true },
      };
      mocks.profileName = "Ada Lovelace";
      render(<SettingsNav />);
      const email = screen.getByText("ada@example.com");
      expect(email.className).toContain("text-xs");
      expect(email.className).toContain("text-muted-foreground");
      expect(email.getAttribute("title")).toBe("ada@example.com");
      expect(screen.getByText("Ada Lovelace")).not.toBe(email);
    });

    it("falls back to the email and plan without a profile name", () => {
      mocks.upshot = {
        email: "judge@example.com",
        isSignedIn: true,
        plan: { pro: true },
      };
      render(<SettingsNav />);
      expect(screen.getByText("judge@example.com")).toBeTruthy();
      expect(screen.getByText("Pro plan")).toBeTruthy();
      expect(header().querySelector("[aria-hidden]")?.textContent).toBe("J");
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
