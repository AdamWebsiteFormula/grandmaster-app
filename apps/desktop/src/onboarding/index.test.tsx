import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StandaloneOnboardingScreen } from "./index";

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));
vi.mock("@anlg/plugin-sfx", () => ({
  commands: {
    play: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock("~/analytics", () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock("~/auth", () => ({ useAuth: () => ({ signIn: vi.fn() }) }));
vi.mock("~/shared/window-shell", () => ({
  StandaloneWindowShell: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("./account", () => ({ LoginSection: () => null }));
vi.mock("./calendar", () => ({
  CalendarSection: ({ onContinue }: { onContinue: () => void }) => (
    <button onClick={onContinue}>Calendar done</button>
  ),
}));
vi.mock("./imports", () => ({
  ImportSection: ({
    onContinue,
    onSkip,
  }: {
    onContinue: () => void;
    onSkip: () => void;
  }) => (
    <>
      <button onClick={onContinue}>Import done</button>
      <button onClick={onSkip}>Import skip</button>
    </>
  ),
}));
vi.mock("./permissions", () => ({
  PermissionsSection: ({ onContinue }: { onContinue: () => void }) => (
    <button onClick={onContinue}>Permissions done</button>
  ),
}));
vi.mock("./transcription", () => ({
  TranscriptionSetupSection: ({ onContinue }: { onContinue: () => void }) => (
    <button onClick={onContinue}>Transcription done</button>
  ),
}));
vi.mock("./final", () => ({
  FinalDescription: () => null,
  FinalSection: () => null,
  finishOnboarding: vi.fn(),
}));

describe("StandaloneOnboardingScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("leads with the title and the one-sentence value proposition", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StandaloneOnboardingScreen onFinish={vi.fn()} />
      </QueryClientProvider>,
    );

    const title = screen.getByRole("heading", {
      level: 1,
      name: "Welcome to Upshot",
    });
    expect(title.className).toContain("text-2xl");

    const value = screen.getByText(
      "Record any call without a bot, and get clear notes from the newest AI models.",
    );
    expect(value.tagName).toBe("P");
    expect(value.className).toContain("text-base");
    expect(value.className).toContain("text-muted-foreground");
    // The sentence sits right under the title, in the same header block.
    expect(value.previousElementSibling).toBe(title);
  });

  function renderAtCalendar() {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StandaloneOnboardingScreen onFinish={vi.fn()} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("Permissions done"));
    fireEvent.click(screen.getByText("Transcription done"));
  }

  function renderAtImports() {
    renderAtCalendar();
    fireEvent.click(screen.getByText("Calendar done"));
  }

  it("asks for Apple Calendar right after transcription, and it can be skipped", () => {
    renderAtCalendar();

    expect(screen.getByText("Connect calendar")).toBeTruthy();
    fireEvent.click(screen.getByText("Skip"));

    expect(screen.getByText("Calendar skipped")).toBeTruthy();
    expect(screen.getByText("Bring your meeting history")).toBeTruthy();
  });

  it("says the calendar is connected after it connects", () => {
    renderAtImports();

    expect(screen.getByText("Calendar connected")).toBeTruthy();
  });

  // Fork: no AI key step; Upshot AI works with no key, as Granola's models do.
  it("goes from transcription straight to the calendar, with no AI key step", () => {
    renderAtCalendar();

    expect(screen.getByText("Transcription set up")).toBeTruthy();
    expect(screen.queryByText("Set up AI summaries")).toBeNull();
    expect(screen.getByText("Connect calendar")).toBeTruthy();
  });

  it("shows the step count and Back after the first step", () => {
    renderAtCalendar();

    expect(screen.getByText("Step 3 of 5")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 2 of 5")).toBeTruthy();
  });

  it("names the music toggle by what it does", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StandaloneOnboardingScreen onFinish={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Play music" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("says meeting history was skipped when the import step is skipped", () => {
    renderAtImports();
    fireEvent.click(screen.getByText("Import skip"));

    expect(screen.getByText("Meeting history skipped")).toBeTruthy();
    expect(screen.queryByText("Meeting history imported")).toBeNull();
  });

  it("says meeting history was imported after an import", () => {
    renderAtImports();
    fireEvent.click(screen.getByText("Import done"));

    expect(screen.getByText("Meeting history imported")).toBeTruthy();
    expect(screen.queryByText("Meeting history skipped")).toBeNull();
  });
});
