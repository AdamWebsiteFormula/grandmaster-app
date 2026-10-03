import { useMemo, useRef } from "react";

// Fork: the note header menus (Share, ⋯) draw one light hairline, the inner
// panel's, instead of the double chrome-and-panel border (redline-oct3, H2).
export const menuContentClassName =
  "rounded-[20px] border-0 bg-transparent p-0 shadow-md dark:shadow-none";

export const menuTriggerFocusClassName =
  "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

// Fork: a menu closed with the mouse doesn't hand focus back to its trigger,
// so no ring sticks on Share after a click. A keyboard close still returns
// focus, as WAI-ARIA APG menu buttons do (redline-oct3, H2).
export function usePointerCloseAutoFocus() {
  const pointerRef = useRef(false);

  return useMemo(() => {
    const onPointerDown = () => {
      pointerRef.current = true;
    };
    const onKeyDown = () => {
      pointerRef.current = false;
    };

    return {
      triggerProps: { onPointerDown, onKeyDown },
      contentProps: {
        onPointerDown,
        onKeyDown,
        onCloseAutoFocus: (event: Event) => {
          if (pointerRef.current) {
            event.preventDefault();
          }
        },
      },
    };
  }, []);
}
