import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyticsEvent: vi.fn(),
  openUrl: vi.fn(),
  createSession: vi.fn(),
  flushAutomaticRelaunch: vi.fn(),
  getOrCreateWelcomeSession: vi.fn(),
  setOnboardingNeeded: vi.fn(),
  setPendingWelcomeSession: vi.fn(),
  setSettingValues: vi.fn(),
  autoPost: false,
  autoStart: false,
  platform: "macos",
  seedExample: vi.fn(),
}));

vi.mock("./example-note", () => ({
  seedExampleSessionOnce: mocks.seedExample,
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => mocks.platform }));

vi.mock("~/settings/queries", () => ({
  setSettingValues: mocks.setSettingValues,
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: (key: string) =>
    key === "auto_start_scheduled_meetings" ? mocks.autoStart : mocks.autoPost,
}));

vi.mock("@anlg/plugin-analytics", () => ({
  commands: { event: mocks.analyticsEvent },
}));

vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl },
}));

vi.mock("./welcome-note", () => ({
  getOrCreateWelcomeSession: mocks.getOrCreateWelcomeSession,
  setPendingWelcomeSession: mocks.setPendingWelcomeSession,
}));

vi.mock("~/session/queries", () => ({
  createSession: mocks.createSession,
}));

vi.mock("~/shared/relaunch", () => ({
  flushAutomaticRelaunch: mocks.flushAutomaticRelaunch,
}));

vi.mock("~/types/tauri.gen", () => ({
  commands: { setOnboardingNeeded: mocks.setOnboardingNeeded },
}));

import { FinalDescription, FinalSection, finishOnboarding } from "./final";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.analyticsEvent.mockResolvedValue(null);
  mocks.flushAutomaticRelaunch.mockResolvedValue(false);
  mocks.getOrCreateWelcomeSession.mockResolvedValue("welcome-session");
  mocks.setOnboardingNeeded.mockResolvedValue({ status: "ok", data: null });
  mocks.setSettingValues.mockResolvedValue(undefined);
  mocks.autoPost = false;
  mocks.autoStart = false;
  mocks.platform = "macos";
  mocks.seedExample.mockResolvedValue("example-session");
});

afterEach(cleanup);

it("opens a blank note when welcome-note creation fails", async () => {
  const onContinue = vi.fn();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getOrCreateWelcomeSession.mockRejectedValueOnce(
    new Error("malformed JSON"),
  );
  mocks.createSession.mockResolvedValueOnce("blank-session");

  await finishOnboarding(onContinue);

  expect(mocks.createSession).toHaveBeenCalledTimes(1);
  expect(onContinue).toHaveBeenCalledWith("blank-session");
  consoleError.mockRestore();
});

