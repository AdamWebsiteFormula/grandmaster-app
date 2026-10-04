import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";

const { useProviderAvailabilityMock } = vi.hoisted(() => ({
  useProviderAvailabilityMock: vi.fn(),
}));

vi.mock("~/auth/billing-context", () => ({
  useBillingAccess: () => ({ isPaid: true }),
}));

vi.mock("~/settings/ai/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/settings/ai/shared")>()),
  useProviderAvailability: useProviderAvailabilityMock,
}));

vi.mock("~/settings/providers", () => ({
  useAiProvidersState: () => ({
    isReady: true,
    providers: { "stt:deepgram": { api_key: "saved-key" } },
  }),
}));

vi.mock("~/shared/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/shared/config")>()),
  useConfigValues: () => ({ local_stt_model_path: "" }),
}));

import { useConfiguredMapping } from "./select";

afterEach(cleanup);

test.each([true, false])(
  "waits for saved transcription credentials before enabling selection repair (%s)",
  (verified) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["device-info"], { totalMemoryBytes: 16e9 });
    client.setQueryData(["list-supported-models"], []);
    useProviderAvailabilityMock.mockReturnValue({ deepgram: undefined });

    const { result, rerender } = renderHook(useConfiguredMapping, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    // Fork: Upshot transcription waits for the platform to be known.
    expect(result.current.providers.anarlog.configured).toBe(false);
    expect(result.current.providers.deepgram.configured).toBe(false);
    expect(result.current.isReady).toBe(false);

    useProviderAvailabilityMock.mockReturnValue({ deepgram: verified });
    rerender();

    expect(result.current.isReady).toBe(true);
    expect(result.current.providers.deepgram.configured).toBe(verified);
  },
);

test.each([
  ["windows", "x86_64", true],
  ["linux", "x86_64", true],
  ["macos", "x86_64", true],
  ["macos", "aarch64", true],
])(
  "offers Upshot transcription on every computer (%s/%s)",
  (platform, arch, offered) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["device-info"], {
      platform,
      arch,
      totalMemoryBytes: 16e9,
    });
    client.setQueryData(["list-supported-models"], []);
    useProviderAvailabilityMock.mockReturnValue({ deepgram: true });

    const { result } = renderHook(useConfiguredMapping, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    expect(result.current.providers.anarlog.configured).toBe(offered);
    expect(result.current.providers.anarlog.models.map((m) => m.id)).toEqual(
      offered ? ["cloud"] : [],
    );
  },
);

// Fork: Apple Speech is listed only where Upshot runs on-device engines
// (Apple Silicon), so an Intel Mac never offers a pick that the next launch
// would swap for Upshot transcription.
test.each([
  ["aarch64", true],
  ["x86_64", false],
])("lists Apple Speech on a %s Mac: %s", (arch, listed) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["device-info"], {
    platform: "macos",
    arch,
    totalMemoryBytes: 16e9,
  });
  client.setQueryData(
    ["list-supported-models"],
    [
      {
        key: "apple-speech",
        display_name: "Apple Speech",
        model_type: "appleSpeech",
        size_bytes: null,
        supports_realtime: true,
        recommended_memory_bytes: 0,
      },
    ],
  );
  useProviderAvailabilityMock.mockReturnValue({ deepgram: true });

  const { result } = renderHook(useConfiguredMapping, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });

  expect(result.current.providers.apple_speech.configured).toBe(listed);
});
