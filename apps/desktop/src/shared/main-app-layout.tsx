import { Outlet, useNavigate } from "@tanstack/react-router";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import {
  events as windowsEvents,
  getCurrentWebviewWindowLabel,
} from "@anlg/plugin-windows";
import { useMountEffect } from "@anlg/ui/hooks/use-mount-effect";

import {
  KeyboardShortcutsDialog,
  openKeyboardShortcuts,
} from "./keyboard-shortcuts-dialog";
import {
  openNewNoteAndListen,
  openSessionAndListen,
  useNewNote,
} from "./useNewNote";

import { AuthProvider } from "~/auth";
import { BillingProvider } from "~/auth/billing";
import { EnterpriseCaptureSync } from "~/enterprise-capture/lifecycle";
import { MeetingImportSync } from "~/services/meeting-import-sync";
import { getOrCreateSessionForEventId } from "~/session/queries";
import { WorkspaceInvitationToasts } from "~/settings/team/invitation-toast";
import { useMyWorkspacesWithMirror } from "~/settings/team/mirror";
import { useZoomShortcuts } from "~/shared/zoom";
import { UndoDeleteToast } from "~/sidebar/toast/undo-delete-toast";
import { isTabInputSupported, useTabs } from "~/store/zustand/tabs";

export default function MainAppLayout() {
  useNavigationEvents();
  useZoomShortcuts();

  return (
    <AuthProvider>
      <BillingProvider>
        <SharedWorkspaceMirror />
        <MainAppContent />
      </BillingProvider>
    </AuthProvider>
  );
}

function MainAppContent() {
  const isMainWindow = getCurrentWebviewWindowLabel() === "main";

  return (
    <>
      <Outlet />
      {isMainWindow ? <MeetingImportSync /> : null}
      {isMainWindow ? <EnterpriseCaptureSync /> : null}
      {isMainWindow ? <WorkspaceInvitationToasts /> : null}
      <UndoDeleteToast />
      <KeyboardShortcutsDialog />
    </>
  );
}

const useNavigationEvents = () => {
  const navigate = useNavigate();
  const openNew = useTabs((state) => state.openNew);
  const openNewNote = useNewNote({ behavior: "new" });

  useMountEffect(() => {
    const navigateFromNative = (path: string) => {
      const match = path.match(/^\/app\/([^/]+)\/(.+)$/);
      if (!match) return;
      const [, type, id] = match;
      if (type === "session") {
        openNew({ type: "sessions", id });
      } else if (type === "human") {
        openNew({
          type: "contacts",
          state: { selected: { type: "person", id } },
        });
      } else if (type === "organization") {
        openNew({
          type: "contacts",
          state: { selected: { type: "organization", id } },
        });
      }
    };
    (window as any).__ANARLOG_NAVIGATE__ = navigateFromNative;

    let unlistenNavigate: (() => void) | undefined;
    let unlistenOpenTab: (() => void) | undefined;
    let cancelled = false;

    const webview = getCurrentWebviewWindow();
    const stopTrackingKeys = trackHandledShortcuts();

    void windowsEvents
      .navigate(webview)
      .listen(({ payload }) => {
        if (payload.path === "/app/new") {
          const calendarEventId = payload.search?.calendarEventId;
          const shouldRecord = payload.search?.record === "true";

          if (typeof calendarEventId === "string" && calendarEventId) {
            void getOrCreateSessionForEventId(calendarEventId)
              .then((sessionId) => {
                if (shouldRecord) {
                  openSessionAndListen(sessionId, { behavior: "new" });
                  return;
                }

                openNew({
                  type: "sessions",
                  id: sessionId,
                  state: {
                    view: null,
                    autoStart: null,
                    scheduledAutoStart: null,
                  },
                });
              })
              .catch((error) => {
                console.error(
                  "[navigation] failed to open calendar event",
                  error,
                );
              });
          } else {
            routeNewNote(payload.search ?? null, { openNewNote });
          }
        } else if (payload.path === "/app/menu") {
          runMenuAction(payload.search?.action);
        } else if (payload.path === "/app/settings") {
          const tab = (payload.search?.tab as string) ?? "app";
          openNew({ type: "settings", state: { tab } });
        } else {
          void navigate({
            to: payload.path,
            search: payload.search ?? undefined,
          });
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlistenNavigate = fn;
        }
      });

    void windowsEvents
      .openTab(webview)
      .listen(({ payload }) => {
        if (payload.tab.type === "sessions" && payload.tab.id === "new") {
          routeNewSessionTab(payload.tab.state?.autoStart, { openNewNote });
        } else if (!isTabInputSupported(payload.tab)) {
          return;
        } else {
          openNew(payload.tab);
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlistenOpenTab = fn;
        }
      });

    return () => {
      cancelled = true;
      if ((window as any).__ANARLOG_NAVIGATE__ === navigateFromNative) {
        delete (window as any).__ANARLOG_NAVIGATE__;
      }
      unlistenNavigate?.();
      unlistenOpenTab?.();
      stopTrackingKeys();
    };
  });
};