it("shows a retryable error when onboarding cannot be persisted", async () => {
  const onContinue = vi.fn();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.setOnboardingNeeded.mockResolvedValueOnce({
    status: "error",
    error: "settings unavailable",
  });

  render(<FinalSection onContinue={onContinue} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Upshot" }));

  expect(
    (
      screen.getByRole("button", {
        name: "Open Upshot",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await screen.findByRole("alert");
  expect(
    (
      screen.getByRole("button", {
        name: "Open Upshot",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  expect(onContinue).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

it("reuses the blank fallback session when persistence is retried", async () => {
  const onContinue = vi.fn();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getOrCreateWelcomeSession.mockRejectedValue(
    new Error("malformed JSON"),
  );
  mocks.createSession.mockResolvedValue("blank-session");
  mocks.setOnboardingNeeded
    .mockResolvedValueOnce({ status: "error", error: "settings unavailable" })
    .mockResolvedValueOnce({ status: "ok", data: null });

  render(<FinalSection onContinue={onContinue} />);
  fireEvent.click(screen.getByRole("button", { name: "Open Upshot" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Open Upshot" }));

  await waitFor(() => {
    expect(onContinue).toHaveBeenCalledWith("blank-session");
  });
  expect(mocks.createSession).toHaveBeenCalledTimes(1);
  consoleError.mockRestore();
});

it("ignores concurrent finish attempts", async () => {
  const onContinue = vi.fn();
  let resolveWelcomeSession: (sessionId: string) => void = () => {};
  mocks.getOrCreateWelcomeSession.mockReturnValue(
    new Promise((resolve) => {
      resolveWelcomeSession = resolve;
    }),
  );

  render(<FinalSection onContinue={onContinue} />);
  const button = screen.getByRole("button", { name: "Open Upshot" });
  fireEvent.click(button);
  fireEvent.click(button);
  resolveWelcomeSession("welcome-session");

  await waitFor(() => {
    expect(onContinue).toHaveBeenCalledWith("welcome-session");
  });
  expect(mocks.getOrCreateWelcomeSession).toHaveBeenCalledTimes(1);
  expect(onContinue).toHaveBeenCalledTimes(1);
});

it("says how to record the first meeting, with no community links", () => {
  render(<FinalDescription />);

  expect(screen.queryByRole("button")).toBeNull();
  // Fork: it names this step's real button, Open Upshot (NN/g #2).
  expect(
    screen.getByText(
      "After you open Upshot, click New note or press ⌘N to record your first meeting.",
    ),
  ).toBeTruthy();
});

// Microsoft Writing Style Guide, Keys and keyboard shortcuts; NN/g #5.
it.each(["windows", "linux"])(
  "names Ctrl+N and leaves out calendar auto start on %s",
  (os) => {
    mocks.platform = os;
    render(<FinalDescription />);
    expect(
      screen.getByText(/click New note or press Ctrl\+N to record/),
    ).toBeTruthy();
    expect(screen.queryByText(/⌘/)).toBeNull();
    cleanup();

    render(<FinalSection onContinue={vi.fn()} />);
    expect(
      screen.queryByRole("switch", {
        name: "Start recording when a scheduled meeting begins",
      }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Open Upshot" })).toBeTruthy();
  },
);

it("reminds you to tell people and shows the chat notice switch, off by default", () => {
  render(<FinalSection onContinue={vi.fn()} />);

  expect(screen.getByText(/Tell people when you record them/)).toBeTruthy();
  expect(
    screen.getByText(/I'm using Upshot to record and transcribe this meeting/),
  ).toBeTruthy();
  const toggle = screen.getByRole("switch", {
    name: "Post a short notice in the meeting chat",
  });
  expect(toggle.getAttribute("aria-checked")).toBe("false");

  fireEvent.click(toggle);
  expect(mocks.setSettingValues).toHaveBeenCalledWith({
    consent_auto_send_chat: true,
  });
});

it("shows the switch on when the notice is already on", () => {
  mocks.autoPost = true;
  render(<FinalSection onContinue={vi.fn()} />);

  expect(
    screen
      .getByRole("switch", { name: "Post a short notice in the meeting chat" })
      .getAttribute("aria-checked"),
  ).toBe("true");
});

it("seeds the example meeting, then opens the welcome note", async () => {
  const onContinue = vi.fn();
  await finishOnboarding(onContinue);

  expect(mocks.seedExample).toHaveBeenCalledTimes(1);
  expect(mocks.seedExample.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.getOrCreateWelcomeSession.mock.invocationCallOrder[0]!,
  );
  expect(onContinue).toHaveBeenCalledWith("welcome-session");
});

it("still finishes when the example meeting cannot be created", async () => {
  const onContinue = vi.fn();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.seedExample.mockRejectedValueOnce(new Error("db busy"));

  await finishOnboarding(onContinue);

  expect(onContinue).toHaveBeenCalledWith("welcome-session");
  consoleError.mockRestore();
});

it("offers auto start under the notice, off by default, and saves the same key as Settings", () => {
  render(<FinalSection onContinue={vi.fn()} />);

  const toggle = screen.getByRole("switch", {
    name: "Start recording when a scheduled meeting begins",
  });
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  // It sits under the chat notice switch.
  const notice = screen.getByRole("switch", {
    name: "Post a short notice in the meeting chat",
  });
  expect(
    notice.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  fireEvent.click(toggle);
  expect(mocks.setSettingValues).toHaveBeenCalledWith({
    auto_start_scheduled_meetings: true,
  });
});

it("shows auto start on for someone who turned it on before", () => {
  mocks.autoStart = true;
  render(<FinalSection onContinue={vi.fn()} />);

  expect(
    screen
      .getByRole("switch", {
        name: "Start recording when a scheduled meeting begins",
      })
      .getAttribute("aria-checked"),
  ).toBe("true");
});
