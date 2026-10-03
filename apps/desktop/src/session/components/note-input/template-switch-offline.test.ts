import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("@anlg/ui/components/ui/toast", () => ({
  toast: { error: mocks.toastError },
}));

import { refuseTemplateSwitchOffline } from "./template-switch-offline";

// Fork tests: journey-meeting P2 (template switch while offline).
describe("refuseTemplateSwitchOffline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.toastError.mockClear();
  });

  it("refuses and says the summary stays when offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    expect(refuseTemplateSwitchOffline("note-1")).toBe(true);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "You're offline. Your summary stays as it is.",
      { id: "template-switch-offline-note-1" },
    );
  });

  it("lets the switch run when online", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

    expect(refuseTemplateSwitchOffline("note-1")).toBe(false);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
