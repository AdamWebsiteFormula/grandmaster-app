import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  execute: vi.fn(),
  listenerState: {
    live: {
      sessionId: null as string | null,
      status: "inactive",
      captureGenerationBySession: {} as Record<string, number>,
    },
    stop: vi.fn(),
  },
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));

vi.mock("~/db", () => ({
  liveQueryClient: { execute: mocks.execute },
}));

vi.mock("~/session/queries", () => ({
  createSession: mocks.createSession,
}));

vi.mock("~/store/zustand/listener/instance", () => ({
  listenerStore: {
    getState: () => mocks.listenerState,
  },
}));

import {
  welcomeNoteMarkdown,
  getOrCreateWelcomeSession,
  setPendingWelcomeSession,
  stopActiveWelcomeDemo,
  takePendingWelcomeSession,
} from "./welcome-note";
import { buildWelcomeNoteDemoUrl } from "./welcome-note.constants";

beforeEach(() => {
  vi.clearAllMocks();
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  });
  mocks.listenerState.live = {
    sessionId: null,
    status: "inactive",
    captureGenerationBySession: {},
  };
});

it("reuses an existing onboarding welcome note", async () => {
  mocks.execute.mockResolvedValueOnce([{ id: "welcome-session" }]);

  await expect(getOrCreateWelcomeSession()).resolves.toBe("welcome-session");
  expect(mocks.createSession).not.toHaveBeenCalled();
  expect(mocks.execute).toHaveBeenCalledWith(expect.any(String), [
    "anarlog-onboarding-demo-v1",
  ]);
});

it("creates a welcome note with normal meeting metadata", async () => {
  mocks.execute.mockResolvedValueOnce([]);
  mocks.createSession.mockResolvedValueOnce("welcome-session");

  await expect(getOrCreateWelcomeSession()).resolves.toBe("welcome-session");

  const [title, , initial] = mocks.createSession.mock.calls[0];
  const event = JSON.parse(initial.event_json);
  expect(title).toBe("Welcome to Upshot");
  // Fork: no hosted demo, so no meeting link (and no Join & record button).
  expect(event.meeting_link).toBe("");
  expect(event.tracking_id).toBe("anarlog-onboarding-demo-v1");
  expect(() => JSON.parse(initial.raw_md)).not.toThrow();
});

it("carries the welcome note across a one-time onboarding relaunch", () => {
  setPendingWelcomeSession("welcome-session");

  expect(takePendingWelcomeSession()).toBe("welcome-session");
  expect(takePendingWelcomeSession()).toBeNull();
});

it("stops an active welcome demo after its browser callback", async () => {
  mocks.listenerState.live = {
    sessionId: "welcome-session",
    status: "active",
    captureGenerationBySession: { "welcome-session": 1 },
  };
  mocks.execute.mockResolvedValueOnce([{ id: "welcome-session" }]);

  await stopActiveWelcomeDemo();

  expect(mocks.execute).toHaveBeenCalledWith(expect.any(String), [
    "welcome-session",
    "anarlog-onboarding-demo-v1",
  ]);
  expect(mocks.listenerState.stop).toHaveBeenCalledOnce();
});

it("ignores a demo callback while another session is active", async () => {
  mocks.listenerState.live = {
    sessionId: "regular-session",
    status: "active",
    captureGenerationBySession: { "regular-session": 1 },
  };
  mocks.execute.mockResolvedValueOnce([]);

  await stopActiveWelcomeDemo();

  expect(mocks.listenerState.stop).not.toHaveBeenCalled();
});

it("does not stop a newer capture of the welcome session", async () => {
  mocks.listenerState.live = {
    sessionId: "welcome-session",
    status: "active",
    captureGenerationBySession: { "welcome-session": 1 },
  };
  let finishQuery!: (rows: { id: string }[]) => void;
  mocks.execute.mockReturnValueOnce(
    new Promise((resolve) => {
      finishQuery = resolve;
    }),
  );

  const completion = stopActiveWelcomeDemo();
  mocks.listenerState.live = {
    sessionId: "welcome-session",
    status: "active",
    captureGenerationBySession: { "welcome-session": 2 },
  };
  finishQuery([{ id: "welcome-session" }]);
  await completion;

  expect(mocks.listenerState.stop).not.toHaveBeenCalled();
});

it("ignores a demo callback when listening already stopped", async () => {
  mocks.listenerState.live = {
    sessionId: "welcome-session",
    status: "inactive",
    captureGenerationBySession: {},
  };

  await stopActiveWelcomeDemo();

  expect(mocks.execute).not.toHaveBeenCalled();
  expect(mocks.listenerState.stop).not.toHaveBeenCalled();
});

it("auto-joins the hosted demo and optionally attaches a completion callback", () => {
  expect(
    buildWelcomeNoteDemoUrl("https://github.com/AdamWebsiteFormula/upshot"),
  ).toBe("https://github.com/AdamWebsiteFormula/upshot?autojoin=1");
  expect(
    buildWelcomeNoteDemoUrl(
      "https://github.com/AdamWebsiteFormula/upshot",
      43210,
    ),
  ).toBe(
    "https://github.com/AdamWebsiteFormula/upshot?autojoin=1&completion_url=http%3A%2F%2F127.0.0.1%3A43210%2Fonboarding-demo%2Fcomplete",
  );
});

it("points to New note on Home and says what leaves the computer", () => {
  const mac = welcomeNoteMarkdown("macos");
  expect(mac).toContain("on Home, click **New note** at the top right");
  expect(mac).toContain("press **⌘N**");
  expect(mac).toContain(
    "Recordings, notes and transcripts are stored on this Mac.",
  );
  expect(mac).toContain(
    "While you record, audio streams to Upshot transcription (Deepgram), which keeps nothing.",
  );
  expect(mac).toContain(
    "When Upshot writes a summary, the note and transcript go to Upshot AI, which keeps nothing.",
  );
});

it.each(["windows", "linux"])("uses Ctrl+N and no Mac words on %s", (os) => {
  const note = welcomeNoteMarkdown(os);
  expect(note).toContain("press **Ctrl+N**");
  expect(note).toContain("your computer's sound");
  expect(note).toContain("stored on this computer");
  expect(note).not.toMatch(/Mac|⌘/);
});
