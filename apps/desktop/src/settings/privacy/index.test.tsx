import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as unknown,
    isLoading: true,
    error: null as Error | null,
  },
}));

vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));
vi.mock("~/lock/auth", () => ({ DEVICE_AUTH_REASON: {} }));
vi.mock("~/lock/store", () => ({
  useAppLock: (selector: (state: unknown) => unknown) =>
    selector({
      available: true,
      authenticating: false,
      authenticate: vi.fn(),
      lockApp: vi.fn(),
      refreshAvailability: vi.fn(async () => true),
    }),
}));
vi.mock("~/settings/queries", () => ({
  useStoredSettingValuesQuery: () => mocks.query,
  useSetSettingValues: () => vi.fn(),
}));
vi.mock("~/shared/config", () => ({ resolveConfigValue: () => false }));

import { PrivacySection } from "./index";

// journey-account-settings P3 "Settings › Privacy".
describe("Settings › General › Privacy", () => {
  afterEach(cleanup);

  it("shows a spinner, not a blank page, while settings load", () => {
    mocks.query = { data: undefined, isLoading: true, error: null };
    render(<PrivacySection />);
    expect(screen.getByLabelText("Loading settings")).toBeTruthy();
  });

  it("puts the no-telemetry note under the card, without a negative margin", () => {
    mocks.query = {
      data: { values: {}, hasValues: new Set() },
      isLoading: false,
      error: null,
    };
    render(<PrivacySection />);
    const note = screen.getByText(
      "Upshot sends no usage data or crash reports.",
    );
    expect(note.className).not.toMatch(/-mt-/);
    expect(
      note.closest("section")?.querySelector("[data-settings-card]"),
    ).not.toBeNull();
  });
});
