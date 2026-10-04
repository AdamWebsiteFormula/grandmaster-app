import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StandaloneOnboardingScreen, TabContentOnboarding } from "./index";

const tabMocks = vi.hoisted(() => ({ openCurrent: vi.fn() }));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (select: (state: { openCurrent: () => void }) => unknown) =>
    select({ openCurrent: tabMocks.openCurrent }),
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));
const sfxMocks = vi.hoisted(() => ({
  play: vi.fn(() => Promise.resolve()),
  stop: vi.fn(() => Promise.resolve()),
}));
vi.mock("@anlg/plugin-sfx", () => ({ commands: sfxMocks }));
vi.mock("~/analytics", () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock("~/auth", () => ({ useAuth: () => ({ signIn: vi.fn() }) }));
vi.mock("~/shared/window-shell", () => ({
  StandaloneWindowShell: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("./account", () => ({ LoginSection: () => null }));
const detectMocks = vi.hoisted(() => ({
  detectImportSources: vi.fn(async (): Promise<unknown[]> => [{ id: "zoom" }]),
}));
vi.mock("~/imports/detection", () => ({
  detectImportSources: detectMocks.detectImportSources,
}));
vi.mock("./calendar", () => ({
  CalendarSection: ({
    onContinue,
  }: {
    onContinue: (connected?: boolean) => void;
  }) => (
    <>
      <button onClick={() => onContinue()}>Calendar done</button>
      <button onClick={() => onContinue(false)}>Calendar none on</button>
    </>
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
  PermissionsSection: ({
    onContinue,
  }: {
    onContinue: (setUpLater?: boolean) => void;
  }) => (
    <>
      <button onClick={() => onContinue()}>Permissions done</button>
      <button onClick={() => onContinue(true)}>Permissions later</button>
    </>
  ),
}));
vi.mock("./transcription", () => ({
  TranscriptionSetupSection: ({
    onContinue,
  }: {
    onContinue: (failed?: boolean, downloading?: boolean) => void;
  }) => (
    <>
      <button onClick={() => onContinue()}>Transcription done</button>
      <button onClick={() => onContinue(false, true)}>
        Transcription still downloading
      </button>
    </>
  ),
}));
vi.mock("./final", () => ({
  FinalDescription: () => null,
  FinalSection: ({
    onContinue,
  }: {
    onContinue: (sessionId: string) => void;
  }) => <button onClick={() => onContinue("welcome-session")}>Finish</button>,
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
    expect(title.className).toContain("font-display");

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

  it("titles completed steps by what happened, not success", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StandaloneOnboardingScreen onFinish={vi.fn()} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("Permissions later"));
    fireEvent.click(screen.getByText("Transcription still downloading"));
    fireEvent.click(screen.getByText("Calendar none on"));

    expect(screen.getByText("Permissions: set up later")).toBeTruthy();
    expect(screen.queryByText("Permissions granted")).toBeNull();
    expect(screen.getByText("Transcription downloading")).toBeTruthy();
    expect(screen.queryByText("Transcription set up")).toBeNull();
    expect(screen.getByText("Calendar skipped")).toBeTruthy();
    expect(screen.queryByText("Calendar connected")).toBeNull();
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

  // Fork: Upshot makes no sounds, so onboarding has no music or toggle.
  it("plays no background music and offers no music toggle", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StandaloneOnboardingScreen onFinish={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("button", { name: "Play music" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mute music" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(sfxMocks.play).not.toHaveBeenCalled();
  });

  // Fork: no decorative moving bars (owner, Oct 3; WCAG 2.2 SC 2.2.2): they
  // looked like a live sound meter during setup.
  it("shows no decorative moving bars", () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <StandaloneOnboardingScreen onFinish={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(
      container.querySelector(".animate-anarlog-dancing-stick"),
    ).toBeNull();
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

  it("lands on Home, not the Welcome note, after Open Upshot", () => {
    tabMocks.openCurrent.mockClear();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TabContentOnboarding tab={{ type: "onboarding" } as never} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("Permissions done"));
    fireEvent.click(screen.getByText("Transcription done"));
    fireEvent.click(screen.getByText("Calendar done"));
    fireEvent.click(screen.getByText("Import done"));
    fireEvent.click(screen.getByText("Finish"));

    expect(tabMocks.openCurrent).toHaveBeenCalledWith({ type: "empty" });
  });

  it("leaves the imports step out of the count when no meeting app is found", async () => {
    detectMocks.detectImportSources.mockResolvedValueOnce([]);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StandaloneOnboardingScreen onFinish={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Step 1 of 4")).toBeTruthy();
    fireEvent.click(screen.getByText("Permissions done"));
    fireEvent.click(screen.getByText("Transcription done"));
    fireEvent.click(screen.getByText("Calendar done"));
    // Straight from calendar to the last step, counted as 4 of 4.
    expect(screen.getByText("Step 4 of 4")).toBeTruthy();
    expect(screen.queryByText("Import done")).toBeNull();
  });

  it("keeps the imports step when a meeting app is found", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StandaloneOnboardingScreen onFinish={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Step 1 of 5")).toBeTruthy();
  });
});
