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
vi.mock("./calendar", () => ({ CalendarSection: () => null }));
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

  function renderAtImports() {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StandaloneOnboardingScreen onFinish={vi.fn()} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("Permissions done"));
    fireEvent.click(screen.getByText("Transcription done"));
  }

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
