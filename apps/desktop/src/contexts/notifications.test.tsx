import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  downloadHandler: null as
    | null
    | ((event: {
        payload: {
          model: "soniqo-parakeet-batch";
          status: { failed: string };
        };
      }) => void),
  listen: vi.fn(),
  toastError: vi.fn(),
  currentTab: null as null | { type: string },
}));

vi.mock("@anlg/plugin-local-stt", () => ({
  commands: { getServerForModel: vi.fn() },
  events: {
    downloadProgressPayload: {
      listen: mocks.listen,
    },
  },
}));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { error: mocks.toastError },
}));

vi.mock("~/shared/config", () => ({
  useConfigValues: () => ({
    current_stt_provider: "anarlog",
    current_stt_model: "cloud",
    current_llm_provider: "anarlog",
    current_llm_model: "default",
  }),
}));

vi.mock("~/store/zustand/tabs", () => ({
  useTabs: Object.assign(
    (selector: (state: { currentTab: unknown }) => unknown) =>
      selector({ currentTab: mocks.currentTab }),
    { getState: () => ({ currentTab: mocks.currentTab }) },
  ),
}));

vi.mock("~/stt/capabilities", () => ({
  isConfiguredSttModel: () => true,
  isOnDeviceSttModel: () => false,
}));

import { isOnboardingVisible, NotificationProvider } from "./notifications";

describe("NotificationProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.downloadHandler = null;
    mocks.currentTab = null;
    mocks.listen.mockImplementation(async (handler) => {
      mocks.downloadHandler = handler;
      return vi.fn();
    });
  });

  it("surfaces an asynchronous model download failure", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <div />
        </NotificationProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mocks.downloadHandler).not.toBeNull();
    });

    act(() => {
      mocks.downloadHandler?.({
        payload: {
          model: "soniqo-parakeet-batch",
          status: { failed: "download server rejected the model" },
        },
      });
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't download Parakeet",
      { description: "download server rejected the model" },
    );
  });

  it("stays quiet during onboarding, which shows the error in place", async () => {
    mocks.currentTab = { type: "onboarding" };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NotificationProvider>
          <div />
        </NotificationProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(mocks.downloadHandler).not.toBeNull();
    });

    act(() => {
      mocks.downloadHandler?.({
        payload: {
          model: "soniqo-parakeet-batch",
          status: { failed: "network error" },
        },
      });
    });

    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("knows the standalone onboarding route", () => {
    expect(isOnboardingVisible("/app/onboarding", undefined)).toBe(true);
    expect(isOnboardingVisible("/app/main", "sessions")).toBe(false);
  });
});
