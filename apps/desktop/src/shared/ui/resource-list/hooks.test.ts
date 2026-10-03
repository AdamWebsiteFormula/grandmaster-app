import { afterEach, describe, expect, it, vi } from "vitest";

import { useWebResources } from "./hooks";

import { BUNDLED_TEMPLATES } from "~/templates/bundled-templates";

describe("useWebResources", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the bundled templates without any network call", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = useWebResources<Record<string, unknown>>("templates");

    expect(result.data).toBe(BUNDLED_TEMPLATES);
    expect(result.isLoading).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns an empty list for unknown endpoints", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(useWebResources("unknown").data).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
