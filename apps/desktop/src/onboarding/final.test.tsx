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
  stopSfx: vi.fn(),
  setSettingValues: vi.fn(),
  autoPost: false,
  seedExample: vi.fn(),
}));

vi.mock("./example-note", () => ({
  seedExampleSessionOnce: mocks.seedExample,
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));

vi.mock("~/settings/queries", () => ({
  setSettingValues: mocks.setSettingValues,
}));

vi.mock("~/shared/config", () => ({
  useConfigValue: () => mocks.autoPost,
}));

vi.mock("@anlg/plugin-analytics", () => ({
  commands: { event: mocks.analyticsEvent },
}));

vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: mocks.openUrl },
}));

vi.mock("@anlg/plugin-sfx", () => ({
  commands: { stop: mocks.stopSfx },
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
  mocks.stopSfx.mockResolvedValue(null);
  mocks.setSettingValues.mockResolvedValue(undefined);
  mocks.autoPost = false;
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

it("links only to the Upshot repository, not upstream channels", () => {
  render(<FinalDescription />);

  expect(screen.queryByRole("button", { name: "Discord" })).toBeNull();
  expect(screen.queryByRole("button", { name: "X" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "GitHub" }));
  expect(mocks.openUrl).toHaveBeenCalledWith(
    "https://github.com/AdamWebsiteFormula/grandmaster-app",
    null,
  );
});

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
