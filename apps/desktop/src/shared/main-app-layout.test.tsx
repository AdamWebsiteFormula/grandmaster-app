import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  windowLabel: "main",
}));

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="outlet" />,
  useNavigate: () => vi.fn(),
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({}),
}));

vi.mock("@anlg/plugin-windows", () => ({
  events: {},
  getCurrentWebviewWindowLabel: () => mocks.windowLabel,
}));

const newNote = vi.hoisted(() => ({ openNewNoteAndListen: vi.fn() }));

vi.mock("./useNewNote", () => ({
  openNewNoteAndListen: newNote.openNewNoteAndListen,
  openSessionAndListen: vi.fn(),
  useNewNote: () => vi.fn(),
}));

vi.mock("~/auth", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

vi.mock("~/auth/billing", () => ({
  BillingProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("~/enterprise-capture/lifecycle", () => ({
  EnterpriseCaptureSync: () => <div data-testid="enterprise-capture-sync" />,
}));

vi.mock("~/session/queries", () => ({
  getOrCreateSessionForEventId: vi.fn(),
}));

vi.mock("~/services/meeting-import-sync", () => ({
  MeetingImportSync: () => <div data-testid="meeting-import-sync" />,
}));

vi.mock("~/settings/team/mirror", () => ({
  useMyWorkspacesWithMirror: vi.fn(),
}));

vi.mock("~/settings/team/invitation-toast", () => ({
  WorkspaceInvitationToasts: () => (
    <div data-testid="workspace-invitation-toasts" />
  ),
}));

vi.mock("@anlg/ui/hooks/use-mount-effect", () => ({
  useMountEffect: vi.fn(),
}));

vi.mock("~/sidebar/toast/undo-delete-toast", () => ({
  UndoDeleteToast: () => null,
}));

vi.mock("~/store/zustand/tabs", () => ({
  isTabInputSupported: vi.fn(),
  useTabs: () => vi.fn(),
}));

import MainAppLayout, {
  routeNewNote,
  routeNewSessionTab,
  runMenuAction,
  trackHandledShortcuts,
} from "./main-app-layout";

describe("MainAppLayout", () => {
  beforeEach(() => {
    mocks.windowLabel = "main";
  });

  afterEach(cleanup);

  it("mounts main-window sync services inside the auth provider", () => {
    render(<MainAppLayout />);

    const authProvider = screen.getByTestId("auth-provider");
    expect(
      authProvider.contains(screen.getByTestId("meeting-import-sync")),
    ).toBe(true);
    expect(
      authProvider.contains(screen.getByTestId("enterprise-capture-sync")),
    ).toBe(true);
    expect(
      authProvider.contains(screen.getByTestId("workspace-invitation-toasts")),
    ).toBe(true);
  });

  it("does not mount connected import sync in secondary windows", () => {
    mocks.windowLabel = "note";

    render(<MainAppLayout />);

    expect(screen.queryByTestId("meeting-import-sync")).toBeNull();
    expect(screen.queryByTestId("enterprise-capture-sync")).toBeNull();
    expect(screen.queryByTestId("workspace-invitation-toasts")).toBeNull();
  });
});

// UX audit Oct 3, A P1/P2: the tray, File menu and Dock New note record.
describe("native New note routing", () => {
  beforeEach(() => {
    newNote.openNewNoteAndListen.mockClear();
  });

  it("starts recording when the tray asks for autoStart", () => {
    const openNewNote = vi.fn();

    routeNewSessionTab(true, { openNewNote });

    expect(newNote.openNewNoteAndListen).toHaveBeenCalledWith({
      behavior: "new",
    });
    expect(openNewNote).not.toHaveBeenCalled();
  });

  it("opens a blank note when autoStart is not set", () => {
    const openNewNote = vi.fn();

    routeNewSessionTab(null, { openNewNote });

    expect(openNewNote).toHaveBeenCalledTimes(1);
    expect(newNote.openNewNoteAndListen).not.toHaveBeenCalled();
  });

  it("records for /app/new with no search, and record=false is blank", () => {
    const openNewNote = vi.fn();

    routeNewNote(null, { openNewNote });
    expect(newNote.openNewNoteAndListen).toHaveBeenCalledTimes(1);

    routeNewNote({ record: "false" }, { openNewNote });
    expect(openNewNote).toHaveBeenCalledTimes(1);
    expect(newNote.openNewNoteAndListen).toHaveBeenCalledTimes(1);
  });

  it("replays Edit › Find as the web ⌘F hotkey", () => {
    const seen: string[] = [];
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey) seen.push(event.code);
    };
    document.addEventListener("keydown", onKey);

    runMenuAction("find");

    document.removeEventListener("keydown", onKey);
    expect(seen).toEqual(["KeyF"]);
  });

  it("drops the menu event when a web hotkey already took the key press", () => {
    const stop = trackHandledShortcuts();
    const event = new KeyboardEvent("keydown", {
      key: "n",
      code: "KeyN",
      metaKey: true,
      cancelable: true,
    });
    event.preventDefault();
    window.dispatchEvent(event);

    routeNewNote(null, { openNewNote: vi.fn() });

    stop();
    expect(newNote.openNewNoteAndListen).not.toHaveBeenCalled();
  });
});