// Fork: native menu accelerators (File › New note ⌘N, Blank note ⇧⌘N, Edit ›
// Find ⌘F, View › Show sidebar ⌘\) share keys with the web hotkeys. When a web
// hotkey already took the key press (it calls preventDefault), the menu event
// that may follow is dropped, so one press never acts twice.
const HANDLED_WINDOW_MS = 500;
let lastHandledShortcut: { combo: string; at: number } | null = null;

function shortcutCombo(event: {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  code?: string;
}) {
  return [
    event.metaKey || event.ctrlKey ? "mod" : "",
    event.shiftKey ? "shift" : "",
    event.altKey ? "alt" : "",
    event.code ?? "",
  ]
    .filter(Boolean)
    .join("+");
}

export function trackHandledShortcuts() {
  // Bubble phase on window: runs after react-hotkeys-hook's document listener.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      lastHandledShortcut = { combo: shortcutCombo(event), at: Date.now() };
    }
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}

function webJustHandled(combo: string) {
  return (
    lastHandledShortcut !== null &&
    lastHandledShortcut.combo === combo &&
    Date.now() - lastHandledShortcut.at < HANDLED_WINDOW_MS
  );
}

// Fork: /app/new with no search is File › New note (⌘N) and the Dock's New
// note: create a note and start recording, as Granola does. record=false is
// Blank note (UX audit Oct 3, A: NN/g #4).
export function routeNewNote(
  search: Record<string, unknown> | null,
  { openNewNote }: { openNewNote: () => void },
) {
  if (search?.record === "false") {
    if (webJustHandled("mod+shift+KeyN")) return;
    openNewNote();
    return;
  }
  if (webJustHandled("mod+KeyN")) return;
  openNewNoteAndListen({ behavior: "new" });
}

// Fork: the tray's New note asks for autoStart; honor it so it records
// (UX audit Oct 3, A P1: NN/g #1, #4).
export function routeNewSessionTab(
  autoStart: boolean | null | undefined,
  { openNewNote }: { openNewNote: () => void },
) {
  if (autoStart) {
    openNewNoteAndListen({ behavior: "new" });
  } else {
    openNewNote();
  }
}

const MENU_SHORTCUTS: Record<string, KeyboardEventInit> = {
  find: { key: "f", code: "KeyF", metaKey: true },
  "toggle-sidebar": { key: "\\", code: "Backslash", metaKey: true },
};

// Menu items whose work lives in web hotkeys replay that hotkey, so the menu
// and the keyboard always do the same thing.
export function runMenuAction(action: unknown) {
  if (action === "shortcuts") {
    openKeyboardShortcuts();
    return;
  }
  if (typeof action !== "string") return;
  const init = MENU_SHORTCUTS[action];
  if (!init || webJustHandled(shortcutCombo(init))) return;
  const target = document.activeElement ?? document.body;
  for (const type of ["keydown", "keyup"] as const) {
    target.dispatchEvent(
      new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }),
    );
  }
}

// Renders nothing; keeps the local workspace mirror fresh so sharing scopes are
// available without visiting Team settings.
function SharedWorkspaceMirror() {
  useMyWorkspacesWithMirror();
  return null;
}
