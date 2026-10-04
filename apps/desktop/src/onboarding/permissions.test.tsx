import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const createPermission = () => ({
    status: "denied" as "authorized" | "denied" | "neverRequested",
    confirmedStatus: "denied" as "authorized" | "denied" | "neverRequested",
    isPending: false,
    open: vi.fn(),
    request: vi.fn(),
    reset: vi.fn(),
    recheck: vi.fn(),
    error: null as string | null,
  });
  const permissions = {
    microphone: createPermission(),
    systemAudio: createPermission(),
    accessibility: createPermission(),
  };

  return {
    currentPlatform: "macos",
    permissions,
    guidance: null as { assisted: boolean; paneTitle: string | null } | null,
    usePermission: vi.fn((type: keyof typeof permissions) => permissions[type]),
    closePermissionAssistant: vi.fn(),
    relaunch: vi.fn(),
  };
});

const lingui = vi.hoisted(() => ({
  t: (input: TemplateStringsArray, ...values: unknown[]) =>
    input.reduce(
      (message, part, index) =>
        `${message}${part}${index < values.length ? String(values[index]) : ""}`,
      "",
    ),
}));

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: lingui.t }),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: () => mocks.currentPlatform,
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: mocks.relaunch,
}));

const toastMocks = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@anlg/ui/components/ui/toast", () => ({ toast: toastMocks }));

vi.mock("~/shared/hooks/usePermissions", () => ({
  usePermission: mocks.usePermission,
  usePermissionGuidance: () => mocks.guidance,
  closePermissionAssistant: mocks.closePermissionAssistant,
}));

