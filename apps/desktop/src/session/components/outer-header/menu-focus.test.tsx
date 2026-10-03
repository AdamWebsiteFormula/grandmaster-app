import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePointerCloseAutoFocus } from "./menu-focus";

const closeEvent = () => ({ preventDefault: vi.fn() }) as unknown as Event;

// Fork: no focus ring left on Share after a mouse close (redline-oct3, H2).
describe("usePointerCloseAutoFocus", () => {
  it("keeps focus off the trigger after a pointer close", () => {
    const { result } = renderHook(() => usePointerCloseAutoFocus());
    result.current.triggerProps.onPointerDown();

    const event = closeEvent();
    result.current.contentProps.onCloseAutoFocus(event);

    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("returns focus to the trigger after a keyboard close", () => {
    const { result } = renderHook(() => usePointerCloseAutoFocus());
    result.current.triggerProps.onPointerDown();
    result.current.contentProps.onKeyDown();

    const event = closeEvent();
    result.current.contentProps.onCloseAutoFocus(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
