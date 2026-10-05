import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StandaloneOnboardingScreen, TabContentOnboarding } from "./index";

import {
  cancelUpshotOAuth,
  resetUpshotAccountForTests,
  useUpshotAccount,
} from "~/upshot-plan/session";
import { finishUpshotSignIn, useUpshotSignIn } from "~/upshot-plan/sign-in";

const tabMocks = vi.hoisted(() => ({ openCurrent: vi.fn() }));
vi.mock("~/store/zustand/tabs", () => ({
  useTabs: (select: (state: { openCurrent: () => void }) => unknown) =>
    select({ openCurrent: tabMocks.openCurrent }),
}));

const platformMock = vi.hoisted(() => ({ name: "macos" }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => platformMock.name }));
const signInMocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  openUrl: vi.fn(async () => ({ status: "ok", data: null })),
}));
vi.mock("~/env", () => ({
  env: { VITE_AI_API_URL: "https://upshot-ai.example.workers.dev" },
}));
vi.mock("~/ai/provider-fetch", () => ({ providerFetch: signInMocks.fetch }));
vi.mock("@anlg/plugin-opener2", () => ({
  commands: { openUrl: signInMocks.openUrl },
}));
vi.mock("@anlg/plugin-deeplink2", () => ({
  commands: {
    startCallbackServer: vi.fn(async () => ({ status: "ok", data: 4321 })),
    stopCallbackServer: vi.fn(async () => ({ status: "ok", data: null })),
  },
}));
vi.mock("@anlg/plugin-store2", () => ({
  commands: {
    getSecret: vi.fn(async () => ({ status: "ok", data: null })),
    setSecret: vi.fn(async () => ({ status: "ok", data: null })),
    deleteSecret: vi.fn(async () => ({ status: "ok", data: null })),
  },
}));
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

// Fork: the account step comes first (Google or Microsoft, as Granola). The
// real LoginSection runs here; tests sign in through the account store.
function signIn() {
  act(() => {
    useUpshotAccount.setState({
      loaded: true,
      session: {
        access_token: "access",
        refresh_token: "refresh",
        expires_at: Date.now() / 1000 + 3600,
        email: "judge@example.com",
      },
    });
  });
}

function renderOnboarding() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <StandaloneOnboardingScreen onFinish={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("StandaloneOnboardingScreen", () => {
  afterEach(() => {
    cleanup();
    platformMock.name = "macos";
    cancelUpshotOAuth();
    useUpshotSignIn.setState({ waitingFor: null, error: null });
    resetUpshotAccountForTests();
    signInMocks.fetch.mockReset();
    signInMocks.openUrl.mockClear();
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

  // Fork: sign-in is the first step on every computer, with no Skip.
  it("starts with Sign in to Upshot, with Google and Microsoft and no Skip", () => {
    renderOnboarding();

    expect(
      screen.getByRole("heading", { level: 2, name: "Sign in to Upshot" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "A free account turns on Upshot AI and Upshot transcription. Your notes stay on this computer.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Continue with Microsoft" }),
    ).toBeTruthy();
    expect(screen.queryByText("Skip")).toBeNull();
    expect(screen.queryByRole("button", { name: /skip/i })).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.getByRole("button", { name: "privacy policy" })).toBeTruthy();
    // Nothing after it shows yet.
    expect(screen.queryByText("Permissions done")).toBeNull();
    expect(screen.queryByText("Start with permissions")).toBeNull();
  });

  it("shows no Back on the sign-in step and counts it as step 1", async () => {
    renderOnboarding();
    expect(await screen.findByText("Step 1 of 6")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("moves on to permissions as soon as sign-in finishes", () => {
    renderOnboarding();
    expect(screen.queryByText("Permissions done")).toBeNull();

    signIn();

    expect(screen.getByText("Permissions done")).toBeTruthy();
    expect(screen.getByText("Signed in")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).toBeNull();
  });

  it("signing in with Google in the browser moves on", async () => {
    signInMocks.fetch.mockResolvedValue(
      Response.json({
        access_token: "access",
        refresh_token: "refresh",
        expires_at: Date.now() / 1000 + 3600,
        user: { id: "u", email: "judge@example.com" },
      }),
    );
    renderOnboarding();

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    await waitFor(() => expect(signInMocks.openUrl).toHaveBeenCalled());
    expect(
      screen.getByText("Finish signing in with Google in your browser."),
    ).toBeTruthy();
    expect(screen.queryByText("Permissions done")).toBeNull();

    // The browser comes back with the code.
    await act(() => finishUpshotSignIn("the-code"));

    await waitFor(() =>
      expect(screen.getByText("Permissions done")).toBeTruthy(),
    );
    expect(useUpshotAccount.getState().session?.email).toBe(
      "judge@example.com",
    );
  });

  it("stays on sign-in and says so when the browser sign-in didn't finish", async () => {
    renderOnboarding();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Microsoft" }),
    );
    await waitFor(() => expect(signInMocks.openUrl).toHaveBeenCalled());
    await act(() => finishUpshotSignIn(null));

    expect(screen.getByRole("alert").textContent).toBe(
      "Sign-in didn't finish. Try again.",
    );
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeTruthy();
    expect(screen.queryByText("Permissions done")).toBeNull();
  });

  it("Back from permissions shows who is signed in, with Continue", () => {
    renderOnboarding();
    signIn();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("Signed in as judge@example.com")).toBeTruthy();
    expect(screen.queryByText("Permissions done")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Permissions done")).toBeTruthy();
  });

  it("on other computers, sign-in is first, then imports and the last step", async () => {
    platformMock.name = "windows";
    renderOnboarding();

    expect(
      screen.getByRole("heading", { level: 2, name: "Sign in to Upshot" }),
    ).toBeTruthy();
    expect(await screen.findByText("Step 1 of 3")).toBeTruthy();
    expect(screen.queryByText("Skip")).toBeNull();

    signIn();
    expect(screen.getByText("Import done")).toBeTruthy();
    expect(screen.queryByText("Permissions done")).toBeNull();
    fireEvent.click(screen.getByText("Import done"));
    expect(screen.getByText("Finish")).toBeTruthy();
  });

  function renderAtCalendar() {
    renderOnboarding();
    signIn();
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
    renderOnboarding();
    signIn();
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

    expect(screen.getByText("Step 4 of 6")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 3 of 6")).toBeTruthy();
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
    signIn();
    fireEvent.click(screen.getByText("Permissions done"));
    fireEvent.click(screen.getByText("Transcription done"));
    fireEvent.click(screen.getByText("Calendar done"));
    fireEvent.click(screen.getByText("Import done"));
    fireEvent.click(screen.getByText("Finish"));

    expect(tabMocks.openCurrent).toHaveBeenCalledWith({ type: "empty" });
  });

  it("leaves the imports step out of the count when no meeting app is found", async () => {
    detectMocks.detectImportSources.mockResolvedValueOnce([]);
    renderOnboarding();

    expect(await screen.findByText("Step 1 of 5")).toBeTruthy();
    signIn();
    fireEvent.click(screen.getByText("Permissions done"));
    fireEvent.click(screen.getByText("Transcription done"));
    fireEvent.click(screen.getByText("Calendar done"));
    // Straight from calendar to the last step, counted as 5 of 5.
    expect(screen.getByText("Step 5 of 5")).toBeTruthy();
    expect(screen.queryByText("Import done")).toBeNull();
  });

  it("keeps the imports step when a meeting app is found", async () => {
    renderOnboarding();
    expect(await screen.findByText("Step 1 of 6")).toBeTruthy();
  });
});
