import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearNotifications: vi.fn(),
  currentPlatform: "macos",
  setSettingValues: vi.fn(),
  useConfigValues: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (input: TemplateStringsArray | string) =>
      typeof input === "string" ? input : input.join(""),
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: () => mocks.currentPlatform,
}));

vi.mock("@anlg/plugin-detect", () => ({
  commands: {
    listDefaultIgnoredBundleIds: vi.fn(),
    listInstalledApplications: vi.fn(),
  },
}));

vi.mock("@anlg/plugin-notification", () => ({
  commands: {
    clearNotifications: mocks.clearNotifications,
  },
}));

vi.mock("~/settings/queries", () => ({
  useSetSettingValues: () => mocks.setSettingValues,
}));

vi.mock("~/shared/config", () => ({
  useConfigValues: mocks.useConfigValues,
}));

import { NotificationSettingsView } from "./notification";

const baseConfig = {
  notification_disabled: false,
  notification_event: false,
  notification_detect: true,
  notification_transcription_complete: true,
  notification_summary_complete: true,
  notification_cloudsync_complete: true,
  notification_recording: true,
  notification_bounce: true,
  show_app_in_dock: true,
  respect_dnd: false,
  ignored_platforms: [],
  included_platforms: [],
  mic_active_threshold: 15,
};

describe("NotificationSettingsView", () => {
  beforeEach(() => {
    mocks.clearNotifications.mockReset();
    mocks.currentPlatform = "macos";
    mocks.setSettingValues.mockReset();
    mocks.useConfigValues.mockReset();
    mocks.useConfigValues.mockReturnValue(baseConfig);
    mocks.useQuery.mockImplementation(
      ({ queryKey }: { queryKey: readonly string[] }) => {
        if (queryKey[1] === "all-installed-applications") {
          return {
            data: [{ id: "com.ting.aqua-bridge", name: "Ting Aqua Bridge" }],
          };
        }
        return { data: [] };
      },
    );
  });

  afterEach(cleanup);

  // Fork: Upshot makes no sounds, so there is no sound toggle or picker.
  it("offers no completion sound controls", () => {
    render(<NotificationSettingsView />);

    expect(
      screen.queryByRole("switch", { name: "Completion sound" }),
    ).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Sound" })).toBeNull();
    expect(screen.queryByText("Sound and Dock")).toBeNull();
  });

  it("shows persisted ignored apps as soon as the form hydrates", async () => {
    const { rerender } = render(<NotificationSettingsView />);

    expect(screen.queryByText("Ting Aqua Bridge")).toBeNull();

    mocks.useConfigValues.mockReturnValue({
      ...baseConfig,
      ignored_platforms: ["com.ting.aqua-bridge"],
    });
    rerender(<NotificationSettingsView />);

    await waitFor(() =>
      expect(screen.getByText("Ting Aqua Bridge")).toBeTruthy(),
    );
  });

  // Fork: "(default)" at full contrast (WCAG 2.2 SC 1.4.3), a field border
  // on the picker (SC 1.4.11), and child rows that start under the parent's
  // text (Apple HIG Layout).
  it("shows default apps at full contrast in a bordered, aligned picker", () => {
    mocks.useQuery.mockImplementation(
      ({ queryKey }: { queryKey: readonly string[] }) => {
        if (queryKey[1] === "all-installed-applications") {
          return {
            data: [{ id: "com.ting.aqua-bridge", name: "Ting Aqua Bridge" }],
          };
        }
        if (queryKey[1] === "default-ignored-bundle-ids") {
          return { data: ["com.ting.aqua-bridge"] };
        }
        return { data: [] };
      },
    );
    render(<NotificationSettingsView />);

    const label = screen.getByText("(default)");
    expect(label.className).not.toContain("opacity");
    const picker = label.closest("[aria-expanded]")!;
    expect(picker.className).toContain("border-input");
    expect(picker.className).toContain("rounded-lg");
    const children = label.closest(".border-l-2")!;
    expect(children.className).toContain("ml-4");
    expect(children.className).toContain("pl-6.5");
  });

  // Fork: no sounds anywhere, the Dock only on a Mac, and event reminders
  // only with the Mac's Calendar (NN/g #2, #5).
  it("says what notifications do on a Mac, with event reminders", () => {
    render(<NotificationSettingsView />);

    expect(
      screen.getByText("Show notification panels and Dock alerts."),
    ).toBeTruthy();
    expect(screen.queryByText(/sounds/)).toBeNull();
    expect(
      screen.getByRole("switch", { name: "Event notifications" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("switch", { name: "Bounce app icon" }),
    ).toBeTruthy();
  });

  it.each(["windows", "linux"])(
    "drops the Dock, sounds and event reminders on %s",
    (os) => {
      mocks.currentPlatform = os;
      render(<NotificationSettingsView />);

      expect(screen.getByText("Show notification panels.")).toBeTruthy();
      expect(screen.queryByText(/Dock|sounds/)).toBeNull();
      expect(
        screen.queryByRole("switch", { name: "Event notifications" }),
      ).toBeNull();
      expect(
        screen.queryByRole("switch", { name: "Bounce app icon" }),
      ).toBeNull();
      expect(
        screen.getByRole("switch", { name: "Flash taskbar button" }),
      ).toBeTruthy();
    },
  );

  it("disables every notification control with the master switch", () => {
    render(<NotificationSettingsView />);

    // Fork: "Allow notifications" is on while the stored
    // notification_disabled is false (macOS System Settings wording).
    const allow = screen.getByRole("switch", { name: "Allow notifications" });
    expect(allow.getAttribute("aria-checked")).toBe("true");
    expect(
      screen.queryByText("Turn on Allow notifications to change these."),
    ).toBeNull();

    fireEvent.click(allow);

    expect(allow.getAttribute("aria-checked")).toBe("false");
    expect(
      screen.getByText("Turn on Allow notifications to change these."),
    ).not.toBeNull();

    expect(
      screen
        .getByRole("switch", { name: "Transcription complete" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("switch", { name: "Bounce app icon" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(mocks.clearNotifications).toHaveBeenCalled();
  });
});