import { PermissionsSection } from "./permissions";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PermissionsSection", () => {
  beforeEach(() => {
    mocks.currentPlatform = "macos";
    mocks.guidance = null;
    vi.clearAllMocks();

    Object.values(mocks.permissions).forEach((permission) => {
      permission.status = "denied";
      permission.confirmedStatus = "denied";
      permission.isPending = false;
      permission.error = null;
    });
  });

  it("continues on its own once all three macOS permissions are on", () => {
    const onContinue = vi.fn();
    mocks.permissions.microphone.status = "authorized";
    mocks.permissions.microphone.confirmedStatus = "authorized";
    mocks.permissions.systemAudio.status = "authorized";
    mocks.permissions.systemAudio.confirmedStatus = "authorized";

    const view = render(<PermissionsSection onContinue={onContinue} />);

    expect(onContinue).not.toHaveBeenCalled();

    mocks.permissions.accessibility.status = "authorized";

    mocks.permissions.accessibility.confirmedStatus = "authorized";
    view.rerender(<PermissionsSection onContinue={onContinue} />);

    expect(onContinue).toHaveBeenCalledTimes(1);

    view.rerender(<PermissionsSection onContinue={onContinue} />);

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  // UX audit Oct 3, A P1: mic + system audio are enough, as in Granola.
  it("completes without Accessibility through a secondary button", () => {
    const onContinue = vi.fn();
    mocks.permissions.microphone.status = "authorized";
    mocks.permissions.microphone.confirmedStatus = "authorized";
    mocks.permissions.systemAudio.status = "authorized";
    mocks.permissions.systemAudio.confirmedStatus = "authorized";

    render(<PermissionsSection onContinue={onContinue} />);

    expect(onContinue).not.toHaveBeenCalled();
    expect(
      screen.getByText("You can turn this on later in Settings."),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue without meeting details" }),
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("offers no way past the step until mic and system audio are on", () => {
    mocks.permissions.microphone.status = "authorized";
    mocks.permissions.microphone.confirmedStatus = "authorized";

    render(<PermissionsSection onContinue={vi.fn()} />);

    expect(
      screen.queryByRole("button", {
        name: "Continue without meeting details",
      }),
    ).toBeNull();
  });

  it("says where to fix a denied permission and shows its error as text", () => {
    mocks.permissions.systemAudio.error = "Screen recording is off";

    render(<PermissionsSection />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Turn on microphone in System Settings",
      }),
    );
    expect(mocks.permissions.microphone.open).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Screen recording is off").className).toContain(
      "text-destructive",
    );
  });

  it("shows Continue, not an automatic jump, when returning to a finished step", () => {
    const onContinue = vi.fn();
    Object.values(mocks.permissions).forEach((permission) => {
      permission.status = "authorized";
      permission.confirmedStatus = "authorized";
    });

    render(
      <PermissionsSection
        onContinue={onContinue}
        continuedRef={{ current: true }}
      />,
    );

    expect(onContinue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("does not continue on an optimistic, unconfirmed grant", () => {
    const onContinue = vi.fn();
    mocks.permissions.microphone.status = "authorized";
    mocks.permissions.systemAudio.status = "authorized";
    mocks.permissions.accessibility.status = "authorized";

    render(<PermissionsSection onContinue={onContinue} />);

    expect(onContinue).not.toHaveBeenCalled();
  });

  it("preserves the audio-only flow outside macOS", () => {
    const onContinue = vi.fn();
    mocks.currentPlatform = "windows";
    mocks.permissions.microphone.status = "authorized";
    mocks.permissions.microphone.confirmedStatus = "authorized";
    mocks.permissions.systemAudio.status = "authorized";
    mocks.permissions.systemAudio.confirmedStatus = "authorized";

    render(<PermissionsSection onContinue={onContinue} />);

    expect(screen.queryByText("Help Anarlog read meeting activity")).toBeNull();
    expect(mocks.usePermission).not.toHaveBeenCalledWith("accessibility");
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("retries denied runtime audio probes outside macOS", () => {
    mocks.currentPlatform = "linux";
    mocks.permissions.microphone.error = "microphone device unavailable";
    mocks.permissions.systemAudio.error = "PipeWire source unavailable";

    render(<PermissionsSection />);

    fireEvent.click(
      screen.getByRole("button", { name: "Try again: Microphone" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Try again: System audio" }),
    );

    expect(mocks.permissions.microphone.request).toHaveBeenCalledOnce();
    expect(mocks.permissions.systemAudio.request).toHaveBeenCalledOnce();
    expect(mocks.permissions.microphone.open).not.toHaveBeenCalled();
    expect(mocks.permissions.systemAudio.open).not.toHaveBeenCalled();
  });

  it("requests denied Accessibility permission instead of opening Settings", () => {
    render(<PermissionsSection />);

    fireEvent.click(
      screen.getByRole("button", { name: "Help Upshot read meeting details" }),
    );

    expect(mocks.permissions.accessibility.request).toHaveBeenCalledTimes(1);
    expect(mocks.permissions.accessibility.open).not.toHaveBeenCalled();
  });

  it("routes an assisted Accessibility pane to the guided flow", () => {
    mocks.guidance = { assisted: true, paneTitle: "Accessibility" };

    render(<PermissionsSection />);

    const row = screen.getByRole("button", {
      name: "Help Upshot read meeting details",
    });
    fireEvent.click(row);

    expect(mocks.permissions.accessibility.open).toHaveBeenCalledTimes(1);
    expect(mocks.permissions.accessibility.request).not.toHaveBeenCalled();
  });

  it("dismisses a lingering assistant when onboarding unmounts", () => {
    mocks.guidance = { assisted: true, paneTitle: "Accessibility" };
    const view = render(<PermissionsSection />);

    expect(mocks.closePermissionAssistant).not.toHaveBeenCalled();

    view.unmount();

    expect(mocks.closePermissionAssistant).toHaveBeenCalledTimes(1);
  });

  it("re-checks Accessibility when the window regains focus", () => {
    render(<PermissionsSection />);

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(mocks.permissions.accessibility.recheck).toHaveBeenCalledTimes(1);
  });

  it("offers a restart when Accessibility is still off 10 s after returning", () => {
    vi.useFakeTimers();
    mocks.guidance = { assisted: true, paneTitle: "Accessibility" };
    const view = render(<PermissionsSection />);
    const restartName = "Turned it on? Restart Upshot";

    fireEvent.click(
      screen.getByRole("button", { name: "Help Upshot read meeting details" }),
    );
    act(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });
    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(screen.queryByRole("button", { name: restartName })).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    fireEvent.click(screen.getByRole("button", { name: restartName }));
    expect(mocks.relaunch).toHaveBeenCalledTimes(1);

    mocks.permissions.accessibility.status = "authorized";
    mocks.permissions.accessibility.confirmedStatus = "authorized";
    view.rerender(<PermissionsSection />);
    expect(screen.queryByRole("button", { name: restartName })).toBeNull();
  });

  it("does not offer a restart before the user has opened Settings", () => {
    vi.useFakeTimers();
    render(<PermissionsSection />);

    act(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(20_000);
    });

    expect(
      screen.queryByRole("button", { name: "Turned it on? Restart Upshot" }),
    ).toBeNull();
  });

  it("names the Screen & System Audio Recording pane when system audio is denied", () => {
    render(<PermissionsSection />);

    expect(
      screen.getByRole("button", {
        name: "Turn on Upshot in Screen & System Audio Recording",
      }),
    ).toBeTruthy();
  });

  it("says so when System Settings fails to open", async () => {
    mocks.permissions.microphone.open.mockRejectedValueOnce(new Error("no"));
    render(<PermissionsSection />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Turn on microphone in System Settings",
      }),
    );

    await vi.waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(
        "Couldn't open System Settings. Open it from the Apple menu.",
      ),
    );
  });

  it("offers Set up later when mic or system audio was denied", () => {
    const onContinue = vi.fn();
    mocks.permissions.microphone.status = "authorized";
    mocks.permissions.microphone.confirmedStatus = "authorized";
    render(<PermissionsSection onContinue={onContinue} />);

    fireEvent.click(screen.getByRole("button", { name: "Set up later" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith(true);
    expect(
      screen.getByText(/You can turn them on later in Settings › General/),
    ).toBeTruthy();
  });

  it("offers Set up later after a permission request fails", () => {
    Object.values(mocks.permissions).forEach((permission) => {
      permission.status = "neverRequested";
      permission.confirmedStatus = "neverRequested";
    });
    mocks.permissions.systemAudio.error = "Couldn't request system audio";
    render(<PermissionsSection />);

    expect(screen.getByRole("button", { name: "Set up later" })).toBeTruthy();
  });

  it("has no Set up later before anything was denied, or once both are on", () => {
    Object.values(mocks.permissions).forEach((permission) => {
      permission.status = "neverRequested";
      permission.confirmedStatus = "neverRequested";
    });
    const view = render(<PermissionsSection />);
    expect(screen.queryByRole("button", { name: "Set up later" })).toBeNull();

    mocks.permissions.microphone.status = "authorized";
    mocks.permissions.microphone.confirmedStatus = "authorized";
    mocks.permissions.systemAudio.status = "authorized";
    mocks.permissions.systemAudio.confirmedStatus = "authorized";
    view.rerender(<PermissionsSection />);
    expect(screen.queryByRole("button", { name: "Set up later" })).toBeNull();
  });
});
